'use client';
import { useEffect, useState } from 'react';

interface HistoryEntry {
  jobId: string;
  hookScore: number;
  sentiment: string;
  summary: string;
  tags: string[];
  analyzedAt: string;    // ISO string
  thumbnailUrl?: string;
}

const STORAGE_KEY = 'clipinsight_history';

export function saveToHistory(result: any, jobId: string, thumbnailUrl?: string) {
  try {
    const entry: HistoryEntry = {
      jobId,
      hookScore:    result.hook_score ?? 0,
      sentiment:    result.sentiment ?? 'Neutral',
      summary:      (result.summary ?? '').slice(0, 120),
      tags:         (result.tags ?? []).slice(0, 4),
      analyzedAt:   new Date().toISOString(),
      thumbnailUrl,
    };

    const raw     = localStorage.getItem(STORAGE_KEY);
    const history: HistoryEntry[] = raw ? JSON.parse(raw) : [];

    // Keep latest 10, avoid duplicates
    const filtered = history.filter(h => h.jobId !== jobId);
    filtered.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 10)));
  } catch (_) {
    // localStorage unavailable (SSR / incognito) — silent fail
  }
}

export function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

interface HistoryPanelProps {
  onReplay: (jobId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function hookColor(score: number) {
  if (score >= 80) return '#86efac';
  if (score >= 60) return '#FFB7C5';
  return '#f87171';
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HistoryPanel({ onReplay, isOpen, onClose }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch (_) {
      setHistory([]);
    }
  }, [isOpen]);

  const handleClear = () => {
    clearHistory();
    setHistory([]);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(10,6,28,0.75)',
      backdropFilter: 'blur(16px)',
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        width: '100%', maxWidth: 440,
        height: '100%', overflowY: 'auto',
        background: 'rgba(18,10,36,0.98)',
        borderLeft: '1px solid rgba(255,183,197,0.12)',
        boxShadow: '-40px 0 80px rgba(0,0,0,0.5)',
        padding: '32px 28px',
        animation: 'slideInRight 0.3s cubic-bezier(0.22,1,0.36,1)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF85A2', marginBottom: 4 }}>
              履歴
            </div>
            <h3 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.4rem', margin: 0 }}>
              Analysis <span style={{ color: '#FF85A2' }}>History</span>
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,183,197,0.08)', border: '1px solid rgba(255,183,197,0.15)',
            borderRadius: 10, padding: '8px 12px', color: '#998CAD', cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Empty state */}
        {history.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: '#998CAD' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🍂</div>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
              No analyses yet.<br />
              完全に — Your history will appear here.
            </p>
          </div>
        )}

        {/* History entries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((entry, i) => (
            <div
              key={entry.jobId}
              style={{
                background: 'rgba(255,183,197,0.04)',
                border: '1px solid rgba(255,183,197,0.1)',
                borderRadius: 16, padding: '16px 18px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => onReplay(entry.jobId)}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(255,133,162,0.3)';
                e.currentTarget.style.background  = 'rgba(255,133,162,0.07)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,183,197,0.1)';
                e.currentTarget.style.background  = 'rgba(255,183,197,0.04)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Thumbnail or placeholder */}
                <div style={{
                  width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                  background: 'rgba(255,183,197,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {entry.thumbnailUrl
                    ? <img src={entry.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '1.4rem' }}>🎬</span>
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Hook score + time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{
                      fontSize: '1.1rem', fontWeight: 800,
                      color: hookColor(entry.hookScore),
                      fontFamily: 'Georgia, serif',
                    }}>
                      {entry.hookScore}<span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#998CAD' }}>/100</span>
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#998CAD' }}>{timeAgo(entry.analyzedAt)}</span>
                  </div>

                  {/* Summary preview */}
                  <p style={{
                    fontSize: '0.78rem', color: '#998CAD', lineHeight: 1.5,
                    margin: 0, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {entry.summary || 'No summary available'}
                  </p>

                  {/* Tags */}
                  {entry.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {entry.tags.map(tag => (
                        <span key={tag} style={{
                          padding: '2px 8px', borderRadius: 100,
                          background: 'rgba(255,133,162,0.1)',
                          fontSize: '0.65rem', color: '#FF85A2',
                        }}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clear button */}
        {history.length > 0 && (
          <button
            onClick={handleClear}
            style={{
              marginTop: 24, width: '100%',
              padding: '10px', borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(248,113,113,0.2)',
              color: '#f87171', fontSize: '0.82rem',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🗑 Clear History
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
