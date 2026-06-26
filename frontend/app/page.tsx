'use client';
import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import UploadCard from '@/components/UploadCard';
import AnalysisProgress from '@/components/AnalysisProgress';
import ResultsDashboard from '@/components/ResultsDashboard';
import BatchAnalysis from '@/components/BatchAnalysis';
import HistoryPanel, { saveToHistory } from '@/components/HistoryPanel';

const SakuraScene = lazy(() => import('@/components/ThreeBackground'));

type AppState = 'hero' | 'analyzing' | 'results';
type Theme = 'dark' | 'light';

/* ── Page transition variants ────────────────────────────────────────────── */
const sakuraVariants: Variants = {
  hidden:  { opacity: 0, y: 36, filter: 'blur(8px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  exit: {
    opacity: 0, y: -24, filter: 'blur(6px)',
    transition: { duration: 0.38, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.14 } },
};

const childVariant: Variants = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

/* ── Feature list ─────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: '🎞', text: 'Frame Extraction',    jp: '映像抽出' },
  { icon: '🎙', text: 'Audio Transcription', jp: '音声転写' },
  { icon: '🧠', text: 'Gemini Vision AI',    jp: 'AI視覚' },
  { icon: '🎯', text: 'Hook Score',           jp: 'フック' },
  { icon: '📊', text: 'Sentiment Analysis',  jp: '感情分析' },
];

export default function Home() {
  const [appState,    setAppState]    = useState<AppState>('hero');
  const [jobId,       setJobId]       = useState('');
  const [result,      setResult]      = useState<any>(null);
  const [showBatch,   setShowBatch]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [theme,       setTheme]       = useState<Theme>('dark');
  const cursorDotRef  = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);

  /* ── Theme persistence ──────────────────────────────────────────────── */
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

  /* ── Custom cursor ──────────────────────────────────────────────────── */
  useEffect(() => {
    const dot  = cursorDotRef.current;
    const ring = cursorRingRef.current;
    if (!dot || !ring) return;

    let rafId: number;
    let ringX = 0, ringY = 0;
    let dotX  = 0, dotY  = 0;
    let mouseX = 0, mouseY = 0;

    const onMove = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; };

    const loop = () => {
      dotX  += (mouseX - dotX)  * 0.92;
      dotY  += (mouseY - dotY)  * 0.92;
      dot.style.left = `${dotX}px`;
      dot.style.top  = `${dotY}px`;

      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = `${ringX}px`;
      ring.style.top  = `${ringY}px`;

      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove);
    loop();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafId); };
  }, []);

  /* ── GSAP scroll-reveal ─────────────────────────────────────────────── */
  useEffect(() => {
    if (appState !== 'hero') return;
    const setup = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      gsap.utils.toArray<HTMLElement>('.gsap-reveal').forEach(el => {
        gsap.from(el, {
          opacity: 0, y: 44, duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%', toggleActions: 'play none none none' },
        });
      });
    };
    setup();
  }, [appState]);

  const handleJobCreated = (id: string) => { setJobId(id); setAppState('analyzing'); };
  const handleComplete   = (data: any)  => { setResult(data); setAppState('results'); saveToHistory(data, jobId); };
  const handleReset      = ()           => { setJobId(''); setResult(null); setAppState('hero'); };

  return (
    <>
      {/* ── Custom cursor ───────────────────────────────────────────────── */}
      <div ref={cursorDotRef}  className="cursor-dot" />
      <div ref={cursorRingRef} className="cursor-ring" />

      {/* ── Washi paper texture (subtle grain) ─────────────────────────── */}
      <div className="washi-texture" aria-hidden="true" />

      {/* ── Ambient orbs (pure CSS) ─────────────────────────────────────── */}
      <div className="amb-orb amb-orb-1" />
      <div className="amb-orb amb-orb-2" />
      <div className="amb-orb amb-orb-3" />

      {/* ── Three.js sakura scene ────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <SakuraScene />
      </Suspense>

      <div className="app-wrapper">
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════════════
              HERO PAGE
              ════════════════════════════════════════════════════════════════ */}
          {appState === 'hero' && (
            <motion.div
              key="hero"
              variants={sakuraVariants}
              initial="hidden" animate="visible" exit="exit">

              {/* ── Navbar ─────────────────────────────────────────────── */}
              <nav className="sakura-nav">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Logo mark */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--grad-sakura)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem',
                    boxShadow: '0 4px 16px rgba(155,59,82,0.4)',
                    transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(-10deg) scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = '')}>
                    🌸
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontWeight: 600, fontSize: '1.08rem', color: 'var(--text-primary)' }}>
                      Clip<span className="sakura-text">Insight</span> AI
                    </div>
                    <div style={{ fontSize: '0.58rem', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 1 }}>
                      桜の知恵
                    </div>
                  </div>
                </div>

                {/* Nav right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setShowBatch(true)}
                    style={{
                      padding: '7px 15px', borderRadius: 'var(--r-sm)', fontSize: '0.77rem',
                      fontWeight: 600, cursor: 'none', fontFamily: 'var(--font-body)',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--sakura-blush)',
                      transition: 'all 0.22s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--glass-border-bright)'; e.currentTarget.style.background = 'var(--glass-elevated-bg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.background = 'var(--glass-bg)'; }}>
                    ⚡ Compare
                  </button>
                  <button
                    onClick={() => setShowHistory(true)}
                    style={{
                      padding: '7px 15px', borderRadius: 'var(--r-sm)', fontSize: '0.77rem',
                      fontWeight: 600, cursor: 'none', fontFamily: 'var(--font-body)',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--sakura-blush)',
                      transition: 'all 0.22s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--glass-border-bright)'; e.currentTarget.style.background = 'var(--glass-elevated-bg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.background = 'var(--glass-bg)'; }}>
                    📜 History
                  </button>
                  {/* Theme toggle */}
                  <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    aria-label="Toggle theme">
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </button>
                  <span style={{
                    padding: '5px 12px', borderRadius: 'var(--r-full)', fontSize: '0.68rem',
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--gold)',
                    fontFamily: 'var(--font-ui)',
                  }}>Beta</span>
                </div>

                {/* Thin torii accent on nav bottom-center */}
                <div className="nav-torii-line" />
              </nav>

              {/* ── Hero ─────────────────────────────────────────────── */}
              <section className="hero-section">
                {/* Ghost kanji watermark */}
                <div className="kanji-bg" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.035 }}>映</div>

                <motion.div
                  className="hero-content"
                  variants={stagger}
                  initial="hidden" animate="visible">

                  {/* Eyebrow badge */}
                  <motion.div variants={childVariant}>
                    <div className="hero-eyebrow">
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#6EE7B7', display: 'inline-block',
                        boxShadow: '0 0 8px #6EE7B7',
                        animation: 'step-breathe 3s infinite',
                      }} />
                      Powered by Gemini 2.0 Flash  ·  桜咲く
                    </div>
                  </motion.div>

                  {/* Main title */}
                  <motion.h1 className="hero-title" variants={childVariant}>
                    Every Frame<br />
                    <span className="sakura-text">Tells a Story</span>
                  </motion.h1>

                  {/* Gold accent line beneath title */}
                  <motion.div variants={childVariant}>
                    <div className="hero-title-accent" />
                  </motion.div>

                  {/* Subtitle */}
                  <motion.p className="hero-subtitle" variants={childVariant}>
                    Drop a reel. Watch the petals fall. ClipInsight AI extracts every frame,
                    transcribes the audio, and delivers cinematic-grade insights in moments.
                  </motion.p>

                  {/* CTA buttons */}
                  <motion.div
                    variants={childVariant}
                    style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
                    <button
                      className="btn-sakura"
                      onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}>
                      🌸 Begin Analysis
                    </button>
                    <button className="btn-ghost-sakura">
                      Watch Demo ▶
                    </button>
                  </motion.div>

                  {/* Feature pills */}
                  <motion.div
                    variants={childVariant}
                    style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {FEATURES.map(f => (
                      <div key={f.text} className="feature-pill" title={f.jp}>
                        <span>{f.icon}</span>
                        <span>{f.text}</span>
                      </div>
                    ))}
                  </motion.div>
                </motion.div>

                {/* Scroll indicator */}
                <div className="scroll-indicator">
                  <div className="scroll-indicator-line" />
                  scroll
                </div>
              </section>

              {/* ── How It Works ─────────────────────────────────────── */}
              <section style={{ padding: '100px 48px', position: 'relative' }}>
                <div className="gsap-reveal" style={{ maxWidth: 1100, margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: 60 }}>
                    <div className="section-label" style={{ justifyContent: 'center' }}>
                      <div className="section-label-line" />
                      <span>How It Works</span>
                      <div className="section-label-line right" />
                    </div>
                    <h2 className="section-title" style={{ textAlign: 'center' }}>
                      Three Steps to <span className="sakura-text">Clarity</span>
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 8, fontFamily: 'var(--font-ui)' }}>
                      三つの道 — The way of three
                    </p>
                  </div>

                  <div className="feature-grid">
                    {[
                      { num: '01', kanji: '入', title: 'Upload or Link',         desc: 'Drop any video file or paste a link from Instagram, YouTube, TikTok, or Twitter. Up to 200MB.', icon: '🎬', color: 'var(--sakura-bloom)' },
                      { num: '02', kanji: '解', title: 'AI Extracts & Understands', desc: 'OpenCV samples key frames. Whisper transcribes every word. Gemini Vision reads the visual story.', icon: '🧠', color: 'var(--gold)' },
                      { num: '03', kanji: '咲', title: 'Insights Bloom',         desc: 'Receive a full report — summary, hook score, sentiment, tags, audience, and improvement suggestions.', icon: '🌸', color: 'var(--jade)' },
                    ].map(step => (
                      <div key={step.num} className="feature-card">
                        <div className="feature-card-kanji">{step.kanji}</div>
                        <div style={{ fontSize: '2rem', marginBottom: 16 }}>{step.icon}</div>
                        <div className="feature-card-number">Step {step.num}</div>
                        <h3 style={{
                          fontFamily: 'var(--font-heading)', fontStyle: 'italic',
                          fontSize: '1.35rem', fontWeight: 600,
                          marginBottom: 10, color: 'var(--text-primary)',
                        }}>{step.title}</h3>
                        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.75, fontFamily: 'var(--font-ui)' }}>
                          {step.desc}
                        </p>
                        {/* Bottom accent bar */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '2px',
                          background: step.color === 'var(--sakura-bloom)' ? 'var(--grad-sakura)' :
                                      step.color === 'var(--gold)' ? 'var(--grad-gold)' :
                                      'linear-gradient(90deg, #3D7A6A, #5E9B8A)',
                          opacity: 0.5, borderRadius: '1px',
                          transition: 'opacity 0.3s ease',
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Upload Section ──────────────────────────────────── */}
              <section id="upload" className="upload-section">
                <div className="gsap-reveal" style={{ maxWidth: 780, margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: 44 }}>
                    <div className="section-label" style={{ justifyContent: 'center' }}>
                      <div className="section-label-line" />
                      <span>Start Here</span>
                      <div className="section-label-line right" />
                    </div>
                    <h2 className="section-title" style={{ textAlign: 'center' }}>
                      Let the <span className="sakura-text">Petals Fall</span>
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 10, fontFamily: 'var(--font-ui)' }}>
                      桜の様に — Like the sakura, beauty reveals itself in motion
                    </p>
                  </div>
                  <UploadCard onJobCreated={handleJobCreated} />
                </div>
              </section>

              {/* ── Footer ──────────────────────────────────────────── */}
              <footer style={{
                padding: '36px 48px',
                borderTop: '1px solid var(--glass-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Clip<span className="sakura-text">Insight</span> AI
                  </span>
                  <span style={{ color: 'var(--glass-border-bright)', fontSize: '0.7rem' }}>·</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-ui)' }}>桜咲く · 2025</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="gold-text" style={{ fontWeight: 600 }}>Gemini 2.0</span>
                  <span style={{ color: 'var(--glass-border-bright)' }}>·</span>
                  Whisper · OpenCV
                </div>
              </footer>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ANALYZING PAGE
              ════════════════════════════════════════════════════════════════ */}
          {appState === 'analyzing' && (
            <motion.div
              key="analyzing"
              variants={sakuraVariants}
              initial="hidden" animate="visible" exit="exit"
              style={{
                minHeight: '100vh', display: 'flex',
                flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '80px 24px',
              }}>

              {/* Ghost kanji */}
              <div className="kanji-bg" style={{
                top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                fontSize: '55vw', opacity: 0.025,
              }}>知</div>

              <div style={{ textAlign: 'center', marginBottom: 52, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 76, height: 76, margin: '0 auto 22px',
                  background: 'var(--grad-sakura)',
                  borderRadius: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem',
                  boxShadow: '0 0 50px rgba(155,59,82,0.45)',
                  animation: 'step-breathe 3s infinite',
                }}>🧠</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '2.2rem', fontWeight: 600, marginBottom: 10 }}>
                  AI is <span className="sakura-text">Awakening</span>
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>
                  知識の花が咲く — The flower of knowledge blooms
                </p>
              </div>

              <AnalysisProgress jobId={jobId} onComplete={handleComplete} />
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              RESULTS PAGE
              ════════════════════════════════════════════════════════════════ */}
          {appState === 'results' && (
            <motion.div
              key="results"
              variants={sakuraVariants}
              initial="hidden" animate="visible" exit="exit"
              style={{ paddingTop: 60 }}>
              <ResultsDashboard result={result} jobId={jobId} onReset={handleReset} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Batch Comparison modal ──────────────────────────────────────── */}
      {showBatch && <BatchAnalysis onClose={() => setShowBatch(false)} />}

      {/* ── History Panel ───────────────────────────────────────────────── */}
      <HistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onReplay={(id) => { setShowHistory(false); }}
      />
    </>
  );
}
