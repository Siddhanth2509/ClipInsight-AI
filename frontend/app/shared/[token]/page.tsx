'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ResultsDashboard from '@/components/ResultsDashboard';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function SharedResultPage() {
  const params    = useParams();
  const token     = params?.token as string;
  const [result,  setResult]  = useState<any>(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/shared/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => { setResult(data); setLoading(false); })
      .catch(() => { setError('This share link has expired or is invalid.'); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base, #020B18)', color: 'var(--purple, #7C5CFC)',
        fontFamily: 'Inter, sans-serif', fontSize: '1rem', gap: 20, flexDirection: 'column',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(124,92,252,0.2)', borderTopColor: 'var(--purple, #7C5CFC)',
          animation: 'spin 0.9s linear infinite',
        }} />
        <span style={{ color: 'rgba(255,255,255,0.45)' }}>Loading shared analysis...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base, #020B18)', color: 'var(--tx-0, #F8FAFC)',
        flexDirection: 'column', gap: 20, padding: 32, fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: '3.5rem' }}>🔗</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Link Not Found</h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6, fontSize: '0.9rem' }}>
          {error}
        </p>
        <a href="/" style={{
          padding: '12px 28px', borderRadius: 12,
          background: 'linear-gradient(135deg, var(--purple, #7C5CFC), var(--cyan, #3DD9FF))',
          color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem',
        }}>
          Analyze Your Own Video
        </a>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-base, #020B18)', minHeight: '100vh' }}>
      {/* Branded shared header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(2,11,24,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(124,92,252,0.15)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--purple, #7C5CFC)', fontWeight: 800, fontSize: '1rem' }}>
            ClipInsight AI
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: 100,
            background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.3)',
            fontSize: '0.68rem', color: '#B49EFF', fontWeight: 600, letterSpacing: '0.1em',
          }}>SHARED ANALYSIS</span>
        </div>
        <a href="/" style={{
          padding: '7px 18px', borderRadius: 8,
          background: 'rgba(124,92,252,0.12)', border: '1px solid rgba(124,92,252,0.25)',
          color: '#B49EFF', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
        }}>
          Try It Free
        </a>
      </div>

      <ResultsDashboard result={result} jobId="" onReset={() => { window.location.href = '/'; }} />

      {/* CTA Footer */}
      <div style={{
        textAlign: 'center', padding: '48px 24px 80px',
        borderTop: '1px solid rgba(124,92,252,0.08)',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 20, fontSize: '0.88rem' }}>
          Powered by ClipInsight AI — Analyze any short-form video
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '14px 36px', borderRadius: 14,
          background: 'linear-gradient(135deg, var(--purple, #7C5CFC), var(--cyan, #3DD9FF))',
          color: '#fff', fontWeight: 700, textDecoration: 'none',
          fontSize: '0.95rem', letterSpacing: '0.03em',
          boxShadow: '0 8px 32px rgba(124,92,252,0.4)',
        }}>
          Analyze Your Video Free
        </a>
      </div>
    </div>
  );
}
