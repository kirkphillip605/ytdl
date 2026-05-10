import React, { useState, useEffect } from 'react';
import { Search, History as HistoryIcon, Download, Music, User, Play, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

interface Video {
  id: string;
  title: string;
  thumbnails: { url: string }[];
  url: string;
}

interface DownloadRecord {
  id: string;
  youtube_url: string;
  artist: string;
  title: string;
  file_path: string;
  thumbnail_url: string;
  created_at: string;
  status?: 'ready' | 'expired' | 'checking';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'history'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [metadata, setMetadata] = useState({ artist: '', title: '' });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('downloads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      const historyWithStatus = await Promise.all(data.map(async (item) => {
        try {
          const res = await axios.get(`${API_BASE}/status/${item.id}`);
          return { ...item, status: res.data.exists ? 'ready' : 'expired' };
        } catch {
          return { ...item, status: 'expired' };
        }
      }));
      setHistory(historyWithStatus as DownloadRecord[]);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await axios.post(`${API_BASE}/search`, { query: searchQuery });
      setSearchResults(res.data);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setIsSearching(false);
    }
  };

  const startDownload = async () => {
    if (!selectedVideo || !metadata.artist || !metadata.title) return;

    setIsDownloading(true);
    setDownloadProgress(10); // Initial progress
    
    try {
      await axios.post(`${API_BASE}/download`, {
        url: selectedVideo.url,
        artist: metadata.artist,
        title: metadata.title,
        thumbnailUrl: selectedVideo.thumbnails[0]?.url
      });
      
      setSelectedVideo(null);
      setMetadata({ artist: '', title: '' });
      setActiveTab('history');
    } catch (error) {
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      setHistory(prev => prev.map(item => item.id === id ? { ...item, status: 'checking' } : item));
      await axios.post(`${API_BASE}/regenerate/${id}`);
      fetchHistory();
    } catch (error) {
      alert('Regeneration failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Navigation */}
      <nav className="border-b border-zinc-800 bg-[#0d0d0d] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Play size={18} fill="white" />
            </div>
            <span className="font-bold text-xl tracking-tight">YT PRO</span>
          </div>
          
          <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button 
              onClick={() => setActiveTab('search')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Search size={16} /> Search
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <HistoryIcon size={16} /> History
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'search' ? (
          <div className="space-y-8">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search YouTube videos..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all text-lg"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <button 
                disabled={isSearching}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-6 py-2 rounded-xl font-semibold transition-colors"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((video) => (
                <div 
                  key={video.id}
                  className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img 
                      src={video.thumbnails[0]?.url} 
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => setSelectedVideo(video)}
                        className="bg-white text-black p-3 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform"
                      >
                        <Download size={24} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium line-clamp-2 text-zinc-200">{video.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Download History</h2>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80">
                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">Video</th>
                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">Metadata</th>
                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={item.thumbnail_url} className="w-20 aspect-video rounded-lg object-cover" />
                          <span className="text-sm font-medium line-clamp-1 max-w-[200px]">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <User size={12} /> {item.artist}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Music size={12} /> {item.title}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.status === 'ready' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium">
                            <CheckCircle2 size={14} /> File Ready
                          </span>
                        ) : item.status === 'checking' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium animate-pulse">
                            <RefreshCw size={14} className="animate-spin" /> Processing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                            <AlertCircle size={14} /> Expired
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.status === 'ready' ? (
                          <a 
                            href={`http://localhost:3001/files/${encodeURIComponent(item.file_path)}`}
                            download
                            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Download size={16} /> Download
                          </a>
                        ) : (
                          <button 
                            onClick={() => handleRegenerate(item.id)}
                            className="inline-flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <RefreshCw size={16} /> Regenerate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Metadata Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Download Settings</h3>
                <p className="text-zinc-400 text-sm">Customize the metadata for your MP4 file.</p>
              </div>

              <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-800">
                <img src={selectedVideo.thumbnails[0]?.url} className="w-full h-full object-cover" />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Artist</label>
                  <input 
                    type="text"
                    value={metadata.artist}
                    onChange={(e) => setMetadata({ ...metadata, artist: e.target.value })}
                    placeholder="e.g. Hans Zimmer"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Title</label>
                  <input 
                    type="text"
                    value={metadata.title}
                    onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                    placeholder="e.g. Interstellar Main Theme"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all"
                  />
                </div>
              </div>

              {isDownloading && (
                <div className="space-y-2">
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-600 transition-all duration-500" 
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-zinc-500 animate-pulse">Processing high-quality encode...</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={startDownload}
                  disabled={isDownloading || !metadata.artist || !metadata.title}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {isDownloading ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                  {isDownloading ? 'Downloading...' : 'Start Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
