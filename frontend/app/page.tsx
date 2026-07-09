'use client';
// Developer Note: Main entry point for the ClipInsight Next.js landing portal.
import { useState, useEffect, useCallback } from 'react';
import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import AnalysisProgress from '@/components/AnalysisProgress';
import ResultsDashboard from '@/components/ResultsDashboard';
import { saveToHistory } from '@/components/HistoryPanel';
import UserAccount from '@/components/UserAccount';
import AuthModal, { getCurrentUser, deductCredit, type AuthUser } from '@/components/AuthModal';
import AdminPanel from '@/components/AdminPanel';
import PaymentModal from '@/components/PaymentModal';

// ── ReactBits Component Imports (web_skill) ──
import SplitText from '@/components/reactbits/SplitText';
import BlurText from '@/components/reactbits/BlurText';
import Aurora from '@/components/reactbits/Aurora';
import BorderGlow from '@/components/reactbits/BorderGlow';
import StarBorder from '@/components/reactbits/StarBorder';
import ClickSpark from '@/components/reactbits/ClickSpark';
import GlareHover from '@/components/reactbits/GlareHover';
import SpotlightCard from '@/components/reactbits/SpotlightCard';

const HeroScene = dynamic(() => import('@/components/HeroScene'), { ssr: false });

type AppState = 'hero' | 'analyzing' | 'results';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const fadeUp = {
  hidden:  { opacity: 0, y: 32, filter: 'blur(8px)' },
  visible: (d = 0) => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.75, delay: d, ease: [0.22,1,0.36,1] as any } }),
  exit:    { opacity: 0, y: -16, filter: 'blur(6px)', transition: { duration: 0.3 } },
};

/* ── Scroll-reveal hook ── */
function useScrollReveal(appState: AppState) {
  useEffect(() => {
    if (appState !== 'hero') return;
    let obs: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('.reveal');
      obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs?.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      els.forEach(el => obs?.observe(el));
    }, 100);
    return () => {
      clearTimeout(timer);
      if (obs) obs.disconnect();
    };
  }, [appState]);
}

