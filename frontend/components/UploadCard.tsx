'use client';
import { useState, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Friendly error classifier ────────────────────────────────────────────────
function classifyError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('private') || r.includes('private_video'))
    return '🔒 This video is private. Please try a public URL.';
  if (r.includes('login') || r.includes('sign in') || r.includes('age-restricted'))
    return '🔐 This platform requires login to view. Try a YouTube or public Instagram URL.';
  if (r.includes('unavailable') || r.includes('does not exist') || r.includes('deleted'))
    return '📵 This video is unavailable or has been deleted.';
  if (r.includes('too large') || r.includes('max') || r.includes('size'))
    return '📦 Video is too large. Try a clip under 3 minutes.';
  if (r.includes('unsupported') || r.includes('not supported'))
    return '🚫 This platform isn\'t supported yet. Try Instagram, YouTube, or TikTok.';
  if (r.includes('timeout') || r.includes('connection'))
    return '⏱ Connection timed out. Check your internet and try again.';
  if (r.includes('invalid url') || r.includes('no video formats'))
    return '🔗 That URL doesn\'t point to a video. Double-check and try again.';
  return `⚠ ${raw}`;
}

interface UploadCardProps {
  onJobCreated: (jobId: string) => void;
}

export default function UploadCard({ onJobCreated }: UploadCardProps) {
  const [isDragOver, setIsDragOver]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'upload' | 'url'>('upload');
  const [url, setUrl]                 = useState('');
  const [urlError, setUrlError]       = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [fileName, setFileName]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── File upload ────────────────────────────────────────────────────────── */
  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setUploadError('');
    setFileName(file.name);
    const form = new FormData();
    form.append('file', file);
    try {
      const res  = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      onJobCreated(data.job_id);
    } catch (e: any) {
      setUploadError(classifyError(e.message));
      setFileName('');
    } finally {
      setIsLoading(false);
    }
  }, [onJobCreated]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ── URL submit ─────────────────────────────────────────────────────────── */
  const handleUrl = async () => {
    setUrlError('');
    if (!url.trim()) { setUrlError('Please enter a video URL.'); return; }
    try { new URL(url); } catch { setUrlError('🔗 That doesn\'t look like a valid URL. Check and try again.'); return; }
    setIsLoading(true);
    const form = new FormData();
    form.append('url', url);
    try {
      const res  = await fetch(`${API}/analyze-url`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Download failed');
      onJobCreated(data.job_id);
    } catch (e: any) {
      setUrlError(classifyError(e.message));
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="upload-card glass-elevated" style={{ borderRadius: 28 }}>

      {/* Card top shimmer line */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,133,162,0.6), transparent)',
      }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 68, height: 68, margin: '0 auto 18px',
          background: 'linear-gradient(135deg, #E8557A, #FFB7C5)',
          borderRadius: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1.9rem',
          boxShadow: '0 8px 40px rgba(232,85,122,0.45)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08) rotate(-4deg)')}
          onMouseLeave={e => (e.currentTarget.style.transform = '')}>
          🌸
        </div>
        <h2 style={{
          fontFamily: 'var(--font-heading)', fontSize: '1.75rem',
          fontWeight: 600, fontStyle: 'italic', marginBottom: 6,
        }}>
          Begin Your <span className="sakura-text">Analysis</span>
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Upload a video or paste a link · AI insights in seconds
        </p>
      </div>

      {/* Tab switcher */}
      <div className="mode-tabs">
        {(['upload', 'url'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`mode-tab${activeTab === tab ? ' active' : ''}`}>
            {tab === 'upload' ? '🎬 Upload File' : '🔗 Paste URL'}
          </button>
        ))}
      </div>

      {/* ── UPLOAD TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'upload' && (
        <>
          <div
            className={`drop-zone${isDragOver ? ' over' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => !isLoading && fileRef.current?.click()}>

            <div className="drop-icon">
              {isLoading
                ? <span style={{ animation: 'petal-spin 1s linear infinite', display: 'inline-block' }}>🌸</span>
                : '⬆️'}
            </div>

            {isLoading && fileName ? (
              <>
                <p style={{ fontWeight: 600, marginBottom: 6, position: 'relative', zIndex: 1 }}>
                  Uploading <span className="sakura-text">{fileName}</span>…
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                  {[0, 160, 320].map(d => (
                    <div key={d} className="loading-petal" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 8, position: 'relative', zIndex: 1, color: isDragOver ? 'var(--sakura-pale)' : 'var(--text-primary)' }}>
                  {isDragOver ? '🌸 Release to bloom…' : 'Drag & drop your video'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', position: 'relative', zIndex: 1 }}>
                  or click to browse · MP4, MOV, AVI, MKV, WebM · Max 200MB
                </p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {/* Format hint pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
            {['MP4', 'MOV', 'AVI', 'MKV', 'WebM'].map(f => (
              <span key={f} className="platform-chip">{f}</span>
            ))}
          </div>

          {/* Upload error display */}
          {uploadError && (
            <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 12, textAlign: 'center' }}>
              {uploadError}
            </p>
          )}
        </>
      )}

      {/* ── URL TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'url' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              className="url-input-sakura"
              type="url"
              placeholder="https://www.instagram.com/reel/..."
              value={url}
              onChange={e => { setUrl(e.target.value); setUrlError(''); }}
              onKeyDown={e => e.key === 'Enter' && !isLoading && handleUrl()}
              disabled={isLoading}
              style={{ paddingRight: 130 }}
            />
            <button
              className="btn-sakura"
              onClick={handleUrl}
              disabled={isLoading}
              style={{
                position: 'absolute', right: 6, top: '50%',
                transform: 'translateY(-50%)',
                padding: '10px 20px', fontSize: '0.82rem',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'none',
              }}>
              {isLoading
                ? <span style={{ display: 'inline-block', animation: 'petal-spin 1s linear infinite' }}>🌸</span>
                : 'Analyze →'}
            </button>
          </div>

          {urlError && (
            <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: 12 }}>⚠ {urlError}</p>
          )}

          {/* Platform chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
            {[
              { icon: '📸', name: 'Instagram Reels' },
              { icon: '▶️',  name: 'YouTube Shorts' },
              { icon: '🎵', name: 'TikTok' },
              { icon: '🐦', name: 'Twitter/X' },
            ].map(p => (
              <div key={p.name} className="platform-chip" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
