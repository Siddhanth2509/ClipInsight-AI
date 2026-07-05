'use client';
import { useState, useEffect } from 'react';
import { getCurrentUser, updateCurrentUser, signOut, AuthUser } from './AuthModal';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const STORAGE_KEY = 'clipinsight_history';

function getHistory(): any[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

/* ── Stat card ── */
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '16px 18px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  );
}

/* ── Avatar ── */
function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--purple, #7C5CFC), var(--cyan, #3DD9FF))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 800, color: '#fff',
      flexShrink: 0, boxShadow: '0 0 0 3px rgba(124,92,252,0.2)',
    }}>
      {initials}
    </div>
  );
}

/* ── Settings panel ── */
function SettingsPanel({ user, onSaved }: { user: AuthUser; onSaved: () => void }) {
  const [name,  setName]  = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saved, setSaved] = useState(false);

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: '0.88rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,92,252,0.25)',
    color: '#F8FAFC', outline: 'none', boxSizing: 'border-box', marginTop: 6,
  };
  const lbl: React.CSSProperties = {
    fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em',
  };

  const handleSave = () => {
    updateCurrentUser({ name, email });
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>
        Account Settings
      </div>
      <div>
        <label style={lbl}>Display Name</label>
        <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
      </div>
      <div>
        <label style={lbl}>Email Address</label>
        <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
      </div>
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'rgba(245,201,106,0.06)', border: '1px solid rgba(245,201,106,0.15)',
      }}>
        <div style={{ fontSize: '0.7rem', color: '#F5C96A', marginBottom: 6 }}>🔐 Password</div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
          To change your password, sign out and use the reset flow on login.
        </div>
      </div>
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'rgba(61,217,255,0.04)', border: '1px solid rgba(61,217,255,0.12)',
      }}>
        <div style={{ fontSize: '0.7rem', color: '#3DD9FF', marginBottom: 6 }}>🎨 Theme</div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
          Use the theme dots in the top navigation bar to switch themes.
        </div>
      </div>
      <button
        onClick={handleSave}
        style={{
          padding: '11px', borderRadius: 10,
          background: saved ? '#57D98D' : 'linear-gradient(135deg, #7C5CFC, #3DD9FF)',
          border: 'none', color: '#fff', fontSize: '0.88rem', fontWeight: 700,
          cursor: 'pointer', transition: 'all 0.3s',
        }}
      >
        {saved ? '✓ Changes Saved!' : '💾 Save Settings'}
      </button>
    </div>
  );
}

/* ── AI Core Status ── */
function AiCoreStatus() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch(`${BACKEND}/health`)
      .then(r => r.json())
      .then(d => setHealth(d))
      .catch(() => setHealth({ status: 'offline' }));
  }, []);

  const isOnline = health?.status === 'ok';
  const h = getHistory();
  const uptime   = health?.uptime_seconds ? `${Math.round(health.uptime_seconds / 60)}m` : '—';
  const jobsDone = health?.jobs_processed ?? h.length;
  const latency  = health?.avg_latency_ms ? `${health.avg_latency_ms}ms` : '<200ms';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>
        AI Core Status
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12,
        background: isOnline ? 'rgba(87,217,141,0.06)' : 'rgba(248,113,113,0.06)',
        border: `1px solid ${isOnline ? 'rgba(87,217,141,0.2)' : 'rgba(248,113,113,0.2)'}`,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isOnline ? '#57D98D' : '#f87171',
          boxShadow: `0 0 6px ${isOnline ? '#57D98D' : '#f87171'}`,
          animation: isOnline ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isOnline ? '#57D98D' : '#f87171' }}>
          {health === null ? 'Connecting…' : isOnline ? 'All Systems Operational' : 'Backend Offline'}
        </span>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'Uptime',       value: uptime    },
          { label: 'Jobs Done',    value: jobsDone  },
          { label: 'Avg Latency',  value: latency   },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#3DD9FF' }}>{s.value}</div>
            <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ── */
interface UserAccountProps {
  isOpen:      boolean;
  onClose:     () => void;
  onOpenAdmin: () => void;
  onOpenPayment: (plan: 'Pro' | 'Enterprise') => void;
  onOpenAuth:  () => void;
}

