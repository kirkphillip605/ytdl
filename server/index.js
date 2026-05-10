import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase setup
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, '../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Serve downloads folder as static files
app.use('/files', express.static(downloadsDir));

/**
 * Helper to execute yt-dlp commands
 */
async function runYtDlp(args) {
  // Join arguments and escape them properly for the shell
  const command = `yt-dlp ${args.join(' ')}`;
  console.log(`Executing: ${command}`);
  const { stdout, stderr } = await execAsync(command);
  if (stderr && !stdout) throw new Error(stderr);
  return stdout;
}

// Search YouTube using the exact command pattern provided by the user
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    // Use the exact flags: ytsearch5, --dump-json, --flat-playlist, --no-warnings
    const output = await runYtDlp([
      `"ytsearch5:${query.replace(/"/g, '')}"`,
      '--dump-json',
      '--flat-playlist',
      '--no-warnings'
    ]);
    
    // yt-dlp returns one JSON object per line for search results
    const videos = output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          const data = JSON.parse(line);
          return {
            id: data.id,
            title: data.title,
            url: data.url || `https://www.youtube.com/watch?v=${data.id}`,
            thumbnails: data.thumbnails || [{ url: `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg` }]
          };
        } catch (e) {
          return null;
        }
      })
      .filter(v => v !== null);

    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube. Ensure yt-dlp is installed in your PATH.' });
  }
});

// Download Video Logic
app.post('/api/download', async (req, res) => {
  const { url, artist, title, thumbnailUrl } = req.body;

  try {
    const fileName = `${artist} - ${title} [YT].mp4`;
    const filePath = path.join(downloadsDir, fileName);

    // Execute download command
    await runYtDlp([
      `"${url}"`,
      '-f', '"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"',
      '--merge-output-format', 'mp4',
      '-o', `"${filePath}"`,
      '--no-playlist',
      '--no-warnings'
    ]);

    const { data, error } = await supabase
      .from('downloads')
      .insert([
        { 
          youtube_url: url, 
          artist, 
          title, 
          file_path: fileName,
          thumbnail_url: thumbnailUrl
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

app.get('/api/status/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: record, error } = await supabase
      .from('downloads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !record) return res.status(404).json({ error: 'Record not found' });

    const filePath = path.join(downloadsDir, record.file_path);
    const exists = fs.existsSync(filePath);

    res.json({ 
      exists, 
      record,
      downloadUrl: exists ? `/files/${encodeURIComponent(record.file_path)}` : null 
    });
  } catch (error) {
    res.status(500).json({ error: 'Status check failed' });
  }
});

app.post('/api/regenerate/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: record, error: fetchError } = await supabase
      .from('downloads')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !record) return res.status(404).json({ error: 'Record not found' });

    const filePath = path.join(downloadsDir, record.file_path);
    await runYtDlp([
      `"${record.youtube_url}"`,
      '-f', '"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"',
      '--merge-output-format', 'mp4',
      '-o', `"${filePath}"`,
      '--no-playlist',
      '--no-warnings'
    ]);

    await supabase
      .from('downloads')
      .update({ created_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Regeneration error:', error);
    res.status(500).json({ error: 'Failed to regenerate file' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
