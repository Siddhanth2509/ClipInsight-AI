'use client';
import { useState } from 'react';

// ── Auth helpers ──────────────────────────────────────────────────────────────
export const AUTH_KEY     = 'clipinsight_auth';
export const USERS_DB_KEY = 'clipinsight_users_db';
export const ADMIN_EMAIL  = 'admin@clipinsight.ai';
export const ADMIN_PASS   = 'Admin@ClipInsight2025';

export interface AuthUser {
  id:        string;
  name:      string;
  email:     string;
  password:  string; // hashed (simple btoa for demo — replace with crypto in prod)
  plan:      'Free' | 'Pro' | 'Enterprise';
  credits:   number;
  isAdmin:   boolean;
  joinedAt:  string;
  analyses:  number;
}

function hashPass(p: string): string { return btoa(p); }
function checkPass(p: string, h: string): boolean { return btoa(p) === h; }

export function getUsersDb(): AuthUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]'); }
  catch { return []; }
}
export function saveUsersDb(users: AuthUser[]) {
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
}
export function getCurrentUser(): AuthUser | null {
  try { const raw = localStorage.getItem(AUTH_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
export function setCurrentUser(u: AuthUser | null) {
  if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
  else    localStorage.removeItem(AUTH_KEY);
}
export function updateCurrentUser(updates: Partial<AuthUser>) {
  const u = getCurrentUser();
  if (!u) return;
  const updated = { ...u, ...updates };
  setCurrentUser(updated);
  // Also sync to users db
  const db = getUsersDb();
  const idx = db.findIndex(x => x.id === u.id);
  if (idx >= 0) { db[idx] = updated; saveUsersDb(db); }
}
export function deductCredit(amount = 1) {
  const u = getCurrentUser();
  if (!u) return;
  updateCurrentUser({ credits: Math.max(0, u.credits - amount), analyses: (u.analyses || 0) + 1 });
}
export function signOut() {
  setCurrentUser(null);
  window.location.reload();
}

// ── Component ─────────────────────────────────────────────────────────────────
interface AuthModalProps {
  isOpen:  boolean;
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
}

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [tab,       setTab]       = useState<'login' | 'signup'>('login');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  if (!isOpen) return null;

  const handleLogin = () => {
    setError(''); setLoading(true);
    setTimeout(() => {
      // Admin shortcut
      if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
        const admin: AuthUser = {
          id: 'admin-001', name: 'Admin', email: ADMIN_EMAIL,
          password: hashPass(ADMIN_PASS), plan: 'Enterprise',
          credits: 99999, isAdmin: true, joinedAt: new Date().toISOString(), analyses: 0,
        };
        setCurrentUser(admin);
        onLogin(admin);
        onClose();
        setLoading(false);
        return;
      }
      const db = getUsersDb();
      const user = db.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) { setError('No account found with that email.'); setLoading(false); return; }
      if (!checkPass(password, user.password)) { setError('Incorrect password.'); setLoading(false); return; }
      setCurrentUser(user);
      onLogin(user);
      onClose();
      setLoading(false);
    }, 600);
  };

  const handleSignup = () => {
    setError(''); setLoading(true);
    setTimeout(() => {
      if (!name.trim())             { setError('Please enter your name.'); setLoading(false); return; }
      if (!email.includes('@'))     { setError('Please enter a valid email.'); setLoading(false); return; }
      if (password.length < 6)      { setError('Password must be at least 6 characters.'); setLoading(false); return; }
      const db = getUsersDb();
      if (db.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        setError('An account with this email already exists.'); setLoading(false); return;
      }
      const newUser: AuthUser = {
        id:        `user-${Date.now()}`,
        name:      name.trim(),
        email:     email.toLowerCase().trim(),
        password:  hashPass(password),
        plan:      'Free',
        credits:   50,
        isAdmin:   false,
        joinedAt:  new Date().toISOString(),
        analyses:  0,
      };
      db.push(newUser);
      saveUsersDb(db);
      setCurrentUser(newUser);
      onLogin(newUser);
      onClose();
      setLoading(false);
    }, 600);
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: '0.9rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,92,252,0.25)',
    color: '#F8FAFC', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };
  const lbl: React.CSSProperties = {
    fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5, display: 'block',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(2,11,24,0.88)', backdropFilter: 'blur(24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(12,20,38,0.98)',
        border: '1px solid rgba(124,92,252,0.2)',
        borderRadius: 24,
        boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,92,252,0.1)',
        overflow: 'hidden',
        animation: 'authFadeIn 0.3s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{`
          @keyframes authFadeIn {
            from { opacity: 0; transform: translateY(20px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          .auth-input:focus { border-color: rgba(124,92,252,0.6) !important; }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '28px 28px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8, padding: '5px 10px', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: '0.8rem',
          }}>✕</button>
          <div style={{ fontSize: '0.58rem', color: 'var(--purple, #7C5CFC)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
            ClipInsight AI
          </div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>
            {tab === 'login' ? 'Welcome back 👋' : 'Create account ✨'}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
            {tab === 'login' ? 'Sign in to your account to continue' : 'Join thousands of content creators'}
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {(['login', 'signup'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '13px', fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                background: tab === t ? 'rgba(124,92,252,0.08)' : 'transparent',
                color: tab === t ? 'var(--purple, #7C5CFC)' : 'rgba(255,255,255,0.35)',
                borderBottom: tab === t ? '2px solid var(--purple, #7C5CFC)' : '2px solid transparent',
              }}
            >
              {t === 'login' ? '🔐 Sign In' : '✨ Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'signup' && (
            <div>
              <label style={lbl}>Your Name</label>
              <input
                className="auth-input" style={inp}
                placeholder="e.g. Siddhanth Sharma"
                value={name} onChange={e => setName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label style={lbl}>Email Address</label>
            <input
              className="auth-input" style={inp}
              placeholder="you@email.com" type="email"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label style={lbl}>Password</label>
            <input
              className="auth-input" style={inp}
              placeholder={tab === 'signup' ? 'Min. 6 characters' : 'Your password'}
              type="password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleSignup())}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
              color: '#f87171', fontSize: '0.8rem',
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            onClick={tab === 'login' ? handleLogin : handleSignup}
            disabled={loading}
            style={{
              width: '100%', padding: '13px', borderRadius: 12,
              background: loading ? 'rgba(124,92,252,0.4)' : 'linear-gradient(135deg, #7C5CFC, #3DD9FF)',
              border: 'none', color: '#fff', fontSize: '0.92rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(124,92,252,0.35)',
            }}
          >
            {loading ? '⏳ Please wait...' : tab === 'login' ? '🔐 Sign In' : '✨ Create Account'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.74rem', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <span
              onClick={() => { setTab(tab === 'login' ? 'signup' : 'login'); setError(''); }}
              style={{ color: 'var(--purple, #7C5CFC)', cursor: 'pointer', fontWeight: 600 }}
            >
              {tab === 'login' ? 'Sign Up' : 'Sign In'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