export default function UserAccount({ isOpen, onClose, onOpenAdmin, onOpenPayment, onOpenAuth }: UserAccountProps) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [tab,     setTab]     = useState<'overview' | 'history' | 'settings'>('overview');

  useEffect(() => {
    if (!isOpen) return;
    setUser(getCurrentUser());
    setHistory(getHistory());
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Not logged in ──
  if (!user) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(2,11,24,0.82)', backdropFilter: 'blur(20px)',
          display: 'flex', justifyContent: 'flex-end',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          width: '100%', maxWidth: 460, height: '100%',
          background: 'rgba(12,20,38,0.99)',
          borderLeft: '1px solid rgba(124,92,252,0.15)',
          boxShadow: '-40px 0 80px rgba(0,0,0,0.6)',
          animation: 'slideInRight 0.32s cubic-bezier(0.22,1,0.36,1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: 32,
        }}>
          <style>{`@keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }`}</style>
          <button onClick={onClose} style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.45)',
            cursor: 'pointer', fontSize: '0.82rem',
          }}>✕</button>
          <div style={{ fontSize: '4rem' }}>🔐</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' }}>
            Sign in to <span style={{ color: 'var(--purple, #7C5CFC)' }}>ClipInsight AI</span>
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.6 }}>
            Create an account or sign in to track your analyses, manage credits, and access your full history.
          </p>
          <button
            onClick={() => { onClose(); onOpenAuth(); }}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, marginTop: 8,
              background: 'linear-gradient(135deg, #7C5CFC, #3DD9FF)',
              border: 'none', color: '#fff', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(124,92,252,0.35)',
            }}
          >
            🔐 Sign In / Create Account
          </button>
        </div>
      </div>
    );
  }

  // ── Logged in ──
  const h = history;
  const avgScore   = h.length ? Math.round(h.reduce((a, e) => a + (e.hookScore || 0), 0) / h.length) : 0;
  const timeSaved  = Math.round(h.length * 8.5);
  const PLAN_COLORS: Record<string, string> = { Free: '#F5C96A', Pro: '#7C5CFC', Enterprise: '#57D98D' };
  const planColor  = PLAN_COLORS[user.plan] || '#F5C96A';

  const TABS: { id: typeof tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview',  icon: '👤' },
    { id: 'history',  label: 'History',   icon: '🕐' },
    { id: 'settings', label: 'Settings',  icon: '⚙' },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(2,11,24,0.82)', backdropFilter: 'blur(20px)',
        display: 'flex', justifyContent: 'flex-end',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 460, height: '100%', overflowY: 'auto',
        background: 'rgba(12,20,38,0.99)',
        borderLeft: '1px solid rgba(124,92,252,0.15)',
        boxShadow: '-40px 0 80px rgba(0,0,0,0.6)',
        animation: 'slideInRight 0.32s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{`@keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }`}</style>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(124,92,252,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'rgba(12,20,38,0.99)', zIndex: 2,
        }}>
          <div>
            <div style={{ fontSize: '0.58rem', letterSpacing: '0.2em', color: 'var(--purple, #7C5CFC)', textTransform: 'uppercase', marginBottom: 3 }}>
              アカウント
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Your <span style={{ color: 'var(--purple, #7C5CFC)' }}>Account</span>
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {user.isAdmin && (
              <button
                onClick={() => { onClose(); onOpenAdmin(); }}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700,
                  background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.3)',
                  color: '#7C5CFC', cursor: 'pointer',
                }}
              >🛡 Admin</button>
            )}
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.45)',
              cursor: 'pointer', fontSize: '0.82rem',
            }}>✕</button>
          </div>
        </div>

        {/* Profile strip */}
        <div style={{
          padding: '18px 24px 14px',
          background: 'linear-gradient(135deg, rgba(124,92,252,0.07), rgba(61,217,255,0.03))',
          borderBottom: '1px solid rgba(124,92,252,0.08)',
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <Avatar name={user.name} size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
              {user.name}
              {user.isAdmin && (
                <span style={{ fontSize: '0.58rem', background: 'rgba(124,92,252,0.2)', color: '#7C5CFC', padding: '2px 7px', borderRadius: 100, fontWeight: 700 }}>
                  ADMIN
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{user.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 10px', borderRadius: 100, fontSize: '0.67rem', fontWeight: 600,
                background: `${planColor}18`, border: `1px solid ${planColor}30`, color: planColor,
              }}>
                {user.plan === 'Free' ? '🌱' : user.plan === 'Pro' ? '⚡' : '🏢'} {user.plan}
              </span>
              <span style={{
                padding: '2px 10px', borderRadius: 100, fontSize: '0.67rem',
                background: 'rgba(61,217,255,0.08)', border: '1px solid rgba(61,217,255,0.15)', color: '#3DD9FF',
              }}>
                💎 {user.credits} credits
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '11px 6px', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              background: tab === t.id ? 'rgba(124,92,252,0.07)' : 'transparent',
              color: tab === t.id ? '#7C5CFC' : 'rgba(255,255,255,0.35)',
              borderBottom: tab === t.id ? '2px solid #7C5CFC' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <>
              {/* Stats */}
              <div>
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
                  Your Stats
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <StatCard icon="🎬" label="Videos Analyzed" value={h.length}                color="var(--purple, #7C5CFC)" />
                  <StatCard icon="⚡" label="Avg Hook Score"  value={avgScore > 0 ? avgScore : '—'} color="#F5C96A" />
                  <StatCard icon="⏱" label="Minutes Saved"   value={`${timeSaved}m`}           color="#57D98D" />
                  <StatCard icon="💎" label="Credits Left"    value={user.credits}               color="#3DD9FF" />
                </div>
              </div>

              {/* AI Core Status — live */}
              <AiCoreStatus />

              {/* Upgrade CTA */}
              {user.plan === 'Free' && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(61,217,255,0.08))',
                  border: '1px solid rgba(124,92,252,0.25)', borderRadius: 16, padding: '18px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>Upgrade to Pro</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                        Unlimited analyses, priority processing,<br />full PDF reports & API access.
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: 100,
                      background: 'rgba(245,201,106,0.15)', border: '1px solid rgba(245,201,106,0.25)',
                      fontSize: '0.72rem', color: '#F5C96A', fontWeight: 600,
                    }}>$29/mo</span>
                  </div>
                  <button
                    onClick={() => { onClose(); onOpenPayment('Pro'); }}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 10,
                      background: 'linear-gradient(135deg, var(--purple, #7C5CFC), var(--cyan, #3DD9FF))',
                      border: 'none', color: '#fff', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ⚡ Upgrade Now — $29/mo
                  </button>
                </div>
              )}

              {/* Low credits warning */}
              {user.credits <= 5 && user.plan === 'Free' && (
                <div style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                  display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f87171' }}>Low Credits Warning</div>
                    <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      Only {user.credits} credit{user.credits !== 1 ? 's' : ''} remaining. Upgrade to continue analyzing.
                    </div>
                  </div>
                </div>
              )}

              {/* Recent analyses preview */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                    Recent Analyses
                  </div>
                  {h.length > 3 && (
                    <button onClick={() => setTab('history')} style={{
                      fontSize: '0.7rem', color: '#7C5CFC', background: 'none', border: 'none', cursor: 'pointer',
                    }}>View all →</button>
                  )}
                </div>
                {h.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>📊</div>
                    No analyses yet. Paste a video URL to start.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {h.slice(0, 3).map((e: any) => (
                      <div key={e.jobId} style={{
                        display: 'flex', gap: 12, alignItems: 'center', padding: '11px 13px',
                        borderRadius: 11, background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124,92,252,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🎬</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.summary || 'Analysis result'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: e.hookScore >= 70 ? '#57D98D' : e.hookScore >= 50 ? '#F5C96A' : '#f87171' }}>
                              {e.hookScore}/100
                            </span>
                            <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.25)' }}>
                              {new Date(e.analyzedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 14 }}>
                All Analyses ({h.length})
              </div>
              {h.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.25)', fontSize: '0.84rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>📊</div>
                  No analyses yet.<br />Paste a video URL to get started.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {h.map((e: any) => (
                    <div key={e.jobId} style={{
                      display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px',
                      borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(124,92,252,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🎬</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                          {e.summary || 'Analysis result'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: e.hookScore >= 70 ? '#57D98D' : e.hookScore >= 50 ? '#F5C96A' : '#f87171' }}>
                            Hook: {e.hookScore}/100
                          </span>
                          <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.25)' }}>
                            {new Date(e.analyzedAt).toLocaleDateString()}
                          </span>
                          {e.sentiment && (
                            <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)' }}>{e.sentiment}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab === 'settings' && (
            <SettingsPanel user={user} onSaved={() => setUser(getCurrentUser())} />
          )}

          {/* ── Sign Out (always visible at bottom) ── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to sign out?')) signOut();
              }}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, fontSize: '0.78rem',
                background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)',
                color: '#f87171', cursor: 'pointer', fontWeight: 600,
              }}
            >
              🚪 Sign Out
            </button>
            {user.plan === 'Free' && (
              <button
                onClick={() => { onClose(); onOpenPayment('Pro'); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontSize: '0.78rem',
                  background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.2)',
                  color: '#B49EFF', cursor: 'pointer', fontWeight: 600,
                }}
              >
                ⚡ Upgrade Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
