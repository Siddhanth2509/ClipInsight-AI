'use client';
import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import UploadCard from '@/components/UploadCard';
import AnalysisProgress from '@/components/AnalysisProgress';
import ResultsDashboard from '@/components/ResultsDashboard';
import BatchAnalysis from '@/components/BatchAnalysis';
import HistoryPanel, { saveToHistory } from '@/components/HistoryPanel';

const SakuraScene   = lazy(() => import('@/components/ThreeBackground'));
const NodeNetwork   = lazy(() => import('@/components/NodeNetwork'));

type AppState = 'hero' | 'analyzing' | 'results';
type Theme = 'dark' | 'light';

const pageVariants: Variants = {
  hidden:  { opacity: 0, y: 28, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)',  transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] as any } },
  exit:    { opacity: 0, y: -18, filter: 'blur(6px)', transition: { duration: 0.32 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.10 } } };
const child: Variants   = {
  hidden:  { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as any } },
};

const BENTO_FEATURES = [
  {
    icon: '&#x1F39E;', label: 'Frame Engine', title: 'Cinema-Grade\nExtraction',
    desc: 'OpenCV samples every 3 seconds, capturing the sharpest key frames for AI analysis.',
    stat: '60fps', statLabel: 'Precision', pingTop: '18px', pingLeft: '18px',
  },
  {
    icon: '&#x1F399;', label: 'Audio AI', title: 'Whisper\nTranscription',
    desc: 'OpenAI Whisper converts dialogue into full, timestamped text in seconds.',
    stat: '99%', statLabel: 'Accuracy', pingTop: '18px', pingLeft: '18px',
  },
];