/* ── Nav scroll effect ── */
function useNavScroll() {
  useEffect(() => {
    const nav = document.querySelector('.nav');
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

/* ── 3D card mouse tilt ── */
function use3DCards(appState: AppState) {
  useEffect(() => {
    if (appState !== 'hero') return;
    const handlers: Array<{ el: HTMLElement; mo: (e: MouseEvent) => void; ml: () => void }> = [];
    const timer = setTimeout(() => {
      const cards = document.querySelectorAll<HTMLElement>('.card');
      cards.forEach(card => {
        const mo = (e: MouseEvent) => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width  - 0.5;
          const y = (e.clientY - r.top)  / r.height - 0.5;
          card.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg) scale(1.02) translateY(-6px)`;
          card.style.boxShadow = `0 24px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,92,252,0.25), ${x * 20}px ${y * 20}px 40px rgba(124,92,252,0.10)`;
        };
        const ml = () => {
          card.style.transform = '';
          card.style.boxShadow = '';
        };
        card.addEventListener('mousemove', mo);
        card.addEventListener('mouseleave', ml);
        handlers.push({ el: card, mo, ml });
      });
    }, 100);
    return () => {
      clearTimeout(timer);
      handlers.forEach(({ el, mo, ml }) => {
        el.removeEventListener('mousemove', mo);
        el.removeEventListener('mouseleave', ml);
      });
    };
  }, [appState]);
}



/* ── Capabilities ── */
const CAPABILITIES = [
  { icon:'🎞', title:'Frame Intelligence', desc:'OpenCV extracts key frames every 3s. Vision AI reads scenes, text, objects and visual context with cinematic precision.', stat:'60fps', label:'Processing', color:'#7C5CFC' },
  { icon:'🎙', title:'Speech Recognition', desc:'OpenAI Whisper transcribes every word with timestamps — dialogue, voiceover, ambient audio.', stat:'99%', label:'Accuracy', color:'#3DD9FF' },
  { icon:'📝', title:'OCR & Text', desc:'On-screen text, captions, overlays and watermarks — all extracted and indexed for analysis.', stat:'<1s', label:'Per Frame', color:'#F5C96A' },
  { icon:'🎵', title:'Music Detection', desc:'Identify background tracks, beats per minute, genre tags, and licensed audio fingerprints.', stat:'95%', label:'Precision', color:'#57D98D' },
  { icon:'😊', title:'Emotion Analysis', desc:'Multi-signal emotion arc — facial micro-expressions, vocal tonality, and content sentiment combined.', stat:'12+', label:'Emotions', color:'#FFB6C1' },
  { icon:'🧠', title:'LLM Synthesis', desc:'Gemini 2.0 Flash synthesizes all signals: hook scores, engagement prediction, audience fit analysis.', stat:'<3s', label:'Response', color:'#7C5CFC' },
];

/* ── Timeline steps ── */
const HOW_STEPS = [
  { num:'01', title:'Paste Your URL', desc:'Drop any Instagram Reel, YouTube Short, or TikTok link into the input. We support public and most unlisted videos.' },
  { num:'02', title:'Frame Extraction', desc:'OpenCV samples key frames every 3 seconds, capturing the full visual arc of your content.' },
  { num:'03', title:'Multi-Modal Analysis', desc:'Six AI engines run in parallel — vision, speech, OCR, music, emotion, and trend detection.' },
  { num:'04', title:'LLM Synthesis', desc:'Gemini 2.0 Flash takes all raw signals and reasons across them to surface insights a human analyst would miss.' },
  { num:'05', title:'Intelligence Report', desc:'A complete structured report: summary, transcript, entities, hook score, sentiment arc, and tailored recommendations.' },
];

/* ── Sample transcript ── */
const TRANSCRIPT_ROWS = [
  { time:'00:02', speaker:'Creator', text:"Okay so I've been using this productivity system for 90 days now and here's what actually changed..." },
  { time:'00:08', speaker:'Creator', text:"The biggest mistake most people make is thinking that more apps equals more productivity..." },
  { time:'00:15', speaker:'Creator', text:'Instead, I reduced my tool stack to just three things. And this is what my workflow looks like now.' },
  { time:'00:24', speaker:'Creator', text:"First — a single capture inbox. Everything goes here. No exceptions, no sorting, just raw capture." },
  { time:'00:33', speaker:'Creator', text:'Second — a weekly review block. 90 minutes every Sunday. This is the highest ROI hour of my week.' },
];

const ENTITY_TAGS = [
  { label:'Productivity', color:'#7C5CFC', bg:'rgba(124,92,252,0.12)' },
  { label:'90-Day Challenge', color:'#3DD9FF', bg:'rgba(61,217,255,0.10)' },
  { label:'Workflow', color:'#F5C96A', bg:'rgba(245,201,106,0.10)' },
  { label:'Self-Improvement', color:'#57D98D', bg:'rgba(87,217,141,0.10)' },
  { label:'Time Management', color:'#7C5CFC', bg:'rgba(124,92,252,0.12)' },
];

/* ── Pricing plans ── */
const PLANS = [
  { name:'Starter', price:'$0', period:'/month', badge:'', features:['5 analyses/day','URL only','Basic report','Community support'], cta:'Get Started', featured:false },
  { name:'Pro', price:'$29', period:'/month', badge:'Most Popular', features:['Unlimited analyses','URL + file upload','Full intelligence report','Priority processing','API access (1000 req/mo)','Email support'], cta:'Start Free Trial', featured:true },
  { name:'Enterprise', price:'Custom', period:'contact us', badge:'', features:['Unlimited everything','Dedicated infrastructure','Custom integrations','SLA guarantee','Dedicated support'], cta:'Talk to Sales', featured:false },
];

const THEMES = [
  { key: 'purple',        name: 'Purple',        color: '#7C3AED', tooltip: 'Deep Purple' },
  { key: 'ocean-blue',    name: 'Ocean Blue',    color: '#0369A1', tooltip: 'Ocean Blue' },
  { key: 'emerald-green', name: 'Emerald Green', color: '#059669', tooltip: 'Emerald Green' },
  { key: 'sunset-orange', name: 'Sunset Orange', color: '#EA580C', tooltip: 'Sunset Orange' },
  { key: 'royal-gold',    name: 'Royal Gold',    color: '#B45309', tooltip: 'Royal Gold' },
  { key: 'rose-pink',     name: 'Rose Pink',     color: '#BE185D', tooltip: 'Rose Pink' },
  { key: 'ice-white',     name: 'Ice White',     color: '#e8f4f8', border: '#94a3b8', tooltip: 'Ice White (Light)' },
];

function getGlowColor(theme: string) {
  switch (theme) {
    case 'purple': return 'rgba(124, 92, 252, 0.18)';
    case 'ocean-blue': return 'rgba(14, 165, 233, 0.22)';
    case 'emerald-green': return 'rgba(16, 185, 129, 0.22)';
    case 'sunset-orange': return 'rgba(234, 88, 12, 0.22)';
    case 'royal-gold': return 'rgba(180, 83, 9, 0.22)';
    case 'rose-pink': return 'rgba(190, 24, 93, 0.22)';
    default: return 'rgba(255, 255, 255, 0.12)';
  }
}

export default function Home() {
const CYCLABLE_THEMES = ['purple','ocean-blue','emerald-green','sunset-orange','royal-gold','rose-pink'] as const;

  // Live AI core status for hero panel
  const [heroHealth, setHeroHealth] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(`${BACKEND}/health`).then(r => r.json()).then(d => setHeroHealth(d)).catch(() => setHeroHealth(null));
    const iv = setInterval(() => {
      fetch(`${BACKEND}/health`).then(r => r.json()).then(d => setHeroHealth(d)).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const [appState,     setAppState]    = useState<AppState>('hero');
  const [jobId,        setJobId]       = useState('');
  const [result,       setResult]      = useState<any>(null);
  const [urlInput,     setUrlInput]    = useState('');
  const [loading,      setLoading]     = useState(false);
  const [urlError,     setUrlError]    = useState('');
  const [activeTab,    setActiveTab]   = useState(0);
  const [theme,        setTheme]       = useState('purple');
  const [showAccount,  setShowAccount] = useState(false);
  const [showAuth,     setShowAuth]    = useState(false);
  const [showAdmin,    setShowAdmin]   = useState(false);
  const [showPayment,  setShowPayment] = useState(false);
  const [paymentPlan,  setPaymentPlan] = useState<'Pro'|'Enterprise'>('Pro');
  const [currentUser,  setCurrentUser] = useState<AuthUser | null>(null);

  // Load current user on mount and after auth changes
  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, [showAuth, showAccount]);

  // On page load: if current theme is NOT ice-white, advance to the next cycled theme.
  // This means every REFRESH shows the next theme automatically.
  // Ice-white stays sticky (user explicitly chose light mode).
  useEffect(() => {
    const saved = localStorage.getItem('clipinsight-theme') || 'purple';
    // Ice-white: user chose light mode explicitly — keep it
    if (saved === 'ice-white') {
      setTheme('ice-white');
      return;
    }
    // Advance to next dark theme in cycle
    const idx  = CYCLABLE_THEMES.indexOf(saved as any);
    const next = CYCLABLE_THEMES[(idx === -1 ? 0 : (idx + 1)) % CYCLABLE_THEMES.length];
    setTheme(next);
    localStorage.setItem('clipinsight-theme', next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs only once on mount (page load / refresh)

  // Apply theme to <html> element and save to localStorage whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('clipinsight-theme', theme);
    window.dispatchEvent(new CustomEvent('theme-change', { detail: theme }));
  }, [theme]);

  useScrollReveal(appState);
  useNavScroll();
  use3DCards(appState);

  /* Submit URL */
  const handleAnalyze = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) { setUrlError('Please paste a video URL first'); return; }
    const valid = /https?:\/\/(www\.)?(instagram\.com|youtube\.com|youtu\.be|tiktok\.com)/.test(url);
    if (!valid) { setUrlError('Paste an Instagram, YouTube, or TikTok URL'); return; }
    setUrlError(''); setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/analyze/url`, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${res.status}`); }
      const { job_id } = await res.json();
      setJobId(job_id);
      setAppState('analyzing');
    } catch(e: any) {
      setUrlError(e.message || 'Failed — is the backend running?');
    } finally { setLoading(false); }
  }, [urlInput]);

  const handleResult = useCallback((r: any) => {
    setResult(r);
    saveToHistory(r, jobId);
    deductCredit(1); // Deduct 1 credit per analysis
    setCurrentUser(getCurrentUser()); // Refresh credit display
    setAppState('results');
  }, [jobId, urlInput]);

  return (
    <>
      {/* ── Fixed background layers (web_skill) ── */}
      <Aurora />
      <div className="bg-grid"/>
      <div className="bg-dots"/>
      <div className="scan-line"/>

      {/* ── NAV ── */}
      <nav className="nav">
        <div
          className="nav-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ cursor: 'pointer' }}
        >
          <div className="nav-logo-icon">✦</div>
          <span className="nav-logo-text">Clip<span>Insight</span> AI</span>
        </div>
        <div className="nav-links">
          {['Analyze','Features','Pipeline','API','Pricing'].map(l => (
            <button
              key={l}
              className="nav-link"
              onClick={() => {
                const targetId = l.toLowerCase() === 'pipeline' ? 'how' : l.toLowerCase();
                if (appState !== 'hero') {
                  setAppState('hero');
                  setTimeout(() => {
                    const el = document.getElementById(targetId);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 150);
                } else {
                  const el = document.getElementById(targetId);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="theme-selector-bar">
            {THEMES.map(t => (
              <button
                key={t.key}
                className={`theme-dot${theme === t.key ? ' active' : ''}`}
                style={{
                  background: t.color,
                  border: t.border ? `2px solid ${t.border}` : '2px solid rgba(255,255,255,0.2)',
                }}
                onClick={() => {
                  setTheme(t.key);
                  localStorage.setItem('clipinsight-theme', t.key);
                }}
                title={t.tooltip}
              />
            ))}
          </div>

          {/* ── Action buttons ── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* User Account / Auth */}
            <button
              id="nav-account-btn"
              onClick={() => setShowAccount(true)}
              title={currentUser ? `${currentUser.name} — ${currentUser.credits} credits` : 'Sign in'}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: currentUser
                  ? 'linear-gradient(135deg, var(--purple, #7C5CFC), var(--cyan, #3DD9FF))'
                  : 'rgba(255,255,255,0.08)',
                border: currentUser ? 'none' : '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: currentUser ? '0.75rem' : '1rem', fontWeight: 700, color: '#fff',
                boxShadow: currentUser ? '0 0 0 2px rgba(124,92,252,0.2)' : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,92,252,0.4)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = currentUser ? '0 0 0 2px rgba(124,92,252,0.2)' : 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {currentUser
                ? currentUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                : '👤'}
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════ HERO STATE ════════════════ */}
      <AnimatePresence mode="wait">
      {appState === 'hero' && (
        <motion.div key="hero-state" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,transition:{duration:0.3}}}>

          {/* ── HERO SECTION ── */}
          <section className="hero" id="analyze">
            {/* Left: content */}
            <div className="hero-content">
              <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
                <div className="hero-badge">
                  <span className="hero-badge-dot"/>
                  POWERED BY GEMINI 2.0 FLASH · LIVE
                </div>
              </motion.div>

              <h1 className="hero-title">
                <SplitText text="Turn Any Reel Into" />
                <br />
                <span className="gradient-text">
                  <SplitText text="AI Intelligence" delay={0.07} />
                </span>
              </h1>

              <div className="hero-sub" style={{ marginBottom: '28px' }}>
                <BlurText text="Paste any Instagram Reel, YouTube Short, or TikTok URL. Six AI engines analyze frames, speech, text, music, emotion, and trends — delivering a complete intelligence report in under 60 seconds." />
              </div>

              <motion.div custom={0.4} variants={fadeUp} initial="hidden" animate="visible">
                <div style={{display:'flex',gap:16,marginBottom:24,flexWrap:'wrap'}}>
                  <button className="btn btn-primary" onClick={() => document.getElementById('hero-url')?.focus()}>
                    <span>▶</span> Analyze a Video
                  </button>
                  <button className="btn btn-secondary">View API Docs</button>
                </div>
              </motion.div>

              <motion.div className="hero-input-wrap" custom={0.55} variants={fadeUp} initial="hidden" animate="visible" style={{ padding: '2px' }}>
                <BorderGlow borderRadius={16}>
                  <div className="hero-input-bar" style={{ background: 'transparent' }}>
                    <span className="hero-input-icon">🔗</span>
                    <input
                      id="hero-url"
                      className="hero-input"
                      placeholder="Paste any Instagram Reel, YouTube Short or TikTok URL..."
                      value={urlInput}
                      onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                    />
                    <StarBorder onClick={handleAnalyze} speed="4s">
                      <div className="hero-input-btn" style={{ border: 'none', background: 'transparent', margin: 0, padding: '12px 24px' }}>
                        {loading ? <span style={{display:'inline-block',animation:'spin 1s linear infinite'}}>⟳</span> : <><span>Analyze</span><span className="arrow" style={{ marginLeft: 6 }}>→</span></>}
                      </div>
                    </StarBorder>
                  </div>
                </BorderGlow>
                {urlError && (
                  <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} style={{fontSize:'0.78rem',color:'#F87171',marginTop:8,paddingLeft:4,fontFamily:'var(--font-body)'}}>
                    ⚠ {urlError}
                  </motion.p>
                )}
                {/* Mockup Pills Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  marginTop: '16px',
                  fontSize: '0.75rem',
                  color: 'var(--tx-1)',
                  fontFamily: 'var(--font-body)',
                  width: 'fit-content'
                }}>
                  <span>No account needed</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span>Free</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span>Results in 60s</span>
                </div>

                {/* Trust Signals */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--tx-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {[1,2,3,4,5].map(i => <span key={i} style={{ color: '#57D98D' }}>★</span>)}
                    <span style={{ marginLeft: '4px' }}>Trust signals</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#3DD9FF' }}>✔</span>
                    <span>200 trust signals</span>
                  </div>
                </div>
              </motion.div>

              {/* ── Animated Stats Counter Row ── */}
              <motion.div custom={0.55} variants={fadeUp} initial="hidden" animate="visible"
                style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginTop: '28px' }}>
                {[
                  { value: '12K+',  label: 'Videos Analyzed',   color: 'var(--purple)' },
                  { value: '99%',   label: 'Accuracy Rate',     color: 'var(--cyan)' },
                  { value: '<60s',  label: 'Avg. Analysis Time',color: '#57D98D' },
                  { value: '6',     label: 'AI Engines',        color: '#F5C96A' },
                ].map((stat, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900,
                      color: stat.color, lineHeight: 1,
                      textShadow: `0 0 20px ${stat.color}60`,
                    }}>{stat.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--tx-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-body)' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: 3D scene */}
            <motion.div className="hero-scene-side" custom={0.2} variants={fadeUp} initial="hidden" animate="visible">
              <HeroScene/>
              
              {/* High-fidelity Floating Glass Stats Panel */}
              <motion.div 
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  right: '24px',
                  zIndex: 20,
                  borderRadius: '16px',
                  padding: '20px',
                  border: '1px solid rgba(124, 92, 252, 0.3)',
                  background: 'rgba(7, 17, 31, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: 'inset 0 0 20px rgba(124, 92, 252, 0.15), 0 16px 40px rgba(0, 0, 0, 0.5)',
                  width: '280px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '10px', color: '#CBD5E1', letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Core Status</span>
                  <span style={{ fontSize: '10px', color: heroHealth?.status === 'ok' ? '#57D98D' : '#F87171', fontWeight: 'bold', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="hero-badge-dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: heroHealth?.status === 'ok' ? '#57D98D' : '#F87171', boxShadow: `0 0 6px ${heroHealth?.status === 'ok' ? '#57D98D' : '#F87171'}` }}/>
                    {heroHealth === null ? 'CONNECTING' : heroHealth?.status === 'ok' ? 'OPERATIONAL' : 'OFFLINE'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>UPTIME</span>
                    <span style={{ color: '#3DD9FF', fontWeight: 500 }}>{heroHealth?.uptime_seconds ? `${Math.round(heroHealth.uptime_seconds / 60)}m` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>JOBS PROCESSED</span>
                    <span style={{ color: 'var(--purple)', fontWeight: 500 }}>{heroHealth?.jobs_processed ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>AVG LATENCY</span>
                    <span style={{ color: '#F5C96A', fontWeight: 500 }}>{heroHealth?.avg_latency_ms ? `${heroHealth.avg_latency_ms}ms` : '<200ms'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>GEMINI API</span>
                    <span style={{ color: '#F8FAFC', fontWeight: 500 }}>{heroHealth?.gemini_api_set ? '✓ Connected' : '✗ Not set'}</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </section>

          {/* ── FEATURES BENTO ── */}
          <section className="section" id="features">
            <div className="section-label">Six AI Engines</div>
            <h2 className="section-title reveal">Six Engines.<br/>One Intelligence.</h2>
            <p className="section-sub reveal reveal-delay-1">Every video is a data source. We extract every signal simultaneously — visual, audio, textual, emotional — and synthesize them into one coherent picture.</p>

            <div className="bento">
              {/* Left Tall Card: Frame Extraction */}
              <div className="bento-left reveal">
                <GlareHover style={{ height: '100%' }} glowColor={getGlowColor(theme)}>
                  <div className="card" style={{ height: '100%' }}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                      <div className="card-icon" style={{background:'rgba(124,92,252,0.12)'}}>🎞</div>
                      <div>
                        <div className="card-title">Frame Extraction & Vision AI</div>
                        <div style={{fontSize:'0.75rem',color:'var(--tx-2)',fontFamily:'var(--font-body)'}}>Vision AI · OpenCV</div>
                      </div>
                    </div>
                    <p className="card-desc">OpenCV extracts key frames every 3 seconds. Vision AI reads scenes, text, objects and full visual context with cinematic precision. Every moment is captured.</p>
                    <div className="scan-visual" style={{ marginTop: '24px' }}>
                      <div className="scan-line-inner"/>
                      {[20,45,65,38,55,30,70].map((h,i) => (
                        <div key={i} style={{position:'absolute',bottom:8,left:`${8+i*13}%`,width:8,height:h*0.6+'%',background:'rgba(124,92,252,0.3)',borderRadius:2,border:'1px solid rgba(124,92,252,0.4)'}}/>
                      ))}
                    </div>
                    <div className="stat-bar" style={{ marginTop: 'auto', paddingTop: '16px' }}>
                      <span className="stat-val">60fps</span>
                      <span className="stat-lbl">Processing Speed</span>
                    </div>
                  </div>
                </GlareHover>
              </div>

              {/* Right 2x2 Grid of Cards */}
              <div className="bento-right-grid">
                {/* Speech */}
                <div className="card-wrap reveal reveal-delay-1">
                  <GlareHover style={{ height: '100%' }} glowColor={getGlowColor(theme)}>
                    <div className="card" style={{ height: '100%' }}>
                      <div className="card-icon" style={{background:'rgba(61,217,255,0.10)',borderColor:'rgba(61,217,255,0.2)'}}>🎙</div>
                      <div className="card-title">Speech Recognition</div>
                      <p className="card-desc">Whisper transcribes every word with timestamps.</p>
                      <div className="waveform-visual">
                        {[1,2,3,4,5,6,7].map(i => <div key={i} className="wave-bar" style={{animationDelay:`${(i-1)*0.12}s`}}/>)}
                      </div>
                      <div className="stat-bar">
                        <span className="stat-val" style={{background:'linear-gradient(135deg,#3DD9FF,#7C5CFC)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>99%</span>
                        <span className="stat-lbl">Accuracy</span>
                      </div>
                    </div>
                  </GlareHover>
                </div>

                {/* OCR */}
                <div className="card-wrap reveal reveal-delay-2">
                  <GlareHover style={{ height: '100%' }} glowColor={getGlowColor(theme)}>
                    <div className="card" style={{ height: '100%' }}>
                      <div className="card-icon" style={{background:'rgba(245,201,106,0.10)',borderColor:'rgba(245,201,106,0.2)'}}>📝</div>
                      <div className="card-title">OCR & Text</div>
                      <p className="card-desc">On-screen text, captions, overlays extracted and indexed.</p>
                      <div className="ocr-visual">
                        <div className="ocr-box" style={{top:'15%',left:'8%',width:'38%',height:'22%'}}/>
                        <div className="ocr-box" style={{top:'50%',left:'45%',width:'42%',height:'20%',animationDelay:'0.5s'}}/>
                        <div className="ocr-box" style={{top:'72%',left:'10%',width:'30%',height:'18%',animationDelay:'1s'}}/>
                      </div>
                      <div className="stat-bar">
                        <span className="stat-val" style={{background:'linear-gradient(135deg,#F5C96A,#FF9F7A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>&lt;1s</span>
                        <span className="stat-lbl">Per Frame</span>
                      </div>
                    </div>
                  </GlareHover>
                </div>

                {/* Music */}
                <div className="card-wrap reveal reveal-delay-1">
                  <GlareHover style={{ height: '100%' }} glowColor={getGlowColor(theme)}>
                    <div className="card" style={{ height: '100%' }}>
                      <div className="card-icon" style={{background:'rgba(87,217,141,0.10)',borderColor:'rgba(87,217,141,0.2)'}}>🎵</div>
                      <div className="card-title">Music Detection</div>
                      <p className="card-desc">Track ID, BPM, genre, and licensed audio fingerprints.</p>
                      <div className="ripple-visual">
                        <div style={{width:18,height:18,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 12px rgba(87,217,141,0.6)'}}/>
                        {[1,2,3].map(i=><div key={i} className="ripple-ring" style={{animationDelay:`${(i-1)*0.7}s`}}/>)}
                      </div>
                      <div className="stat-bar">
                        <span className="stat-val" style={{background:'linear-gradient(135deg,#57D98D,#3DD9FF)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>95%</span>
                        <span className="stat-lbl">Precision</span>
                      </div>
                    </div>
                  </GlareHover>
                </div>

                {/* Emotion */}
                <div className="card-wrap reveal reveal-delay-2">
                  <GlareHover style={{ height: '100%' }} glowColor={getGlowColor(theme)}>
                    <div className="card" style={{ height: '100%' }}>
                      <div className="card-icon" style={{background:'rgba(255,182,193,0.10)',borderColor:'rgba(255,182,193,0.2)'}}>😊</div>
                      <div className="card-title">Emotion Analysis</div>
                      <p className="card-desc">Facial expressions, vocal tone, and content sentiment combined.</p>
                      <div style={{display:'flex',gap:6,marginTop:20,flexWrap:'wrap'}}>
                        {[['Joy','#57D98D',85],['Trust','#7C5CFC',72],['Surprise','#F5C96A',54],['Anticipation','#3DD9FF',68]].map(([l,c,v])=>(
                          <div key={l} style={{flex:1,minWidth:60}}>
                            <div style={{fontSize:'0.65rem',color:'var(--tx-2)',fontFamily:'var(--font-body)',marginBottom:4}}>{l}</div>
                            <div style={{height:4,borderRadius:4,background:'rgba(255,255,255,0.07)',overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${v}%`,background:c as string,borderRadius:4,transition:'width 1s'}}/>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="stat-bar">
                        <span className="stat-val" style={{background:'linear-gradient(135deg,#FFB6C1,#E0A0FF)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>12+</span>
                        <span className="stat-lbl">Emotions</span>
                      </div>
                    </div>
                  </GlareHover>
                </div>
              </div>
            </div>
          </section>



          {/* ── HOW IT WORKS ── */}
          <section className="section" id="how">
            <div className="section-label">Process</div>
            <h2 className="section-title reveal">From URL to<br/>Intelligence Report</h2>
            <p className="section-sub reveal reveal-delay-1">Five steps. Under 60 seconds. Complete insight.</p>
            <div className="timeline reveal reveal-delay-2">
              <div className="timeline-line"/>
              {HOW_STEPS.map((s,i) => (
                <div className="timeline-item" key={s.num}>
                  {i%2===0 ? (
                    <>
                      <div className="timeline-card" style={{textAlign:'right'}}>
                        <div className="timeline-step">Step {s.num}</div>
                        <div className="timeline-title">{s.title}</div>
                        <div className="timeline-desc">{s.desc}</div>
                      </div>
                      <div className="timeline-node" style={{margin:'0 auto'}}>{s.num}</div>
                      <div/>
                    </>
                  ) : (
                    <>
                      <div/>
                      <div className="timeline-node" style={{margin:'0 auto'}}>{s.num}</div>
                      <div className="timeline-card">
                        <div className="timeline-step">Step {s.num}</div>
                        <div className="timeline-title">{s.title}</div>
                        <div className="timeline-desc">{s.desc}</div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── SAMPLE ANALYSIS ── */}
          <section className="section" id="sample">
            <div className="section-label">Live Demo</div>
            <h2 className="section-title reveal">See What the AI Sees</h2>
            <p className="section-sub reveal reveal-delay-1">A real analysis report from an actual reel — every output field your report will contain.</p>
            <div className="analysis-showcase reveal reveal-delay-2">
              <div className="analysis-showcase-inner">
                <div className="analysis-sidebar">
                  <div className="analysis-thumb">
                    <div className="play-btn">▶</div>
                  </div>
                  <div className="quick-stats-title">Quick Stats</div>
                  {[['Duration','0:47'],['Platform','Instagram'],['Hook Score','94 / 100'],['Emotion','Inspired'],['Views Est.','2.4M'],['BPM','128']].map(([l,v])=>(
                    <div className="quick-stat" key={l}>
                      <span className="quick-stat-lbl">{l}</span>
                      <span className="quick-stat-val">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="analysis-body">
                  <div className="tabs">
                    {['Transcript','Visual Analysis','Sentiment','Metadata'].map((t,i)=>(
                      <button key={t} className={`tab${activeTab===i?' active':''}`} onClick={()=>setActiveTab(i)}>{t}</button>
                    ))}
                  </div>
                  {activeTab===0 && (
                    <div className="transcript-scroll">
                      {TRANSCRIPT_ROWS.map((r,i)=>(
                        <div className="transcript-row" key={i}>
                          <span className="transcript-time">{r.time}</span>
                          <div>
                            <span className="transcript-speaker">{r.speaker}</span>
                            <div className="transcript-text">{r.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab===1 && (
                    <div>
                      {[['Scene Type','Indoor — Home Office / Desk Setup'],['Lighting','Natural + ring light, warm temperature'],['Objects Detected','Laptop, journal, whiteboard, plants'],['Text Overlay','\"90 DAYS LATER\" — large white text, center frame'],['Color Palette','Warm neutral tones, high contrast accents']].map(([l,v])=>(
                        <div key={l} style={{display:'flex',gap:16,padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                          <span style={{fontSize:'0.75rem',color:'var(--tx-2)',minWidth:120,fontFamily:'var(--font-body)'}}>{l}</span>
                          <span style={{fontSize:'0.82rem',color:'var(--tx-0)',fontFamily:'var(--font-body)'}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab===2 && (
                    <div>
                      <div style={{marginBottom:20}}>
                        <div style={{fontSize:'0.75rem',color:'var(--tx-2)',marginBottom:8,fontFamily:'var(--font-body)'}}>Overall Sentiment Arc</div>
                        <div style={{display:'flex',gap:4,height:48,alignItems:'flex-end'}}>
                          {[35,52,68,74,82,88,91,85,94,88].map((v,i)=>(
                            <div key={i} style={{flex:1,height:`${v}%`,background:`linear-gradient(180deg,#7C5CFC,#3DD9FF)`,borderRadius:'3px 3px 0 0',opacity:0.7+i*0.03}}/>
                          ))}
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                          <span style={{fontSize:'0.65rem',color:'var(--tx-3)',fontFamily:'var(--font-body)'}}>0:00</span>
                          <span style={{fontSize:'0.65rem',color:'var(--tx-3)',fontFamily:'var(--font-body)'}}>0:47</span>
                        </div>
                      </div>
                      <div className="data-line"/>
                      {[['Primary Emotion','Inspiration → Determination'],['Emotional Intensity','High (8.4 / 10)'],['Credibility Signals','Personal testimony, specific numbers, before/after'],['Audience Fit','Productivity, self-improvement, 25-40 demographic']].map(([l,v])=>(
                        <div key={l} style={{display:'flex',gap:16,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                          <span style={{fontSize:'0.75rem',color:'var(--tx-2)',minWidth:140,fontFamily:'var(--font-body)'}}>{l}</span>
                          <span style={{fontSize:'0.82rem',color:'var(--tx-0)',fontFamily:'var(--font-body)'}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab===3 && (
                    <div>
                      {[['File Format','MP4 H.264'],['Resolution','1080 × 1920 (9:16)'],['Frame Rate','30 fps'],['Duration','47.2 seconds'],['Audio Codec','AAC 44.1kHz'],['File Size','18.4 MB'],['Background Music','Lofi Beats — Chill Study Mix'],['Music BPM','128'],['Licensed Audio','No copyright flags detected']].map(([l,v])=>(
                        <div key={l} style={{display:'flex',gap:16,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                          <span style={{fontSize:'0.75rem',color:'var(--tx-2)',minWidth:140,fontFamily:'var(--font-body)'}}>{l}</span>
                          <span style={{fontSize:'0.82rem',color:'var(--tx-0)',fontFamily:'var(--font-mono)'}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="entity-row">
                    {ENTITY_TAGS.map(t=>(
                      <span key={t.label} className="entity-tag" style={{color:t.color,background:t.bg,border:`1px solid ${t.color}30`}}>{t.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── API SECTION ── */}
          <section className="section" id="api">
            <div className="api-grid">
              <div>
                <div className="section-label">API Access</div>
                <h2 className="section-title reveal">Built for Engineers</h2>
                <p className="section-sub reveal reveal-delay-1" style={{marginBottom:36}}>Integrate ClipInsight AI into your own pipeline. REST API with job queuing, webhooks, and structured JSON responses.</p>
                {['Simple REST API — POST a URL, get a job ID','Webhooks for async result delivery','Structured JSON — every field documented','Python & Node SDKs available','OpenAPI spec for auto-generated clients'].map((f,i)=>(
                  <div className="api-feature reveal" key={f} style={{transitionDelay:`${i*0.08}s`}}>
                    <div className="api-check">✓</div>
                    <span className="api-feature-txt">{f}</span>
                  </div>
                ))}
              </div>
              <div className="terminal reveal reveal-delay-2">
                <div className="terminal-bar">
                  <div className="terminal-dot" style={{background:'#FF5F57'}}/>
                  <div className="terminal-dot" style={{background:'#FEBC2E'}}/>
                  <div className="terminal-dot" style={{background:'#28C840'}}/>
                  <div className="terminal-title">clipinsight-api.sh</div>
                </div>
                <div className="terminal-body">
                  <div style={{color:'var(--tx-2)'}}>{'# Submit a video for analysis'}</div>
                  <div><span style={{color:'#57D98D'}}>curl</span> <span style={{color:'#F8FAFC'}}>-X POST</span> <span style={{color:'var(--purple)'}}>https://api.clipinsight.ai/v1/analyze</span> \</div>
                  <div style={{paddingLeft:16}}><span style={{color:'var(--cyan)'}}>-H</span> <span style={{color:'#F5C96A'}}>"Authorization: Bearer sk-..."</span> \</div>
                  <div style={{paddingLeft:16}}><span style={{color:'var(--cyan)'}}>-d</span> <span style={{color:'#F5C96A'}}>'{`{"url":"https://www.instagram.com/reel/..."}`}'</span></div>
                  <br/>
                  <div style={{color:'var(--tx-2)'}}>{'# Poll for result'}</div>
                  <div><span style={{color:'#57D98D'}}>curl</span> <span style={{color:'var(--purple)'}}>https://api.clipinsight.ai/v1/job/</span><span style={{color:'var(--cyan)'}}>{'<job_id>'}</span></div>
                  <br/>
                  <div style={{color:'var(--tx-2)'}}>{'# Response (truncated)'}</div>
                  <div style={{color:'#f0f0f0'}}>{`{`}</div>
                  <div style={{paddingLeft:16}}><span style={{color:'var(--cyan)'}}>status</span><span style={{color:'#f0f0f0'}}>: </span><span style={{color:'#F5C96A'}}>"completed"</span><span style={{color:'#f0f0f0'}}>,</span></div>
                  <div style={{paddingLeft:16}}><span style={{color:'var(--cyan)'}}>hook_score</span><span style={{color:'#f0f0f0'}}>: </span><span style={{color:'#57D98D'}}>94</span><span style={{color:'#f0f0f0'}}>,</span></div>
                  <div style={{paddingLeft:16}}><span style={{color:'var(--cyan)'}}>emotion</span><span style={{color:'#f0f0f0'}}>: </span><span style={{color:'#F5C96A'}}>"inspired"</span><span style={{color:'#f0f0f0'}}>,</span></div>
                  <div style={{paddingLeft:16}}><span style={{color:'var(--cyan)'}}>topics</span><span style={{color:'#f0f0f0'}}>: [</span><span style={{color:'#F5C96A'}}>"productivity"</span><span style={{color:'#f0f0f0'}}>, ...]</span></div>
                  <div>{`}`}</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── PRICING ── */}
          <section className="section" id="pricing">
            <div style={{textAlign:'center',marginBottom:8}}>
              <div className="section-label" style={{justifyContent:'center'}}>Pricing</div>
              <h2 className="section-title reveal">Simple, Transparent Pricing</h2>
              <p className="section-sub reveal reveal-delay-1" style={{margin:'0 auto'}}>Start free. Scale as you grow. No surprises.</p>
            </div>
            <div className="pricing-grid">
              {PLANS.map((p,i)=>(
                <div key={p.name} className="reveal" style={{transitionDelay:`${i*0.12}s`}}>
                  <SpotlightCard
                    spotlightColor={p.featured ? 'rgba(61, 217, 255, 0.12)' : 'rgba(124, 92, 252, 0.12)'}
                    borderColor={p.featured ? 'rgba(61, 217, 255, 0.3)' : 'rgba(124, 92, 252, 0.2)'}
                  >
                    <div className={`pricing-card${p.featured?' featured':''}`} style={{ border: 'none', background: 'transparent', margin: 0 }}>
                      {p.badge && <div className="pricing-badge">{p.badge}</div>}
                      <div className="pricing-name">{p.name}</div>
                      <div className="pricing-price">{p.price}</div>
                      <div className="pricing-period">{p.period}</div>
                      <div className="pricing-divider"/>
                      {p.features.map(f=>(
                        <div className="pricing-feature" key={f}>
                          <span className="pricing-check">✓</span>{f}
                        </div>
                      ))}
                      <div className="pricing-cta" style={{marginTop:28}}>
                        <button
                          className={`btn ${p.featured?'btn-primary':'btn-secondary'}`}
                          style={{width:'100%',justifyContent:'center'}}
                          onClick={() => {
                            if (p.name === 'Starter') {
                              // Free plan — log in if not already, else scroll to analyze
                              if (!getCurrentUser()) setShowAuth(true);
                              else window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else if (p.name === 'Pro') {
                              // Pro plan — open payment modal
                              setPaymentPlan('Pro'); setShowPayment(true);
                            } else if (p.name === 'Enterprise') {
                              window.open('mailto:support@clipinsight.ai?subject=Enterprise Plan Inquiry', '_blank');
                            }
                          }}
                        >
                          {p.cta}
                        </button>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              ))}
            </div>
          </section>

          {/* ── FOOTER ── */}
          <footer className="footer">
            <div className="footer-brand">Clip<span>Insight</span> AI</div>
            <div className="footer-links">
              {['Features','Pipeline','API','Pricing','Privacy'].map(l=>(
                <a
                  key={l}
                  className="footer-link"
                  href={`#${l.toLowerCase() === 'pipeline' ? 'how' : l.toLowerCase()}`}
                  onClick={(e) => {
                    if (l === 'Privacy') return;
                    e.preventDefault();
                    const targetId = l.toLowerCase() === 'pipeline' ? 'how' : l.toLowerCase();
                    if (appState !== 'hero') {
                      setAppState('hero');
                      setTimeout(() => {
                        const el = document.getElementById(targetId);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 150);
                    } else {
                      const el = document.getElementById(targetId);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  {l}
                </a>
              ))}
            </div>
            <div className="footer-copy">© 2025 ClipInsight AI. Built with Gemini 2.0, Whisper & OpenCV.</div>
          </footer>

        </motion.div>
      )}

      {/* ════════════════ ANALYZING STATE ════════════════ */}
      {appState === 'analyzing' && (
        <motion.div key="analyzing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <AnalysisProgress
            jobId={jobId}
            onComplete={handleResult}
            onError={e => { setUrlError(e); setAppState('hero'); }}
          />
        </motion.div>
      )}

      {/* ════════════════ RESULTS STATE ════════════════ */}
      {appState === 'results' && result && (
        <motion.div key="results" initial={{opacity:0}} animate={{opacity:1}} className="results-wrap">
          <ResultsDashboard result={result} jobId={jobId} onReset={() => setAppState('hero')}/>
        </motion.div>
      )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes orb-breathe { 0%,100%{transform:scale(1);opacity:0.85} 50%{transform:scale(1.1);opacity:1} }
        .hook-bar-track { height: 8px; background: rgba(255,255,255,0.06); border-radius: 100px; overflow: hidden; }
        .hook-bar-fill {
          height: 100%; border-radius: 100px;
          background: linear-gradient(90deg, var(--purple), var(--cyan));
          transition: width 1.5s ease;
        }
        .suggestion-item {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 14px 18px; margin-bottom: 10px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
        }
        .suggestion-num {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          background: var(--purple-dim); border: 1px solid var(--purple-glow);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.78rem; font-weight: 700; color: var(--purple);
        }
        .tag-chip {
          display: inline-block; padding: 4px 12px; border-radius: 100px;
          background: rgba(124,92,252,0.08); color: var(--purple);
          border: 1px solid rgba(124,92,252,0.18);
          font-size: 0.78rem; font-family: var(--font-body);
          font-weight: 500;
        }
        .results-wrap { position: relative; z-index: 3; }
      `}</style>

      {/* ── Modals ── */}
      <UserAccount
        isOpen={showAccount}
        onClose={() => setShowAccount(false)}
        onOpenAdmin={() => setShowAdmin(true)}
        onOpenPayment={(plan) => { setPaymentPlan(plan); setShowPayment(true); }}
        onOpenAuth={() => setShowAuth(true)}
      />

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={(user) => {
          setCurrentUser(user);
        }}
      />

      <AdminPanel
        isOpen={showAdmin}
        onClose={() => setShowAdmin(false)}
      />

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        plan={paymentPlan}
        onSuccess={() => {
          setCurrentUser(getCurrentUser());
          setShowPayment(false);
        }}
      />
    </>
  );
}
