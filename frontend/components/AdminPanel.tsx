'use client';
import { useState, useEffect } from 'react';
import { getUsersDb, saveUsersDb, AuthUser } from './AuthModal';

interface AdminPanelProps {
  isOpen:  boolean;
  onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [users,       setUsers]       = useState<AuthUser[]>([]);
  const [selected,    setSelected]    = useState<AuthUser | null>(null);
  const [editCredits, setEditCredits] = useState('');
  const [editPlan,    setEditPlan]    = useState<'Free' | 'Pro' | 'Enterprise'>('Free');
  const [saved,       setSaved]       = useState(false);
  const [tab,         setTab]         = useState<'users' | 'stats'>('users');
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    if (isOpen) setUsers(getUsersDb());
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalAnalyses = users.reduce((s, u) => s + (u.analyses || 0), 0);
  const proUsers      = users.filter(u => u.plan === 'Pro').length;
  const freeUsers     = users.filter(u => u.plan === 'Free').length;

  const handleSaveUser = () => {
    if (!selected) return;
    const db = getUsersDb();
    const idx = db.findIndex(u => u.id === selected.id);
    if (idx >= 0) {
      db[idx] = { ...db[idx], credits: parseInt(editCredits) || 0, plan: editPlan };
      saveUsersDb(db);
      setUsers([...db]);
      setSelected(db[idx]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (!confirm('Delete this user?')) return;
    const db = getUsersDb().filter(u => u.id !== id);
    saveUsersDb(db);
    setUsers(db);
    if (selected?.id === id) setSelected(null);
  };

  const PLAN_COLORS: Record<string, string> = {
    Free: '#F5C96A', Pro: '#7C5CFC', Enterprise: '#57D98D',
  };

  const statCard = (icon: string, label: string, value: string | number, color: string) => (
    <div style={{
      flex: 1, minWidth: 120,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{label}</div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(2,11,24,0.88)', backdropFilter: 'blur(24px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 20px', overflowY: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 900,
        background: 'rgba(8,16,32,0.99)',
        border: '1px solid rgba(124,92,252,0.25)',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
        animation: 'adminFadeIn 0.3s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{`
          @keyframes adminFadeIn {
            from { opacity: 0; transform: translateY(24px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid rgba(124,92,252,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(124,92,252,0.08), rgba(61,217,255,0.04))',
        }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: 'var(--purple, #7C5CFC)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              🛡 Administrator
            </div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
              Admin <span style={{ color: 'var(--purple, #7C5CFC)' }}>Control Panel</span>
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.45)',
            cursor: 'pointer', fontSize: '0.82rem',
          }}>✕ Close</button>
        </div>

        {/* Stats row */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {statCard('👥', 'Total Users',     users.length,   '#7C5CFC')}
          {statCard('⚡', 'Pro Users',       proUsers,        '#7C5CFC')}
          {statCard('🌱', 'Free Users',      freeUsers,       '#F5C96A')}
          {statCard('📊', 'Total Analyses',  totalAnalyses,   '#57D98D')}
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {(['users', 'stats'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '12px 24px', fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              background: tab === t ? 'rgba(124,92,252,0.08)' : 'transparent',
              color: tab === t ? '#7C5CFC' : 'rgba(255,255,255,0.35)',
              borderBottom: tab === t ? '2px solid #7C5CFC' : '2px solid transparent',
            }}>
              {t === 'users' ? '👥 User Management' : '📊 Platform Stats'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ display: 'flex', minHeight: 400 }}>
          {/* User list */}
          <div style={{ width: 340, borderRight: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', maxHeight: 520 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <input
                placeholder="🔍 Search users..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F8FAFC', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem' }}>
                No users yet.<br/>Users appear here after signing up.
              </div>
            ) : (
              filtered.map(u => (
                <div
                  key={u.id}
                  onClick={() => { setSelected(u); setEditCredits(String(u.credits)); setEditPlan(u.plan); }}
                  style={{
                    padding: '14px 16px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: selected?.id === u.id ? 'rgba(124,92,252,0.1)' : 'transparent',
                    borderLeft: selected?.id === u.id ? '3px solid #7C5CFC' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7C5CFC, #3DD9FF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.82rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {u.name}
                        {u.isAdmin && <span style={{ fontSize: '0.6rem', background: 'rgba(124,92,252,0.2)', color: '#7C5CFC', padding: '1px 6px', borderRadius: 100 }}>ADMIN</span>}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    </div>
                    <span style={{
                      fontSize: '0.62rem', padding: '2px 8px', borderRadius: 100,
                      background: `${PLAN_COLORS[u.plan]}18`, color: PLAN_COLORS[u.plan],
                      border: `1px solid ${PLAN_COLORS[u.plan]}30`,
                    }}>{u.plan}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* User detail / editor */}
          <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
            {!selected ? (
              <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>👤</div>
                Select a user to view and edit their details
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7C5CFC, #3DD9FF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', fontWeight: 700, color: '#fff',
                  }}>
                    {selected.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>{selected.email}</div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                      Joined {new Date(selected.joinedAt).toLocaleDateString()} · {selected.analyses || 0} analyses
                    </div>
                  </div>
                </div>

                {/* Edit section */}
                <div style={{ background: 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.15)', borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Edit Account</div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>AI Credits</label>
                    <input
                      type="number" value={editCredits}
                      onChange={e => setEditCredits(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: '0.88rem',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,92,252,0.25)',
                        color: '#F8FAFC', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Plan</label>
                    <select
                      value={editPlan}
                      onChange={e => setEditPlan(e.target.value as any)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: '0.88rem',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,92,252,0.25)',
                        color: '#F8FAFC', outline: 'none', boxSizing: 'border-box',
                      }}
                    >
                      <option value="Free">🌱 Free</option>
                      <option value="Pro">⚡ Pro</option>
                      <option value="Enterprise">🏢 Enterprise</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleSaveUser}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10,
                        background: 'var(--purple, #7C5CFC)', border: 'none',
                        color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {saved ? '✓ Saved!' : '💾 Save Changes'}
                    </button>
                    {!selected.isAdmin && (
                      <button
                        onClick={() => handleDeleteUser(selected.id)}
                        style={{
                          padding: '10px 16px', borderRadius: 10,
                          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                          color: '#f87171', fontSize: '0.82rem', cursor: 'pointer',
                        }}
                      >
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
