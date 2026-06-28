'use client';
import { useEffect, useState, useRef } from 'react';

/* ── Error mapping ─────────────────────────────────────────────────────────── */
const ERROR_MAP: Record<string, string> = {
  private_video:     '🔒 Private video — try a public one.',
  video_unavailable: '🔵 This video is not available. It may have been deleted.',
  login_required:    '🔐 Login required. Try a YouTube or public Instagram URL.',
  video_too_long:    '⏳ Video too long (max 3 min). Please try a shorter one.',
  too_large:         '📦 Video too large (max 100MB). Try a shorter clip.',
  default:           '⚠️ Something went wrong. Please try a different URL.',
};

function getFriendlyError(raw: string): string {
  for (const [key, msg] of Object.entries(ERROR_MAP)) {
    if (raw.toLowerCase().includes(key)) return msg;
  }
  return ERROR_MAP.default;
}

/* ── Status ordering ───────────────────────────────────────────────────────── */
const STATUS_ORDER = [
  'queued', 'downloading', 'downloaded',
  'extracting', 'transcribing', 'analyzing', 'detecting_music', 'done',
] as const;

/* ── AI Engines list ───────────────────────────────────────────────────────── */
const AI_ENGINES = [
  { label: 'Downloading Video',            icon: '⬇️',  activeStep: 1, doneStep: 2 },
  { label: 'Extracting Frames',            icon: '🎞️',  activeStep: 2, doneStep: 3 },
  { label: 'Whisper is Listening',         icon: '🎙️',  activeStep: 3, doneStep: 4 },
  { label: 'Vision AI Detecting Objects',  icon: '👁️',  activeStep: 4, doneStep: 5 },
  { label: 'OCR Reading Text',             icon: '📝',  activeStep: 4, doneStep: 5 },
  { label: 'Emotion Engine',               icon: '😊',  activeStep: 4, doneStep: 5 },
  { label: 'Music Identification',         icon: '🎵',  activeStep: 5, doneStep: 6 },
  { label: 'Report Generation',            icon: '📊',  activeStep: 6, doneStep: 7 },
];

/* ── Pipeline steps ────────────────────────────────────────────────────────── */
const PIPELINE = [
  { label: 'Video Ingestion',    icon: '📥', doneAt: 2 },
  { label: 'Frame Extraction',   icon: '🎞️', doneAt: 3 },
  { label: 'Audio Processing',   icon: '🎙️', doneAt: 4 },
  { label: 'AI Analysis',        icon: '🧠', doneAt: 5 },
  { label: 'Insight Generation', icon: '✨', doneAt: 7 },
];

/* ── Neural network node positions ────────────────────────────────────────── */
const NEURAL_NODES = [
  { x: 12, y: 25,  label: 'Vision AI',  activeFrom: 4 },
  { x: 82, y: 18,  label: 'Speech AI',  activeFrom: 3 },
  { x: 88, y: 68,  label: 'OCR',        activeFrom: 4 },
  { x: 55, y: 88,  label: 'Emotion',    activeFrom: 4 },
  { x: 10, y: 72,  label: 'Trend',      activeFrom: 5 },
  { x: 45, y: 12,  label: 'Whisper',    activeFrom: 3 },
  { x: 70, y: 55,  label: 'Gemini',     activeFrom: 4 },
];

