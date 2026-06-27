'use client';
import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import UploadCard from '@/components/UploadCard';
import AnalysisProgress from '@/components/AnalysisProgress';
import ResultsDashboard from '@/components/ResultsDashboard';
import HistoryPanel, { saveToHistory } from '@/components/HistoryPanel';
import PipelineAnimation from '@/components/PipelineAnimation';

const NodeNetwork = lazy(() => import('@/components/NodeNetwork'));

type AppState = 'hero' | 'analyzing' | 'results';

const fade = {
  hidden:  { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.22,1,0.36,1] as any } },
  exit:    { opacity: 0, y: -16, filter: 'blur(6px)', transition: { duration: 0.3 } },
};
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

const CAPABILITIES = [
  { icon: '🎞', title: 'Frame Intelligence', desc: 'OpenCV extracts key frames every 3 seconds. Vision AI reads scenes, text, and objects with cinematic precision.', stat: '60fps', statLabel: 'Processing', color: '#7C5CFC' },
  { icon: '🎙', title: 'Speech Recognition', desc: 'OpenAI Whisper transcribes every word with timestamps — dialogue, voiceover, ambient audio.', stat: '99%', statLabel: 'Accuracy', color: '#3DD9FF' },
  { icon: '🧠', title: 'LLM Reasoning', desc: 'Gemini 2.0 Flash synthesizes all signals into actionable insights: hook scores, sentiment arcs, audience fit.', stat: '<3s', statLabel: 'Response', color: '#57D98D' },
  { icon: '📈', title: 'Trend Analysis', desc: 'Cross-reference your content against viral patterns. Understand why some reels explode and others don\'t.', stat: '10M+', statLabel: 'Data Points', color: '#F5C96A' },
];

const TECH_STACK = [
  { name: 'Gemini 2.0', role: 'LLM Core',     color: '#7C5CFC' },
  { name: 'Whisper',    role: 'Speech AI',     color: '#3DD9FF' },
  { name: 'OpenCV',     role: 'Vision',        color: '#57D98D' },
  { name: 'Next.js 16', role: 'Frontend',      color: '#F8FAFC' },
  { name: 'FastAPI',    role: 'Backend',       color: '#F5C96A' },
  { name: 'FFmpeg',     role: 'Media Engine',  color: '#9B7BFD' },
];

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let n = 0;
      const step = Math.ceil(target / 60);
      const t = setInterval(() => {
        n = Math.min(n + step, target);
        setVal(n);
        if (n >= target) clearInterval(t);
      }, 24);
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <div ref={ref}>{val.toLocaleString()}{suffix}</div>;
}