// Simple counter hook
function useCounter(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        obs.disconnect();
        let start = 0;
        const step = Math.ceil(target / (duration / 16));
        const timer = setInterval(() => {
          start = Math.min(start + step, target);
          setCount(start);
          if (start >= target) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return { count, ref };
}

function StatCounter({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const { count, ref } = useCounter(value);
  return (
    <div ref={ref} className="stat-counter">
      <div className="stat-counter-val">{count.toLocaleString()}{suffix}</div>
      <div className="stat-counter-lbl">{label}</div>
    </div>
  );
}

export default function Home() {
  const [appState,    setAppState]    = useState<AppState>('hero');
  const [jobId,       setJobId]       = useState('');
  const [result,      setResult]      = useState<any>(null);
  const [showBatch,   setShowBatch]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [theme,       setTheme]       = useState<Theme>('dark');
  const cursorDotRef  = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (localStorage.getItem('ci-theme') as Theme) || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ci-theme', next);
  };

  /* Custom cursor */
  useEffect(() => {
    const dot  = cursorDotRef.current;
    const ring = cursorRingRef.current;
    if (!dot || !ring) return;
    let rafId: number;
    let rx = 0, ry = 0, dx = 0, dy = 0, mx = 0, my = 0;
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const loop = () => {
      dx += (mx - dx) * 0.95; dy += (my - dy) * 0.95;
      dot.style.left = `${dx}px`; dot.style.top = `${dy}px`;
      rx += (mx - rx) * 0.10;   ry += (my - ry) * 0.10;
      ring.style.left = `${rx}px`; ring.style.top = `${ry}px`;
      rafId = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    loop();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafId); };
  }, []);

  const handleJobCreated = (id: string) => { setJobId(id); setAppState('analyzing'); };
  const handleComplete   = (data: any)  => { setResult(data); setAppState('results'); saveToHistory(data, jobId); };
  const handleReset      = ()           => { setJobId(''); setResult(null); setAppState('hero'); };

  const NavBar = ({ showBack }: { showBack?: boolean }) => (
    <nav className="nav-bento">
      <div className="nav-logo">
        <div className="nav-logo-mark">&#x1F338;</div>
        <div>
          <div className="nav-logo-name">Clip<span className="sakura-text">Insight</span> AI</div>
          <div className="nav-logo-sub">&#26716;&#12398;&#30693;&#24913;</div>
        </div>
      </div>
      <div className="nav-pills">
        {showBack ? (
          <button className="nav-pill" onClick={handleReset}>&larr; New Analysis</button>
        ) : (
          <>
            <button className="nav-pill active">Analyze</button>
            <button className="nav-pill" onClick={() => setShowBatch(true)}>Compare</button>
            <button className="nav-pill" onClick={() => setShowHistory(true)}>History</button>
          </>
        )}
      </div>
      <div className="nav-actions">
        <button className="nav-theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '\u2600' : '\uD83C\uDF19'}
        </button>
        <span className="nav-beta-badge">Beta</span>
      </div>
    </nav>
  );

  return (
    <>
      {/* ── Web3 background layers ── */}
      <div className="grid-overlay" />
      <div className="dot-grid-bg" />
      <div className="scan-line" />

      {/* ── Custom cursor ── */}
      <div ref={cursorDotRef}  className="cursor-dot" />
      <div ref={cursorRingRef} className="cursor-ring" />

      {/* ── Ambient orbs ── */}
      <div className="amb-orb amb-orb-1" />
      <div className="amb-orb amb-orb-2" />
      <div className="amb-orb amb-orb-3" />

      {/* ── Background canvases ── */}
      <Suspense fallback={null}>
        <SakuraScene />
      </Suspense>
      <Suspense fallback={null}>
        <NodeNetwork />
      </Suspense>

      <AnimatePresence mode="wait">

        {/* ══════════ HERO ══════════ */}
        {appState === 'hero' && (
          <motion.div key="hero" variants={pageVariants} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'relative', zIndex: 2, minHeight: '100vh' }}>

            <NavBar />

            {/* Hero */}
            <section className="hero-bento">
              {/* Glassmorphism sphere — with expanding rings */}
              <div className="hero-sphere" style={{ position: 'relative' }}>
                <div className="sphere-hex-ring" />
                <div className="sphere-hex-ring" />
                <div className="sphere-hex-ring" />
              </div>

              {/* Outline Kanji */}
              <div className="hero-kanji-right">&#26144;</div>

              {/* Vertical Japanese strip */}
              <div className="hero-vertical-text">
                &#12463;&#12522;&#12483;&#12503;&#12452;&#12531;&#12469;&#12452;&#12488;&#12539;AI&#12539;&#26144;&#20687;&#12398;&#30693;&#24913;&#12539;&#26716;&#20241;&#12367;
              </div>

              {/* Editorial headline */}
              <motion.div className="hero-headline-wrap" variants={stagger} initial="hidden" animate="visible">
                <motion.div variants={child}>
                  <div className="hero-eyebrow">
                    <div className="hero-eyebrow-dot" />
                    Powered by Gemini 2.0 Flash &middot; &#26716;&#21056;&#12367;
                  </div>
                </motion.div>

                <motion.h1 className="hero-title" variants={child}>
                  Every Frame<br />
                  <span className="hero-title-accent">Tells a Story</span>
                  <span className="type-cursor" />
                </motion.h1>

                <motion.p className="hero-sub" variants={child}>
                  Drop any reel. ClipInsight AI extracts key frames, transcribes every word,
                  and delivers cinematic-grade insights &mdash; in seconds.
                </motion.p>

                {/* Web3-style stat counters */}
                <motion.div variants={child} className="stat-counter-row">
                  <StatCounter value={12847} label="Reels Analyzed" suffix="+" />
                  <StatCounter value={99}    label="Accuracy"        suffix="%" />
                  <StatCounter value={3}     label="Sec Avg. Time"   suffix="s" />
                </motion.div>

                <motion.div className="hero-cta-row" variants={child} style={{ marginTop: 28 }}>
                  <button className="btn-fusion"
                    onClick={() => document.getElementById('bento')?.scrollIntoView({ behavior: 'smooth' })}>
                    &#x1F338; Begin Analysis
                  </button>
                  <button className="btn-ghost">Watch Demo &#9654;</button>
                </motion.div>
              </motion.div>
            </section>

            {/* ══════════ BENTO GRID ══════════ */}
            <section id="bento" className="bento-section">
              <div className="bento-grid">

                {/* Main tall left card */}
                <motion.div className="bento-card bento-main"
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
                  {/* Corner dots */}
                  <div className="bento-corner-dot tl" />
                  <div className="bento-corner-dot tr" />
                  <div className="bento-corner-dot bl" />
                  <div className="bento-corner-dot br" />

                  <div className="bento-main-kanji">&#35299;</div>
                  <div>
                    <div className="bento-brand-tag">&#x1F9E0; ClipInsight AI</div>
                    <h2 className="bento-main-title">
                      AI That Reads<br />
                      Between the <span className="electric-text">Frames</span>
                    </h2>
                    <p className="bento-main-desc">
                      Our multi-model pipeline combines computer vision, speech recognition,
                      and large language models to uncover what makes a video truly work.
                      Hook scores, sentiment arcs, audience fit &mdash; all from a single drop.
                    </p>
                  </div>
                  <div>
                    {/* Data line accent */}
                    <div className="data-line" />
                    <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tx-3)', fontFamily: 'var(--font-ui)', marginBottom: 10 }}>
                      Pipeline
                    </div>
                    <div className="bento-step-dots">
                      {['\u2B06', '\uD83C\uDF9E', '\uD83C\uDF99', '\uD83E\uDDE0', '\uD83C\uDF38'].map((icon, i) => (
                        <div key={i} className={`bento-step-dot${i < 3 ? ' active' : ''}`} style={{ fontSize: '0.8rem' }}>
                          {icon}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Feature cards */}
                {BENTO_FEATURES.map((feat, idx) => (
                  <motion.div key={feat.label}
                    className="bento-card bento-sm"
                    style={{ gridColumn: 2, gridRow: idx + 1, position: 'relative' }}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.75, delay: idx * 0.12, ease: [0.22, 1, 0.36, 1] }}>
                    {/* Node ping dot */}
                    <div className="node-ping" style={{ top: feat.pingTop, left: feat.pingLeft }} />

                    <div>
                      <div className="bento-sm-icon" dangerouslySetInnerHTML={{ __html: feat.icon }} />
                      <div className="bento-sm-label">{feat.label}</div>
                      <div className="bento-sm-title" style={{ whiteSpace: 'pre-line' }}>{feat.title}</div>
                      <p className="bento-sm-desc">{feat.desc}</p>
                    </div>
                    <div className="bento-sm-stat">
                      <div className="bento-sm-stat-val">{feat.stat}</div>
                      <div className="bento-sm-stat-lbl">{feat.statLabel}</div>
                    </div>
                  </motion.div>
                ))}

                {/* Upload card */}
                <motion.div className="bento-card bento-upload-card"
                  style={{ gridColumn: 3, gridRow: '1 / 3', position: 'relative' }}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
                  {/* Corner dots */}
                  <div className="bento-corner-dot tl" />
                  <div className="bento-corner-dot tr" />
                  {/* Node ping */}
                  <div className="node-ping" style={{ top: '18px', right: '18px', left: 'auto' }} />

                  <div className="bento-upload-header">
                    <div className="bento-upload-icon">&#x1F338;</div>
                    <div className="bento-upload-title">
                      Let the <span className="sakura-text">Petals Fall</span>
                    </div>
                    <div className="bento-upload-sub">Upload or paste &middot; AI insights in seconds</div>
                  </div>
                  <div className="data-line" style={{ margin: '12px 0' }} />
                  <UploadCard onJobCreated={handleJobCreated} />
                </motion.div>

              </div>
            </section>

            {/* Footer */}
            <footer style={{
              padding: '30px 60px', marginTop: 20,
              borderTop: '1px solid var(--gl-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 12, position: 'relative', zIndex: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', color: 'var(--tx-2)', fontSize: '0.9rem' }}>
                  Clip<span className="sakura-text">Insight</span> AI
                </span>
                <span style={{ color: 'var(--tx-3)', fontSize: '0.7rem', fontFamily: 'var(--font-ui)' }}>
                  &#26716;&#21056;&#12367; &middot; 2025
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--tx-3)', fontFamily: 'var(--font-ui)' }}>
                <span className="electric-text" style={{ fontWeight: 600 }}>Gemini 2.0 Flash</span>
                <span>&middot;</span>Whisper &middot; OpenCV
              </div>
            </footer>
          </motion.div>
        )}

        {/* ══════════ ANALYZING ══════════ */}
        {appState === 'analyzing' && (
          <motion.div key="analyzing" variants={pageVariants} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'relative', zIndex: 2 }}>
            <NavBar />
            <div className="progress-section">
              <div className="kanji-bg" style={{ top:'50%', left:'50%', transform:'translate(-50%,-50%)', opacity:0.025 }}>&#30693;</div>
              <div style={{ maxWidth: 700, width: '100%', position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: 52 }}>
                  <div style={{
                    width: 76, height: 76, margin: '0 auto 22px',
                    background: 'var(--grad-fusion)', borderRadius: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                    boxShadow: '0 0 50px rgba(124,58,237,0.45)',
                    animation: 'step-breathe 3s infinite',
                  }}>&#x1F9E0;</div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '2.2rem', fontWeight: 600, marginBottom: 10 }}>
                    AI is <span className="electric-text">Awakening</span>
                  </h2>
                  <p style={{ color: 'var(--tx-2)', fontSize: '0.88rem', letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>
                    &#30693;&#35672;&#12398;&#33457;&#12364;&#21056;&#12367; &mdash; The flower of knowledge blooms
                  </p>
                </div>
                <AnalysisProgress jobId={jobId} onComplete={handleComplete} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════ RESULTS ══════════ */}
        {appState === 'results' && (
          <motion.div key="results" variants={pageVariants} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'relative', zIndex: 2 }}>
            <NavBar showBack />
            <div style={{ paddingTop: 70 }}>
              <ResultsDashboard result={result} jobId={jobId} onReset={handleReset} />
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {showBatch    && <BatchAnalysis onClose={() => setShowBatch(false)} />}
      <HistoryPanel  isOpen={showHistory} onClose={() => setShowHistory(false)} onReplay={() => setShowHistory(false)} />
    </>
  );
}
