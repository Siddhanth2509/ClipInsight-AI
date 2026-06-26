'use client';
import { useEffect, useState } from 'react';

// ── Friendly error messages ────────────────────────────────────────────────────
const ERROR_MAP: Record<string, string> = {
  private_video:    "🔒 Private video — try a public one.",
  video_unavailable:"📵 This video isn't available. It may have been deleted.",
  login_required:   "🔐 This platform requires login. Try a YouTube or public Instagram URL.",
  video_too_long:   "⏳ This video is too long (max 3 min). Please try a shorter one.",
  too_large:        "📦 Video is too large (max 100MB). Try a shorter clip.",
  default:          "⚠ Something went wrong. Please try a different URL.",
};

function getFriendlyError(raw: string): string {
  for (const [key, msg] of Object.entries(ERROR_MAP)) {
    if (raw.toLowerCase().includes(key)) return msg;
  }
  return ERROR_MAP.default;
}

const STEPS = [
  { key: 'upload',          label: 'Upload',    icon: '⬆️',  kanji: '上' },
  { key: 'extracting',      label: 'Frames',    icon: '🎞',  kanji: '映' },
  { key: 'transcribing',    label: 'Audio',     icon: '🎙',  kanji: '声' },
  { key: 'analyzing',       label: 'AI Vision', icon: '🧠',  kanji: '知' },
  { key: 'detecting_music', label: 'Music',     icon: '🎵',  kanji: '楽' },
  { key: 'done',            label: 'Complete',  icon: '🌸',  kanji: '桜' },
] as const;

type StepKey = typeof STEPS[number]['key'];

const STATUS_TO_STEP: Record<string, StepKey> = {
  queued:          'upload',
  uploaded:        'upload',
  downloaded:      'upload',
  downloading:     'upload',
  extracting:      'extracting',
  transcribing:    'transcribing',
  analyzing:       'analyzing',
  detecting_music: 'detecting_music',
  done:            'done',
};

interface AnalysisProgressProps {
  jobId: string;
  onComplete: (result: any) => void;
}

