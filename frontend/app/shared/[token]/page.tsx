'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ResultsDashboard from '@/components/ResultsDashboard';

export default function SharedResultPage() {
  const params   = useParams();
  const token    = params?.token as string;
  const [result, setResult] = useState<any>(null);
  const [error,  setError]  = useState('');
  const [loading,setLoading]= useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/shared/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => { setResult(data); setLoading(false); })
      .catch(() => { setError('This share link has expired or is invalid.'); setLoading(false); });
  }, [token, API]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F0A22', color: '#FFB7C5', fontFamily: 'Georgia, serif',
        fontSize: '1.2rem', gap: 16, flexDirection: 'column',
      }}>
        <div style={{ fontSize: '3rem', animation: 'spin 2s linear infinite' }}>🌸</div>
        Loading shared analysis…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F0A22', color: '#FFB7C5', flexDirection: 'column', gap: 16,
        fontFamily: 'Georgia, serif',
      }}>
        <div style={{ fontSize: '3rem' }}>🍂</div>
        <p style={{ color: '#F2EBFA', fontSize: '1.1rem' }}>{error}</p>
        <a href="/" style={{
          marginTop: 16, padding: '12px 28px', borderRadius: 12,
          background: 'linear-gradient(135deg, #E8557A, #FFB7C5)',
          color: '#0F0A22', fontWeight: 700, textDecoration: 'none',
          fontSize: '0.9rem',
        }}>
          🌸 Try your own video →
        </a>
      </div>
    );
  }

  return (
    <div style={{ background: '#0F0A22', minHeight: '100vh', paddingTop: 40 }}>
      {/* Shared header banner */}
      <div style={{
        textAlign: 'center', padding: '20px 24px 0',
        marginBottom: 8,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,133,162,0.08)',
          border: '1px solid rgba(255,183,197,0.2)',
          borderRadius: 100, padding: '6px 18px',
          fontSize: '0.8rem', color: '#FFB7C5',
          letterSpacing: '0.06em',
        }}>
          🔗 Shared analysis · ClipInsight AI
        </div>
      </div>

      <ResultsDashboard result={result} jobId="" onReset={() => window.location.href = '/'} />

      {/* CTA */}
      <div style={{
        textAlign: 'center', padding: '48px 24px 80px',
        borderTop: '1px solid rgba(255,183,197,0.06)',
      }}>
        <p style={{ color: 'var(--text-muted, #998CAD)', marginBottom: 20, fontSize: '0.9rem' }}>
          桜の知恵 — Analyze your own video for free
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '14px 36px', borderRadius: 14,
          background: 'linear-gradient(135deg, #E8557A, #FFB7C5)',
          color: '#0F0A22', fontWeight: 700, textDecoration: 'none',
          fontSize: '1rem', letterSpacing: '0.04em',
          boxShadow: '0 8px 32px rgba(232,85,122,0.4)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(232,85,122,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(232,85,122,0.4)'; }}
        >
          🌸 Analyze Your Video →
        </a>
      </div>
    </div>
  );
}
