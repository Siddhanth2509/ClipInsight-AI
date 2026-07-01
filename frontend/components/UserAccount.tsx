'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'clipinsight_history';
const PROFILE_KEY = 'clipinsight_profile';

interface Profile {
  name:      string;
  email:     string;
  avatar:    string;
  joinedAt:  string;
  plan:      'Free' | 'Pro' | 'Enterprise';
  credits:   number;
}

const DEFAULT_PROFILE: Profile = {
  name:     'Video Creator',
  email:    'creator@example.com',
  avatar:   '',
  joinedAt: new Date().toISOString(),
  plan:     'Free',
  credits:  50,
};

function getHistory(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch { /**/ }
  return { ...DEFAULT_PROFILE };
}

function saveProfile(p: Profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /**/ }
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

/* ── Avatar initial circle ── */
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

interface UserAccountProps {
  isOpen:  boolean;
  onClose: () => void;
}

export default function UserAccount({ isOpen, onClose }: UserAccountProps) {
  const [profile,  setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [history,  setHistory]      = useState<any[]>([]);
  const [editing,  setEditing]      = useState(false);
  const [editName, setEditName]     = useState('');
  const [editEmail,setEditEmail]    = useState('');
  const [saved,    setSaved]        = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const p = getProfile();
    setProfileState(p);
    setEditName(p.name);
    setEditEmail(p.email);
    setHistory(getHistory());
  }, [isOpen]);

  if (!isOpen) return null;

  const h       = history;
  const avgScore = h.length ? Math.round(h.reduce((acc, e) => acc + (e.hookScore || 0), 0) / h.length) : 0;
  const timeSaved = Math.round(h.length * 8.5);  // ~8.5 min saved per analysis

  const handleSave = () => {
    const updated = { ...profile, name: editName, email: editEmail };
    saveProfile(updated);
    setProfileState(updated);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const PLAN_COLORS: Record<string, string> = {
    Free: '#F5C96A', Pro: '#7C5CFC', Enterprise: '#57D98D',
  };
  const PLAN_BADGES: Record<string, string> = {
    Free: '🌱', Pro: '⚡', Enterprise: '🏢',
  };

  const planColor = PLAN_COLORS[profile.plan] || '#F5C96A';

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
        width: '100%', maxWidth: 460,
        height: '100%', overflowY: 'auto',
        background: 'rgba(12,20,38,0.99)',
        borderLeft: '1px solid rgba(124,92,252,0.15)',
        boxShadow: '-40px 0 80px rgba(0,0,0,0.6)',
        animation: 'slideInRight 0.32s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* ── Header ── */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid rgba(124,92,252,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'rgba(12,20,38,0.99)', zIndex: 2,
        }}>
          <div>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--purple, #7C5CFC)', textTransform: 'uppercase', marginBottom: 3 }}>
              アカウント
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Your <span style={{ color: 'var(--purple, #7C5CFC)' }}>Account</span>
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.45)',
            cursor: 'pointer', fontSize: '0.82rem',
          }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Profile card ── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(61,217,255,0.04) 100%)',
            border: '1px solid rgba(124,92,252,0.18)',
            borderRadius: 18, padding: '20px',
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
              <Avatar name={profile.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {!editing ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{profile.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{profile.email}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 100, fontSize: '0.68rem',
                        fontWeight: 600, background: `${planColor}18`,
                        border: `1px solid ${planColor}30`, color: planColor,
                      }}>
                        {PLAN_BADGES[profile.plan]} {profile.plan}
                      </span>
                      <span style={{
                        padding: '2px 10px', borderRadius: 100, fontSize: '0.68rem',
                        background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)',
                      }}>
                        {profile.credits} credits
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      placeholder="Display name"
                      style={{
                        padding: '7px 12px', borderRadius: 8, fontSize: '0.84rem',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(124,92,252,0.25)',
                        color: '#F8FAFC', outline: 'none',
                      }} />
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                      placeholder="Email address" type="email"
                      style={{
                        padding: '7px 12px', borderRadius: 8, fontSize: '0.84rem',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(124,92,252,0.25)',
                        color: '#F8FAFC', outline: 'none',
                      }} />
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!editing ? (
                <button onClick={() => setEditing(true)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontSize: '0.78rem',
                  background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.2)',
                  color: '#B49EFF', cursor: 'pointer',
                }}>✏ Edit Profile</button>
              ) : (
                <>
                  <button onClick={handleSave} style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: '0.78rem',
                    background: 'var(--purple, #7C5CFC)', border: 'none',
                    color: '#fff', cursor: 'pointer', fontWeight: 600,
                  }}>Save Changes</button>
                  <button onClick={() => setEditing(false)} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: '0.78rem',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                  }}>Cancel</button>
                </>
              )}
            </div>
            {saved && (
              <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.75rem', color: '#57D98D' }}>
                ✓ Profile saved
              </div>
            )}
          </div>

          {/* ── Stats grid ── */}
          <div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
              Your Stats
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <StatCard icon="🎬" label="Videos Analyzed" value={h.length} color="var(--purple, #7C5CFC)" />
              <StatCard icon="⚡" label="Avg Hook Score"  value={avgScore > 0 ? avgScore : '—'} color="#F5C96A" />
              <StatCard icon="⏱" label="Minutes Saved"   value={`${timeSaved}m`} color="#57D98D" />
              <StatCard icon="💎" label="AI Credits Left" value={profile.credits} color="#3DD9FF" />
            </div>
          </div>

          {/* ── Plan upgrade CTA ── */}
          {profile.plan === 'Free' && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(61,217,255,0.08))',
              border: '1px solid rgba(124,92,252,0.25)',
              borderRadius: 16, padding: '18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>Upgrade to Pro</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                    Unlimited analyses, priority processing,<br />full PDF reports &amp; API access.
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 100,
                  background: 'rgba(245,201,106,0.15)', border: '1px solid rgba(245,201,106,0.25)',
                  fontSize: '0.72rem', color: '#F5C96A', fontWeight: 600,
                }}>$29/mo</span>
              </div>
              <button style={{
                width: '100%', padding: '10px', borderRadius: 10,
                background: 'linear-gradient(135deg, var(--purple, #7C5CFC), var(--cyan, #3DD9FF))',
                border: 'none', color: '#fff', fontSize: '0.84rem', fontWeight: 700,
                cursor: 'pointer',
              }}>
                ⚡ Start Free Trial
              </button>
            </div>
          )}

          {/* ── Recent analyses ── */}
          <div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
              Recent Analyses
            </div>
            {h.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📊</div>
                No analyses yet. Paste a video URL to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {h.slice(0, 5).map((entry: any) => (
                  <div key={entry.jobId} style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'border-color 0.2s',
                    cursor: 'default',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(124,92,252,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem',
                    }}>🎬</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginBottom: 3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.summary || 'Analysis result'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700,
                          color: entry.hookScore >= 70 ? '#57D98D' : entry.hookScore >= 50 ? '#F5C96A' : '#f87171',
                        }}>
                          {entry.hookScore}/100
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>
                          {new Date(entry.analyzedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sign out / settings ── */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: 16, display: 'flex', gap: 8,
          }}>
            <button style={{
              flex: 1, padding: '10px', borderRadius: 10, fontSize: '0.78rem',
              background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)',
              color: '#f87171', cursor: 'pointer',
            }}>
              Sign Out
            </button>
            <button style={{
              padding: '10px 18px', borderRadius: 10, fontSize: '0.78rem',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            }}>
              ⚙ Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