export default function AnalysisProgress({ jobId, onComplete }: AnalysisProgressProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>('upload');
  const [messages,    setMessages]    = useState<string[]>([]);
  const [error,       setError]       = useState('');
  const [thumbnail,   setThumbnail]   = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!jobId) return;

    const startPipeline = async () => {
      try {
        await fetch(`${API}/analyze/${jobId}`, { method: 'POST' });
      } catch (e) {
        setError('Could not connect to the analysis server.');
      }
    };
    startPipeline();

    const poll = async () => {
      try {
        const res  = await fetch(`${API}/status/${jobId}`);
        const data = await res.json();
        setCurrentStep(STATUS_TO_STEP[data.status] || 'upload');
        setMessages(data.progress || []);

        // Pick up thumbnail URL if backend stored it
        if (data.thumbnail_url) {
          setThumbnail(data.thumbnail_url);
        }

        if (data.error) setError(getFriendlyError(data.error));
        if (data.status === 'done') {
          clearInterval(id);
          const rRes   = await fetch(`${API}/results/${jobId}`);
          const result = await rRes.json();
          onComplete(result);
        }
      } catch (e) {
        console.error('Status poll error:', e);
      }
    };

    const id = setInterval(poll, 1500);
    poll();
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, onComplete, API]);

  const currentIdx = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', width: '100%' }}>

      {/* Current step kanji watermark */}
      <div style={{ textAlign: 'center', position: 'relative', marginBottom: 48 }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-60%)',
          fontFamily: 'var(--font-display)',
          fontSize: '10rem', fontWeight: 900, lineHeight: 1,
          color: 'var(--text-kanji)',
          pointerEvents: 'none', userSelect: 'none',
          transition: 'all 0.5s ease',
        }}>
          {STEPS[currentIdx]?.kanji}
        </div>

        {/* Step Track */}
        <div className="step-track">
          {STEPS.map((step, i) => {
            const isDone   = i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <div key={step.key} className={`step-item${isDone ? ' done' : ''}${isActive ? ' active' : ''}`}>
                {i < STEPS.length - 1 && (
                  <div className="step-line-h" style={{
                    background: isDone
                      ? 'linear-gradient(90deg, var(--sakura-bloom), var(--sakura-blush))'
                      : 'var(--glass-border)',
                  }} />
                )}
                <div className="step-dot-sakura">
                  {isDone ? '🌸' : step.icon}
                </div>
                <span className="step-name">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Video Thumbnail Preview — Phase 3d */}
      {thumbnail && (
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: 28,
          animation: 'fadeInDown 0.5s ease',
        }}>
          <div style={{
            position: 'relative', borderRadius: 18, overflow: 'hidden',
            border: '1px solid var(--glass-border-bright)',
            boxShadow: '0 12px 48px rgba(155,59,82,0.22)',
            maxWidth: 340,
          }}>
            <img
              src={thumbnail}
              alt="Video thumbnail"
              style={{ width: '100%', display: 'block', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Overlay badge */}
            <div style={{
              position: 'absolute', top: 12, left: 12,
              background: 'rgba(155,59,82,0.88)',
              backdropFilter: 'blur(8px)',
              borderRadius: 8, padding: '4px 12px',
              fontSize: '0.72rem', fontWeight: 600,
              color: '#fff', letterSpacing: '0.08em',
            }}>
              🎬 ANALYZING
            </div>
            {/* Bottom gradient */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
              background: 'linear-gradient(transparent, var(--midnight))',
            }} />
          </div>
        </div>
      )}

      {/* Live log card */}
      <div className="glass-elevated" style={{
        borderRadius: 24, padding: '28px 32px',
        border: '1px solid var(--glass-border)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Top glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, var(--sakura-bloom), transparent)',
          opacity: 0.4,
        }} />

        {/* Status indicator row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: error ? '#f87171' : currentStep === 'done' ? '#6EE7B7' : 'var(--sakura-bloom)',
            boxShadow: `0 0 12px ${error ? '#f87171' : currentStep === 'done' ? '#6EE7B7' : 'var(--sakura-bloom)'}`,
            transition: 'background 0.4s ease',
            animation: !error && currentStep !== 'done' ? 'step-breathe 1.6s infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            {error
              ? '詩が失われました — An error occurred'
              : currentStep === 'done'
              ? '桜が咲きました — Analysis complete!'
              : `${STEPS[currentIdx]?.label} in progress…`}
          </span>
        </div>

        {/* Shimmer placeholders while waiting */}
        {messages.length === 0 && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[80, 65, 50].map((w, i) => (
              <div key={i} className="shimmer" style={{ height: 14, width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Log entries */}
        {messages.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            maxHeight: 220, overflowY: 'auto',
            paddingRight: 4,
          }}>
            {messages.map((msg, i) => (
              <div key={i} className="log-entry">
                <span className="log-arrow">›</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {msg}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div style={{
            padding: '14px 18px', borderRadius: 12, marginTop: 8,
            background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.18)',
            color: '#fca5a5', fontSize: '0.85rem', lineHeight: 1.6,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Petal loading animation at bottom */}
        {!error && currentStep !== 'done' && (
          <div className="loading-petals" style={{ marginTop: 24, marginBottom: 0 }}>
            <div className="loading-petal" />
            <div className="loading-petal" />
            <div className="loading-petal" />
          </div>
        )}
      </div>

      {/* Haiku quote while loading */}
      {currentStep !== 'done' && !error && (
        <div style={{
          textAlign: 'center', marginTop: 32,
          fontFamily: 'var(--font-heading)',
          fontStyle: 'italic', fontSize: '0.95rem',
          color: 'var(--text-muted)', lineHeight: 2,
        }}>
          <div style={{ color: 'var(--glass-border-bright)', fontSize: '1.4rem', marginBottom: 4 }}>花びら</div>
          "Every frame a petal — patience blooms<br />into wisdom"
        </div>
      )}
    </div>
  );
}
