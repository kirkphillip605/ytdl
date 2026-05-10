import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { YtDlp } from 'ytdlp-nodejs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Supabase setup
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, '../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Serve static files from downloads directory
app.use('/files', express.static(downloadsDir));

// Fixed: Correct class name is YtDlp
const ytdlp = new YtDlp();

// Search YouTube
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  try {
    const results = await ytdlp.exec([
      `ytsearch5:${query}`,
      '--dump-json',
      '--flat-playlist'
    ]);
    
    const videos = results.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// Download Video
async function performDownload(url, artist, title) {
  const fileName = `${artist} - ${title} [YT].mp4`;
  const filePath = path.join(downloadsDir, fileName);

  await ytdlp.exec([
    url,
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '-o', filePath,
    '--no-playlist'
  ]);

  return fileName;
}

app.post('/api/download', async (req, res) => {
  const { url, artist, title, thumbnailUrl } = req.body;

  try {
    const fileName = await performDownload(url, artist, title);

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

    await performDownload(record.youtube_url, record.artist, record.title);

    const { error: updateError } = await supabase
      .from('downloads')
      .update({ created_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (error) {
    console.error('Regeneration error:', error);
    res.status(500).json({ error: 'Failed to regenerate file' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