export default function Home() {
  const [state,       setState]       = useState<AppState>('hero');
  const [jobId,       setJobId]       = useState('');
  const [result,      setResult]      = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [urlInput,    setUrlInput]    = useState('');
  const [pipeRunning, setPipeRunning] = useState(false);
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  /* Custom cursor */
  useEffect(() => {
    const dot = dotRef.current, ring = ringRef.current;
    if (!dot || !ring) return;
    let raf: number, rx = 0, ry = 0, dx = 0, dy = 0, mx = 0, my = 0;
    const mv = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const loop = () => {
      dx += (mx - dx) * 0.9; dy += (my - dy) * 0.9;
      dot.style.left = `${dx}px`; dot.style.top = `${dy}px`;
      rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
      ring.style.left = `${rx}px`; ring.style.top = `${ry}px`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', mv);
    loop();
    return () => { window.removeEventListener('mousemove', mv); cancelAnimationFrame(raf); };
  }, []);

  const startAnalysis = (id: string) => { setJobId(id); setState('analyzing'); };
  const onComplete    = (data: any)  => { setResult(data); setState('results'); saveToHistory(data, jobId); };
  const reset         = ()           => { setJobId(''); setResult(null); setState('hero'); setPipeRunning(false); };

  const handleHeroAnalyze = () => {
    if (!urlInput.trim()) return;
    document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const Nav = ({ back }: { back?: boolean }) => (
    <nav className="nav">
      <div className="nav-logo">
        <div className="nav-logo-icon">✦</div>
        <span className="nav-logo-text">Clip<span>Insight</span> AI</span>
      </div>
      {!back && (
        <div className="nav-links">
          <button className="nav-link active">Analyze</button>
          <button className="nav-link" onClick={() => setShowHistory(true)}>History</button>
          <button className="nav-link" onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })}>Features</button>
          <button className="nav-link" onClick={() => document.getElementById('tech')?.scrollIntoView({ behavior: 'smooth' })}>Stack</button>
        </div>
      )}
      <div className="nav-cta">
        {back
          ? <button className="btn btn-secondary" onClick={reset} style={{ padding: '8px 18px', fontSize: '0.82rem' }}>← New Analysis</button>
          : <span className="nav-badge">Beta · Free</span>
        }
      </div>
    </nav>
  );

  return (
    <>
      {/* Background layers */}
      <div className="bg-layer-glows">
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />
        <div className="bg-glow bg-glow-3" />
      </div>
      <div className="bg-grid" />
      <div className="bg-dots" />
      <div className="scan-line" />

      {/* Node network canvas */}
      <Suspense fallback={null}>
        <NodeNetwork />
      </Suspense>

      {/* Custom cursor */}
      <div ref={dotRef}  className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />

      <AnimatePresence mode="wait">

        {/* ══════════ HERO ══════════ */}
        {state === 'hero' && (
          <motion.div key="hero" variants={fade} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'relative', zIndex: 2 }}>
            <Nav />

            <section className="hero" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
              {/* Right orb visual */}
              <div className="hero-orb-scene" aria-hidden>
                <div className="orb-ring" />
                <div className="orb-ring" />
                <div className="orb-ring" />
                <div className="hero-orb" />
                {/* Floating stat cards */}
                <div className="hero-stat-float" style={{ top: '22%', left: '6%' }}>
                  <div className="float-stat-val"><Counter target={12800} suffix="+" /></div>
                  <div className="float-stat-lbl">Reels Analyzed</div>
                </div>
                <div className="hero-stat-float" style={{ bottom: '28%', left: '4%' }}>
                  <div className="float-stat-val"><Counter target={99} suffix="%" /></div>
                  <div className="float-stat-lbl">Accuracy</div>
                </div>
                <div className="hero-stat-float" style={{ top: '28%', right: '6%' }}>
                  <div className="float-stat-val" style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg,#7C5CFC,#3DD9FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>&lt;3s</div>
                  <div className="float-stat-lbl">Avg. Analysis</div>
                </div>
              </div>

              <motion.div variants={stagger} initial="hidden" animate="visible"
                style={{ position: 'relative', zIndex: 1, maxWidth: 620, textAlign: 'left' }}>

                <motion.div variants={fade}>
                  <div className="hero-badge">
                    <div className="hero-badge-dot" />
                    Powered by Gemini 2.0 Flash · Now in Beta
                  </div>
                </motion.div>

                <motion.h1 className="hero-title" variants={fade}>
                  Turn Any Reel Into<br />
                  <span className="accent-cyan">AI Intelligence</span>
                </motion.h1>

                <motion.p className="hero-sub" variants={fade} style={{ marginLeft: 0, marginRight: 0, textAlign: 'left' }}>
                  Paste a YouTube Short, Instagram Reel, or TikTok link.
                  Our multi-model AI pipeline extracts frames, transcribes speech,
                  detects emotion, and delivers a cinematic-grade intelligence report — in seconds.
                </motion.p>

                {/* Hero URL input */}
                <motion.div variants={fade} className="hero-input-wrap">
                  <input
                    className="hero-input"
                    placeholder="https://www.instagram.com/reel/..."
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleHeroAnalyze()}
                  />
                  <button className="hero-input-btn" onClick={handleHeroAnalyze}>
                    Analyze Now <span className="btn-arrow">→</span>
                  </button>
                </motion.div>

                <motion.div variants={fade} className="hero-sub-links" style={{ justifyContent: 'flex-start' }}>
                  <span>✓ No account needed</span>
                  <span>✓ Free to use</span>
                  <span>✓ Results in &lt;3 seconds</span>
                </motion.div>
              </motion.div>
            </section>

            {/* ══════ PIPELINE SECTION ══════ */}
            <section style={{ position: 'relative', zIndex: 2, padding: '0 40px 80px' }}>
              <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div className="section-label">AI Workflow</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h2 className="section-title" style={{ marginBottom: 0 }}>
                    11-Step Intelligence Pipeline
                  </h2>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '8px 16px' }}
                    onClick={() => setPipeRunning(r => !r)}
                  >
                    {pipeRunning ? '⏹ Stop' : '▶ Preview Pipeline'}
                  </button>
                </div>
                <p className="section-sub" style={{ marginBottom: 0 }}>
                  Every analysis runs through our full model stack simultaneously.
                </p>
                <div className="card" style={{ marginTop: 24, padding: '8px 24px' }}>
                  <div className="card-inner-glow" />
                  <PipelineAnimation isRunning={pipeRunning} onComplete={() => setTimeout(() => setPipeRunning(false), 800)} />
                </div>
              </div>
            </section>

            {/* ══════ UPLOAD / ANALYZE SECTION ══════ */}
            <section id="upload-section" style={{ position: 'relative', zIndex: 2, padding: '0 40px 96px' }}>
              <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div className="section-label">Start Analyzing</div>
                <h2 className="section-title">Drop Your Content</h2>
                <p className="section-sub" style={{ marginBottom: 40 }}>
                  Upload a video file or paste a social media link. The AI handles everything else.
                </p>
                <div className="analysis-panel">
                  <div className="data-line" />
                  <div style={{ position: 'absolute', top: 20, right: 20 }}>
                    <div className="node-ping" />
                  </div>
                  <UploadCard onJobCreated={startAnalysis} />
                </div>
              </div>
            </section>

            {/* ══════ CAPABILITIES BENTO ══════ */}
            <section id="capabilities" style={{ position: 'relative', zIndex: 2, padding: '0 40px 96px' }}>
              <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div className="section-label">AI Capabilities</div>
                <h2 className="section-title">What the AI Reads</h2>
                <p className="section-sub" style={{ marginBottom: 40 }}>
                  Every frame, every word, every emotion — analyzed simultaneously.
                </p>

                {/* 2x2 + 1 wide bento */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 16 }}>

                  {/* Large hero card */}
                  <motion.div className="card" style={{ gridColumn: 1, gridRow: '1 / 3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360 }}
                    initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.22,1,0.36,1] }}>
                    <div className="card-inner-glow" />
                    <div className="card-corner-tl" /><div className="card-corner-br" />
                    <div>
                      <div className="capability-icon" style={{ background: 'rgba(124,92,252,0.12)', borderColor: 'rgba(124,92,252,0.25)', fontSize: '1.8rem', width: 64, height: 64 }}>🧠</div>
                      <div className="capability-title" style={{ fontSize: '1.5rem' }}>Full-Spectrum<br />Content Intelligence</div>
                      <p className="capability-desc" style={{ marginTop: 12, fontSize: '0.95rem', lineHeight: 1.75, maxWidth: 360 }}>
                        ClipInsight runs 11 AI models in parallel — vision, speech, emotion, music, OCR, and trend analysis — converging into a single intelligence report that tells you exactly what works and why.
                      </p>
                    </div>
                    <div>
                      <div className="data-line" />
                      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        {[{ v: '11', l: 'AI Models' }, { v: '<3s', l: 'Speed' }, { v: '99%', l: 'Accuracy' }].map(s => (
                          <div key={s.l}>
                            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(135deg, #7C5CFC, #3DD9FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.v}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Small cards */}
                  {CAPABILITIES.slice(0,4).map((cap, i) => (
                    <motion.div key={cap.title} className="card"
                      style={{ gridColumn: i < 2 ? 2 : 3, gridRow: i % 2 + 1 }}
                      initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22,1,0.36,1] }}>
                      <div className="card-inner-glow" />
                      <div className="capability-icon" style={{ background: `${cap.color}18`, borderColor: `${cap.color}30`, marginBottom: 14 }}>{cap.icon}</div>
                      <div className="capability-title" style={{ fontSize: '1rem' }}>{cap.title}</div>
                      <p className="capability-desc" style={{ fontSize: '0.82rem', marginTop: 6 }}>{cap.desc}</p>
                      <div className="stat-bar">
                        <div className="stat-bar-val" style={{ background: `linear-gradient(135deg, ${cap.color}, #fff)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{cap.stat}</div>
                        <div className="stat-bar-lbl">{cap.statLabel}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* ══════ TECH STACK ══════ */}
            <section id="tech" style={{ position: 'relative', zIndex: 2, padding: '0 40px 96px' }}>
              <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div className="section-label">Technology</div>
                <h2 className="section-title">Built on the Best</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 32 }}>
                  {TECH_STACK.map((tech, i) => (
                    <motion.div key={tech.name} className="card"
                      style={{ textAlign: 'center', padding: '24px 16px' }}
                      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.6, ease: [0.22,1,0.36,1] }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: tech.color, marginBottom: 4, fontFamily: "'Syne', sans-serif" }}>{tech.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tech.role}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="footer">
              <div className="footer-brand">Clip<span>Insight</span> AI</div>
              <div className="footer-meta">Built with Gemini 2.0 Flash · Whisper · OpenCV · Next.js</div>
              <div className="footer-meta">© 2025 · Beta</div>
            </footer>
          </motion.div>
        )}

        {/* ══════ ANALYZING ══════ */}
        {state === 'analyzing' && (
          <motion.div key="analyzing" variants={fade} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'relative', zIndex: 2 }}>
            <Nav />
            <section className="progress-section">
              <div style={{ maxWidth: 680, width: '100%', textAlign: 'center' }}>
                <div className="progress-orb">🧠</div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
                  AI is <span className="gradient-text">Processing</span>
                </h2>
                <p style={{ color: 'var(--tx-1)', fontSize: '0.9rem', marginBottom: 40 }}>
                  Running 11-model pipeline — vision, speech, emotion, trends, and LLM reasoning
                </p>
                <PipelineAnimation isRunning={true} />
                <div style={{ marginTop: 40 }}>
                  <AnalysisProgress jobId={jobId} onComplete={onComplete} />
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* ══════ RESULTS ══════ */}
        {state === 'results' && (
          <motion.div key="results" variants={fade} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'relative', zIndex: 2 }}>
            <Nav back />
            <div className="results-wrap">
              <ResultsDashboard result={result} jobId={jobId} onReset={reset} />
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      <HistoryPanel isOpen={showHistory} onClose={() => setShowHistory(false)} onReplay={() => setShowHistory(false)} />
    </>
  );
}
