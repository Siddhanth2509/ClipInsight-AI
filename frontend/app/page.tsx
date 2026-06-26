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

/* ── Page transition variants ─────────────────────────────────────────────── */
const sakuraVariants: Variants = {
  hidden:  { opacity: 0, y: 40, filter: 'blur(8px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  exit:    {
    opacity: 0, y: -30, filter: 'blur(6px)',
    transition: { duration: 0.4, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const childVariant: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

/* ── Feature list ─────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: '🎞', text: 'Frame Extraction',   jp: '映像抽出' },
  { icon: '🎙', text: 'Audio Transcription',jp: '音声転写' },
  { icon: '🧠', text: 'Gemini Vision AI',   jp: 'AI視覚' },
  { icon: '🎯', text: 'Hook Score',          jp: 'フック' },
  { icon: '📊', text: 'Sentiment Analysis',  jp: '感情分析' },
];

export default function Home() {
  const [appState,    setAppState]    = useState<AppState>('hero');
  const [jobId,       setJobId]       = useState('');
  const [result,      setResult]      = useState<any>(null);
  const [showBatch,   setShowBatch]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const cursorDotRef  = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);

  /* ── Custom cursor ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const dot  = cursorDotRef.current;
    const ring = cursorRingRef.current;
    if (!dot || !ring) return;

    let rafId: number;
    let ringX = 0, ringY = 0;
    let dotX  = 0, dotY  = 0;
    let mouseX = 0, mouseY = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const loop = () => {
      // Dot follows instantly
      dotX += (mouseX - dotX) * 0.9;
      dotY += (mouseY - dotY) * 0.9;
      dot.style.left  = `${dotX}px`;
      dot.style.top   = `${dotY}px`;

      // Ring follows with lag (magnetic feel)
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = `${ringX}px`;
      ring.style.top  = `${ringY}px`;

      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove);
    loop();
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  /* ── GSAP scroll intro on hero ──────────────────────────────────────────── */
  useEffect(() => {
    if (appState !== 'hero') return;
    const setup = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      // Reveal sections as they scroll into view
      gsap.utils.toArray<HTMLElement>('.gsap-reveal').forEach(el => {
        gsap.from(el, {
          opacity: 0, y: 50, duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none none' },
        });
      });
    };
    setup();
  }, [appState]);

  const handleJobCreated = (id: string) => { setJobId(id); setAppState('analyzing'); };
  const handleComplete   = (data: any)  => {
    setResult(data);
    setAppState('results');
    // Auto-save to localStorage history
    saveToHistory(data, jobId);
  };
  const handleReset      = ()           => { setJobId(''); setResult(null); setAppState('hero'); };

  return (
    <>
      {/* ── Custom cursor ─────────────────────────────────────────────────── */}
      <div ref={cursorDotRef}  className="cursor-dot" />
      <div ref={cursorRingRef} className="cursor-ring" />

      {/* ── Ambient orbs (pure CSS) ──────────────────────────────────────── */}
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

              {/* ── Navbar ────────────────────────────────────────────────── */}
              <nav className="sakura-nav">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: 'linear-gradient(135deg, #E8557A, #FFB7C5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 20px rgba(232,85,122,0.45)',
                    transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(-10deg) scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = '')}>
                    🌸
                  </div>
                  <div>
                    <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontWeight: 600, fontSize: '1.1rem' }}>
                      Clip<span className="sakura-text">Insight</span> AI
                    </span>
                    <div style={{ fontSize: '0.6rem', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 1 }}>
                      桜の知恵
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Batch comparison button */}
                  <button
                    onClick={() => setShowBatch(true)}
                    style={{
                      padding: '7px 16px', borderRadius: 10, fontSize: '0.78rem',
                      fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(255,183,197,0.08)',
                      border: '1px solid rgba(255,183,197,0.2)',
                      color: 'var(--sakura-blush, #FFB7C5)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,133,162,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,183,197,0.08)'; }}
                  >
                    ⚡ Compare
                  </button>
                  {/* History button */}
                  <button
                    onClick={() => setShowHistory(true)}
                    style={{
                      padding: '7px 16px', borderRadius: 10, fontSize: '0.78rem',
                      fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(255,183,197,0.08)',
                      border: '1px solid rgba(255,183,197,0.2)',
                      color: 'var(--sakura-blush, #FFB7C5)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,133,162,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,183,197,0.08)'; }}
                  >
                    📜 History
                  </button>
                  <span style={{
                    padding: '5px 14px', borderRadius: 100, fontSize: '0.7rem',
                    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: 'rgba(255,183,197,0.08)',
                    border: '1px solid rgba(255,183,197,0.2)',
                    color: 'var(--sakura-blush)',
                  }}>Beta</span>
                </div>
              </nav>

              {/* ── Hero ──────────────────────────────────────────────────── */}
              <section className="hero-section">
                {/* Ghost kanji background */}
                <div className="kanji-bg" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.04 }}>
                  映
                </div>

                <motion.div
                  className="hero-content"
                  variants={stagger}
                  initial="hidden" animate="visible">

                  <motion.div variants={childVariant}>
                    <div className="hero-eyebrow">
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#86efac', display: 'inline-block',
                        boxShadow: '0 0 8px #86efac',
                        animation: 'step-breathe 2s infinite',
                      }} />
                      Powered by Gemini 2.0 Flash  ·  桜咲く
                    </div>
                  </motion.div>

                  <motion.h1 className="hero-title" variants={childVariant}>
                    Every Frame<br />
                    <span className="sakura-text">Tells a Story</span>
                  </motion.h1>

                  <motion.p className="hero-subtitle" variants={childVariant}>
                    Drop a reel. Watch the petals fall. ClipInsight AI extracts every frame,
                    transcribes the audio, and delivers cinematic-grade insights in moments.
                  </motion.p>

                  <motion.div
                    variants={childVariant}
                    style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}>
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
                    style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {FEATURES.map(f => (
                      <div key={f.text} className="feature-pill"
                        title={f.jp}>
                        <span>{f.icon}</span>
                        <span>{f.text}</span>
                      </div>
                    ))}
                  </motion.div>
                </motion.div>

                {/* Scroll indicator */}
                <div style={{
                  position: 'absolute', bottom: 36, left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  color: 'var(--text-muted)', fontSize: '0.7rem',
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                  animation: 'orb-float 2s ease-in-out infinite alternate',
                }}>
                  <div style={{
                    width: 1, height: 40,
                    background: 'linear-gradient(180deg, transparent, rgba(255,183,197,0.4))',
                  }} />
                  scroll
                </div>
              </section>

              {/* ── About / How It Works ──────────────────────────────────── */}
              <section style={{ padding: '100px 48px', position: 'relative' }}>
                <div className="gsap-reveal" style={{ maxWidth: 1100, margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: 64 }}>
                    <div className="section-label" style={{ justifyContent: 'center' }}>
                      <div className="section-label-line" />
                      <span>How It Works</span>
                      <div className="section-label-line" />
                    </div>
                    <h2 className="section-title" style={{ fontSize: '2.8rem', textAlign: 'center' }}>
                      Three Steps to <span className="sakura-text">Clarity</span>
                    </h2>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                    {[
                      {
                        num: '01', kanji: '入',
                        title: 'Upload or Link',
                        desc: 'Drop any video file or paste a link from Instagram, YouTube, TikTok, or Twitter. Up to 200MB.',
                        icon: '🎬',
                        color: '#E8557A',
                      },
                      {
                        num: '02', kanji: '解',
                        title: 'AI Extracts & Understands',
                        desc: 'OpenCV samples key frames. Whisper transcribes every word. Gemini Vision reads the visual story.',
                        icon: '🧠',
                        color: '#FFB7C5',
                      },
                      {
                        num: '03', kanji: '咲',
                        title: 'Insights Bloom',
                        desc: 'Receive a full report — summary, hook score, sentiment, tags, audience, and improvement suggestions.',
                        icon: '🌸',
                        color: '#C9A96E',
                      },
                    ].map(step => (
                      <div key={step.num}
                        className="glass"
                        style={{
                          borderRadius: 24, padding: '32px 28px',
                          border: '1px solid rgba(255,183,197,0.08)',
                          position: 'relative', overflow: 'hidden',
                          transition: 'all 0.35s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'rgba(255,133,162,0.2)';
                          e.currentTarget.style.transform = 'translateY(-6px)';
                          e.currentTarget.style.boxShadow = '0 20px 60px rgba(232,85,122,0.12)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'rgba(255,183,197,0.08)';
                          e.currentTarget.style.transform = '';
                          e.currentTarget.style.boxShadow = '';
                        }}>
                        {/* Ghost kanji */}
                        <div style={{
                          position: 'absolute', bottom: -10, right: 16,
                          fontFamily: 'var(--font-display)',
                          fontSize: '6rem', fontWeight: 900,
                          color: 'rgba(255,183,197,0.05)',
                          lineHeight: 1, pointerEvents: 'none',
                        }}>{step.kanji}</div>

                        <div style={{ fontSize: '2.2rem', marginBottom: 16 }}>{step.icon}</div>
                        <div style={{
                          fontFamily: 'var(--font-heading)', fontStyle: 'italic',
                          fontSize: '0.75rem', fontWeight: 600,
                          letterSpacing: '0.12em', color: step.color,
                          marginBottom: 8,
                        }}>
                          Step {step.num}
                        </div>
                        <h3 style={{
                          fontFamily: 'var(--font-heading)', fontStyle: 'italic',
                          fontSize: '1.4rem', fontWeight: 600,
                          marginBottom: 12, color: 'var(--text-primary)',
                        }}>{step.title}</h3>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                          {step.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Upload Section ────────────────────────────────────────── */}
              <section id="upload" className="upload-section">
                <div className="gsap-reveal" style={{ maxWidth: 780, margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <div className="section-label" style={{ justifyContent: 'center' }}>
                      <div className="section-label-line" />
                      <span>Start Here</span>
                      <div className="section-label-line" />
                    </div>
                    <h2 className="section-title" style={{ textAlign: 'center' }}>
                      Let the <span className="sakura-text">Petals Fall</span>
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 10 }}>
                      桜の様に — Like the sakura, beauty reveals itself in motion
                    </p>
                  </div>
                  <UploadCard onJobCreated={handleJobCreated} />
                </div>
              </section>

              {/* ── Footer ───────────────────────────────────────────────── */}
              <footer style={{
                padding: '40px 48px',
                borderTop: '1px solid rgba(255,183,197,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 16,
              }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Clip<span className="sakura-text">Insight</span> AI
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 16 }}>
                    桜咲く · 2025
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Powered by Gemini 2.0 · Whisper · OpenCV
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

              <div style={{ textAlign: 'center', marginBottom: 56, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 80, height: 80, margin: '0 auto 24px',
                  background: 'linear-gradient(135deg, #E8557A, #FFB7C5)',
                  borderRadius: 24,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.2rem',
                  boxShadow: '0 0 60px rgba(232,85,122,0.5)',
                  animation: 'step-breathe 2s infinite',
                }}>🧠</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '2.4rem', fontWeight: 600, marginBottom: 10 }}>
                  AI is <span className="sakura-text">Awakening</span>
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '0.04em' }}>
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

      {/* ── Phase 4: Batch Comparison modal ────────────────────────────── */}
      {showBatch && <BatchAnalysis onClose={() => setShowBatch(false)} />}

      {/* ── Phase 4: History Panel (slide-in from right) ──────────────── */}
      <HistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onReplay={(id) => {
          setShowHistory(false);
          // For now just close — future: fetch cached result by jobId
        }}
      />
    </>
  );
}