/* ── Confetti config ───────────────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#7C5CFC', '#3DD9FF', '#57D98D', '#F5C96A', '#FFB6C1', '#EC4899'];

interface Props {
  jobId: string;
  onComplete: (result: any) => void;
  onError?:   (msg: string)  => void;
}

export default function AnalysisProgress({ jobId, onComplete, onError }: Props) {
  const [statusStr,    setStatusStr]    = useState('queued');
  const [messages,     setMessages]     = useState<string[]>([]);
  const [error,        setError]        = useState('');
  const [thumbnail,    setThumbnail]    = useState('');
  const [showSuccess,  setShowSuccess]  = useState(false);
  const [enginePct,    setEnginePct]    = useState<number[]>(Array(8).fill(0));
  const [overallPct,   setOverallPct]   = useState(0);
  const [eta,          setEta]          = useState('~60s');
  const [confetti,     setConfetti]     = useState<{ x: number; color: string; delay: number; size: number; round: boolean }[]>([]);

  const API         = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const targetsRef  = useRef<number[]>(Array(8).fill(0));
  const startRef    = useRef<number>(Date.now());
  const doneRef     = useRef(false);

  const safeIdx = Math.max(0, STATUS_ORDER.indexOf(statusStr as typeof STATUS_ORDER[number]));

  /* ── Compute engine target progress based on status ─────────────────────── */
  useEffect(() => {
    if (statusStr === 'done') {
      targetsRef.current = Array(8).fill(100);
      setOverallPct(100);
      setEta('');
      return;
    }

    const targets = AI_ENGINES.map(e => {
      if (safeIdx < e.activeStep) return 0;
      if (safeIdx >= e.doneStep)  return 100;
      const frac = (safeIdx - e.activeStep + 0.4) / (e.doneStep - e.activeStep);
      return Math.min(88, Math.round(frac * 100 + 8));
    });
    targetsRef.current = targets;

    const overall = Math.min(95, Math.round((safeIdx / (STATUS_ORDER.length - 1)) * 100));
    setOverallPct(overall);

    const elapsed   = (Date.now() - startRef.current) / 1000;
    const totalEst  = 65;
    const remaining = Math.max(0, Math.round(totalEst - elapsed));
    setEta(remaining > 0 ? `~${remaining}s` : 'almost done...');
  }, [statusStr, safeIdx]);

  /* ── Smooth animation toward targets ────────────────────────────────────── */
  useEffect(() => {
    const id = setInterval(() => {
      setEnginePct(prev =>
        prev.map((p, i) => {
          const t = targetsRef.current[i];
          if (Math.abs(p - t) < 0.5) return t;
          return p + (t - p) * 0.07;
        })
      );
    }, 40);
    return () => clearInterval(id);
  }, []);

  /* ── Backend polling ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!jobId) return;
    startRef.current = Date.now();
    doneRef.current  = false;

    (async () => {
      try {
        await fetch(`${API}/analyze/${jobId}`, { method: 'POST' });
      } catch {
        setError('Could not connect to the analysis server. Is the backend running?');
      }
    })();

    const poll = async () => {
      if (doneRef.current) return;
      try {
        const res  = await fetch(`${API}/status/${jobId}`);
        const data = await res.json();
        setStatusStr(data.status || 'queued');
        setMessages(data.progress || []);
        if (data.thumbnail_url) setThumbnail(data.thumbnail_url);

        if (data.error) {
          const msg = getFriendlyError(data.error);
          setError(msg);
          onError?.(msg);
          doneRef.current = true;
          clearInterval(pollId);
          return;
        }

        if (data.status === 'done') {
          doneRef.current = true;
          clearInterval(pollId);

          // Spawn confetti
          setConfetti(
            Array.from({ length: 60 }, (_, i) => ({
              x:     Math.random() * 100,
              color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              delay: Math.random() * 1.8,
              size:  6 + Math.random() * 10,
              round: Math.random() > 0.5,
            }))
          );
          setShowSuccess(true);

          // Fetch full result then transition
          setTimeout(async () => {
            try {
              const rRes   = await fetch(`${API}/results/${jobId}`);
              const result = await rRes.json();
              onComplete(result);
            } catch (e) {
              console.error('Failed to fetch results:', e);
            }
          }, 2800);
        }
      } catch (e) {
        console.error('Status poll error:', e);
      }
    };

    const pollId = setInterval(poll, 1500);
    poll();
    return () => { clearInterval(pollId); doneRef.current = true; };
  }, [jobId, onComplete, onError, API]);

  const latestMsg = messages[messages.length - 1] || 'Initializing pipeline...';

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Confetti burst ── */}
      {showSuccess && (
        <div className="confetti-container">
          {confetti.map((p, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left:            `${p.x}%`,
                background:      p.color,
                width:           p.size,
                height:          p.size,
                borderRadius:    p.round ? '50%' : '2px',
                animationDelay:  `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Success overlay ── */}
      {showSuccess && (
        <div className="success-overlay">
          <div className="success-check-ring">
            <span style={{ fontSize: '3rem' }}>✅</span>
          </div>
          <h2 className="success-title">Analysis Complete!</h2>
          <p className="success-sub">Your insights are ready — loading your report...</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {CONFETTI_COLORS.slice(0, 3).map((c, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%', background: c,
                animation: 'live-pulse 1s ease-in-out infinite',
                animationDelay: `${i * 0.25}s`,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Neural network background ── */}
      <div className="neural-bg" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          {NEURAL_NODES.map((n1, i) =>
            NEURAL_NODES.slice(i + 1).map((n2, j) => (
              <line
                key={`${i}-${j}`}
                x1={`${n1.x}%`} y1={`${n1.y}%`}
                x2={`${n2.x}%`} y2={`${n2.y}%`}
                stroke={
                  safeIdx >= n1.activeFrom && safeIdx >= n2.activeFrom
                    ? 'rgba(124,92,252,0.12)'
                    : 'rgba(255,255,255,0.025)'
                }
                strokeWidth="0.15"
              />
            ))
          )}
        </svg>
        {NEURAL_NODES.map((nd, i) => (
          <div
            key={i}
            className={`neural-node-wrap${safeIdx >= nd.activeFrom ? ' active' : ''}`}
            style={{ left: `${nd.x}%`, top: `${nd.y}%` }}
          >
            <div className="neural-node-dot" />
            <span className="neural-node-label">{nd.label}</span>
          </div>
        ))}
      </div>

      {/* ── Main page ── */}
      <div className="analyze-page">

        {/* Header */}
        <div className="analyze-header">
          <div className="analyze-label">
            <span className="analyze-label-dot" />
            AI Analysis In Progress
          </div>
          <h1 className="analyze-title">Analyzing Your Reel</h1>
          <p className="analyze-sub">
            Our AI is processing every detail — speech, visuals, music, emotion &amp; trends.
          </p>
        </div>

        {/* 2-Column grid */}
        <div className="analyze-grid">

          {/* ── Left: Engine Status ── */}
          <div className="engine-panel">
            <div className="engine-panel-title">⚡ AI Engine Status</div>
            {AI_ENGINES.map((eng, i) => {
              const pct     = Math.round(enginePct[i]);
              const isDone  = pct >= 99;
              const isActive= pct > 0 && pct < 99;
              return (
                <div key={eng.label} className="engine-row">
                  <span className="engine-icon">{eng.icon}</span>
                  <span className="engine-label" style={{
                    color: isDone ? 'var(--green)' : isActive ? 'var(--tx-0)' : 'var(--tx-3)',
                  }}>
                    {eng.label}
                  </span>
                  <div className="engine-bar-wrap">
                    <div className="engine-bar-fill" style={{
                      width: `${pct}%`,
                      background: isDone
                        ? 'linear-gradient(90deg, #57D98D, #3DD9FF)'
                        : 'linear-gradient(90deg, var(--purple), var(--cyan))',
                    }} />
                  </div>
                  <span className="engine-percent" style={{
                    color: isDone ? 'var(--green)' : isActive ? 'var(--purple)' : 'var(--tx-3)',
                  }}>
                    {isDone ? '✓' : `${pct}%`}
                  </span>
                </div>
              );
            })}

            {/* Thumbnail preview */}
            {thumbnail && (
              <div style={{ marginTop: 20, borderRadius: 14, overflow: 'hidden', position: 'relative', maxHeight: 110 }}>
                <img
                  src={thumbnail}
                  alt="Video thumbnail"
                  style={{ width: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(transparent 40%, rgba(2,11,24,0.95))',
                  display: 'flex', alignItems: 'flex-end', padding: '10px 14px',
                }}>
                  <span style={{
                    background: 'rgba(124,92,252,0.85)', borderRadius: 8,
                    padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700,
                    color: '#fff', letterSpacing: '0.1em',
                  }}>
                    🎬 ANALYZING
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Orb + Metrics + Companion ── */}
          <div className="orb-panel">
            {/* Animated orb */}
            <div className="analyze-orb">
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div className="orb-percent">{Math.round(overallPct)}%</div>
                <div className="orb-label">{statusStr === 'done' ? 'Complete' : 'Analyzing'}</div>
              </div>
            </div>

            {eta && (
              <p style={{ fontSize: '0.78rem', color: 'var(--tx-2)', fontFamily: 'var(--font-body)', margin: 0 }}>
                Estimated remaining:&nbsp;
                <strong style={{ color: 'var(--purple)' }}>{eta}</strong>
              </p>
            )}

            {/* Mini metric cards */}
            <div className="metric-row">
              {[
                { label: 'Objects',  value: safeIdx >= 4 ? `${Math.min(128, safeIdx * 22)}` : '—' },
                { label: 'Speech',   value: safeIdx >= 3 ? `${Math.min(99, 70 + safeIdx * 4)}%` : '—' },
                { label: 'AI Score', value: safeIdx >= 5 ? `${60 + safeIdx * 4}` : '—' },
              ].map(m => (
                <div key={m.label} className="metric-mini-card">
                  <div className="metric-mini-value">{m.value}</div>
                  <div className="metric-mini-label">{m.label}</div>
                </div>
              ))}
            </div>

            {/* AI Companion — visual placeholder */}
            <div className="companion-placeholder">
              <div className="companion-avatar">🤖</div>
              <div>
                <div className="companion-name">AI Companion</div>
                <div className="companion-status">Available after analysis completes</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Live message bar ── */}
        <div className="live-message-panel">
          <span className="live-message-dot" />
          <span className="live-message-text">
            {error ? `⚠️ ${error}` : latestMsg}
          </span>
        </div>

        {/* ── Pipeline steps ── */}
        <div className="pipeline-section">
          <div className="pipeline-title">📡 Analysis Pipeline</div>
          <div className="pipeline-steps">
            {PIPELINE.map((step, i) => {
              const isDone   = safeIdx >= step.doneAt;
              const isActive = !isDone && safeIdx >= (i === 0 ? 1 : PIPELINE[i - 1]?.doneAt ?? 0);
              return (
                <div
                  key={step.label}
                  className={`pipeline-step-item${isDone ? ' done' : ''}${isActive ? ' active' : ''}`}
                >
                  <div className="pipeline-step-icon">{step.icon}</div>
                  <div className="pipeline-step-label">{step.label}</div>
                  <div className="pipeline-step-status">
                    {isDone ? '✓ Done' : isActive ? 'Running...' : 'Pending'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error block */}
        {error && (
          <div style={{
            marginTop: 20, padding: '16px 20px', borderRadius: 16,
            background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)',
            color: '#fca5a5', fontSize: '0.9rem', lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}
      </div>
    </>
  );
}
