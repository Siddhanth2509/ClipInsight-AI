'use client';
import { useState } from 'react';
import { getCurrentUser, updateCurrentUser } from './AuthModal';

interface PaymentModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  plan?:     'Pro' | 'Enterprise';
  onSuccess?: () => void;
}

const PLANS = {
  Pro: {
    name:    'Pro',
    price:   '₹2,499',
    priceUS: '$29',
    usd:     29,
    inr:     2499,
    credits: 500,
    color:   '#7C5CFC',
    icon:    '⚡',
    desc:    'For serious creators and teams',
    features: ['Unlimited analyses', 'URL + file upload', 'Full PDF reports', 'Priority processing', 'API access (1000 req/mo)', 'Email support'],
  },
  Enterprise: {
    name:    'Enterprise',
    price:   'Custom',
    priceUS: 'Custom',
    usd:     0,
    inr:     0,
    credits: 99999,
    color:   '#57D98D',
    icon:    '🏢',
    desc:    'For organisations at scale',
    features: ['Unlimited everything', 'Dedicated infrastructure', 'Custom integrations', 'SLA guarantee', 'Dedicated support'],
  },
};

// Token / credit packs (custom plan)
const TOKEN_PACKS = [
  { label: '100 credits',   credits: 100,   inr: 499,   usd: 6,   display: '₹499' },
  { label: '300 credits',   credits: 300,   inr: 1299,  usd: 16,  display: '₹1,299' },
  { label: '500 credits',   credits: 500,   inr: 1999,  usd: 24,  display: '₹1,999' },
  { label: '1,000 credits', credits: 1000,  inr: 3499,  usd: 42,  display: '₹3,499' },
  { label: '2,500 credits', credits: 2500,  inr: 7999,  usd: 96,  display: '₹7,999' },
];

const UPI_ID = 'clipinsight@paytm'; // Replace with real UPI ID

export default function PaymentModal({ isOpen, onClose, plan = 'Pro', onSuccess }: PaymentModalProps) {
  const [method,     setMethod]     = useState<'upi' | 'razorpay' | 'paypal'>('upi');
  const [upiRef,     setUpiRef]     = useState('');
  const [step,       setStep]       = useState<'select' | 'pay' | 'done'>('select');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  // For custom token pack selection
  const [planType,   setPlanType]   = useState<'Pro' | 'Enterprise' | 'custom'>(plan);
  const [tokenPack,  setTokenPack]  = useState(TOKEN_PACKS[2]);

  const planInfo = planType === 'custom'
    ? { name: 'Custom Pack', price: tokenPack.display, priceUS: `$${tokenPack.usd}`, usd: tokenPack.usd, inr: tokenPack.inr, credits: tokenPack.credits, color: '#F5C96A' }
    : PLANS[planType as 'Pro' | 'Enterprise'];

  if (!isOpen) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2500,
    background: 'rgba(2,11,24,0.92)', backdropFilter: 'blur(28px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const handleUPIConfirm = () => {
    if (!upiRef.trim()) { setError('Please enter your UPI transaction ID'); return; }
    setLoading(true);
    setTimeout(() => {
      const u = getCurrentUser();
      if (u) updateCurrentUser({ plan: planType === 'custom' ? u.plan : planType as any, credits: (u.credits || 0) + planInfo.credits });
      setLoading(false);
      setStep('done');
    }, 1500);
  };

  const handleRazorpay = () => {
    setLoading(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY || 'rzp_test_placeholder',
        amount: planInfo.inr * 100,
        currency: 'INR',
        name: 'ClipInsight AI',
        description: `${planInfo.name} — ${planInfo.credits} credits`,
        handler: () => {
          const u = getCurrentUser();
          if (u) updateCurrentUser({ plan: planType === 'custom' ? u.plan : planType as any, credits: (u.credits || 0) + planInfo.credits });
          setLoading(false);
          setStep('done');
        },
        prefill: { name: getCurrentUser()?.name, email: getCurrentUser()?.email },
        theme: { color: planInfo.color },
        modal: { ondismiss: () => setLoading(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    };
    script.onerror = () => { setLoading(false); setError('Razorpay SDK failed to load. Try UPI or PayPal.'); };
    document.body.appendChild(script);
  };

  const handlePayPal = () => {
    setLoading(true);
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test'}&currency=USD`;
    script.onload = () => {
      setLoading(false);
      setStep('pay');
      setTimeout(() => {
        const container = document.getElementById('paypal-button-container');
        if (!container || !(window as any).paypal) return;
        container.innerHTML = '';
        (window as any).paypal.Buttons({
          createOrder: (_: any, actions: any) => actions.order.create({
            purchase_units: [{ amount: { value: String(planInfo.usd) } }],
          }),
          onApprove: (_: any, actions: any) => actions.order.capture().then(() => {
            const u = getCurrentUser();
            if (u) updateCurrentUser({ plan: planType === 'custom' ? u.plan : planType as any, credits: (u.credits || 0) + planInfo.credits });
            setStep('done');
          }),
          onError: () => setError('PayPal payment failed. Please try again.'),
        }).render('#paypal-button-container');
      }, 200);
    };
    script.onerror = () => { setLoading(false); setError('PayPal SDK failed to load.'); };
    document.body.appendChild(script);
  };

  /* ── Done screen ── */
  if (step === 'done') {
    return (
      <div style={overlay}>
        <div style={{
          textAlign: 'center', padding: 48,
          background: 'rgba(12,20,38,0.99)', borderRadius: 24,
          border: '1px solid rgba(87,217,141,0.3)',
          boxShadow: '0 0 80px rgba(87,217,141,0.15)',
          maxWidth: 380, width: '100%',
          animation: 'payFadeIn 0.35s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <style>{`@keyframes payFadeIn { from { opacity:0; transform:translateY(20px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800, color: '#57D98D' }}>Payment Successful!</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', margin: '0 0 24px', lineHeight: 1.7 }}>
            You're on the <strong style={{ color: planInfo.color }}>{planInfo.name}</strong> plan.<br/>
            <strong style={{ color: '#3DD9FF' }}>{planInfo.credits.toLocaleString()} credits</strong> added to your account.
          </p>
          <button
            onClick={() => { onSuccess?.(); onClose(); setStep('select'); }}
            style={{
              padding: '12px 32px', borderRadius: 12,
              background: 'linear-gradient(135deg, #57D98D, #3DD9FF)',
              border: 'none', color: '#fff', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(87,217,141,0.3)',
            }}
          >
            ✓ Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '100%', maxWidth: step === 'select' ? 680 : 520,
        background: 'rgba(10,18,36,0.99)',
        border: '1px solid rgba(124,92,252,0.18)',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 40px 120px rgba(0,0,0,0.85)',
        animation: 'payFadeIn 0.3s cubic-bezier(0.22,1,0.36,1)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <style>{`
          @keyframes payFadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          .pay-method:hover { border-color: rgba(124,92,252,0.5) !important; background: rgba(124,92,252,0.07) !important; }
          .plan-card-select { cursor:pointer; transition: all 0.2s; }
          .plan-card-select:hover { transform: translateY(-2px); }
        `}</style>

        {/* Modal Header */}
        <div style={{
          padding: '22px 28px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(135deg, rgba(124,92,252,0.08), rgba(61,217,255,0.03))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: '#7C5CFC', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              {step === 'select' ? 'Choose Your Plan' : `Upgrade — ${planInfo.name}`}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              {step === 'select' ? 'Select a Plan' : <>{planInfo.name} <span style={{ color: planInfo.color }}>— {planInfo.price}</span></>}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 10, padding: '7px 12px', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: '0.82rem', flexShrink: 0,
          }}>✕</button>
        </div>

        {/* ── STEP 1: Plan Selection ── */}
        {step === 'select' && (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Plan cards */}
            <div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Select Plan
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {/* Pro */}
                {(['Pro', 'Enterprise', 'custom'] as const).map(pt => {
                  const info = pt === 'custom'
                    ? { name: 'Custom Pack', price: tokenPack.display, icon: '🎯', color: '#F5C96A', desc: 'Choose exactly how many credits' }
                    : { ...PLANS[pt as 'Pro' | 'Enterprise'], desc: PLANS[pt as 'Pro' | 'Enterprise'].desc };
                  const selected = planType === pt;
                  return (
                    <div
                      key={pt}
                      className="plan-card-select"
                      onClick={() => setPlanType(pt)}
                      style={{
                        borderRadius: 16, padding: '18px 16px',
                        border: `1px solid ${selected ? info.color : 'rgba(255,255,255,0.07)'}`,
                        background: selected ? `${info.color}10` : 'rgba(255,255,255,0.02)',
                        boxShadow: selected ? `0 0 0 1px ${info.color}30, 0 8px 28px ${info.color}15` : 'none',
                        position: 'relative',
                      }}
                    >
                      {selected && (
                        <div style={{
                          position: 'absolute', top: -8, right: 12,
                          background: info.color, borderRadius: 100,
                          padding: '2px 8px', fontSize: '0.6rem', fontWeight: 700, color: '#000',
                        }}>✓ Selected</div>
                      )}
                      <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{info.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{info.name}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: info.color, marginBottom: 4 }}>{info.price}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{info.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Token pack selector (only if custom) */}
            {planType === 'custom' && (
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Choose Credit Pack
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {TOKEN_PACKS.map(pk => (
                    <div
                      key={pk.credits}
                      onClick={() => setTokenPack(pk)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 16px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                        border: `1px solid ${tokenPack.credits === pk.credits ? 'rgba(245,201,106,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        background: tokenPack.credits === pk.credits ? 'rgba(245,201,106,0.07)' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1rem' }}>💎</span>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{pk.label}</div>
                          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                            ~{Math.round(pk.credits / 5)} video analyses
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#F5C96A' }}>{pk.display}</div>
                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>${pk.usd}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enterprise: redirect to contact */}
            {planType === 'Enterprise' ? (
              <button
                onClick={() => window.open('mailto:support@clipinsight.ai?subject=Enterprise Plan Inquiry', '_blank')}
                style={{
                  padding: '14px', borderRadius: 12, width: '100%',
                  background: 'linear-gradient(135deg, #57D98D, #3DD9FF)',
                  border: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 8px 28px rgba(87,217,141,0.3)',
                }}
              >
                📧 Contact Sales for Enterprise Pricing
              </button>
            ) : (
              <button
                onClick={() => setStep('pay')}
                style={{
                  padding: '14px', borderRadius: 12, width: '100%',
                  background: `linear-gradient(135deg, ${planType === 'custom' ? '#F5C96A' : '#7C5CFC'}, ${planType === 'custom' ? '#FF9F7A' : '#3DD9FF'})`,
                  border: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 8px 28px ${planType === 'custom' ? 'rgba(245,201,106,0.3)' : 'rgba(124,92,252,0.35)'}`,
                }}
              >
                Continue to Payment — {planInfo.price}
              </button>
            )}

            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', margin: 0 }}>
              🔒 Secured checkout · Cancel anytime
            </p>
          </div>
        )}

        {/* ── STEP 2: Payment Method ── */}
        {step === 'pay' && (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Summary bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 12,
              background: `${planInfo.color}0F`,
              border: `1px solid ${planInfo.color}25`,
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>You're paying for</div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{planInfo.name} <span style={{ color: planInfo.color }}>— {planInfo.credits.toLocaleString()} credits</span></div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: planInfo.color }}>{planInfo.price}</div>
            </div>

            {/* Features list */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>What you get</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(planType === 'custom'
                  ? [`${planInfo.credits} video analyses`, 'Full AI reports', 'Hook score & transcripts', 'No subscription — use anytime']
                  : (PLANS[planType as 'Pro'] || PLANS.Pro).features
                ).map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ color: planInfo.color }}>✓</span> {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Payment method selection */}
            <div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Choose Payment Method
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { id: 'upi',      icon: '📱', label: 'UPI / QR Code',   sublabel: 'GPay, PhonePe, Paytm, BHIM' },
                  { id: 'razorpay', icon: '💳', label: 'Razorpay',        sublabel: 'Cards, Net Banking, EMI, UPI' },
                  { id: 'paypal',   icon: '🔵', label: 'PayPal',          sublabel: 'International cards & PayPal balance' },
                ] as const).map(m => (
                  <div
                    key={m.id}
                    className="pay-method"
                    onClick={() => setMethod(m.id)}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'center', padding: '13px 16px',
                      borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s',
                      border: `1px solid ${method === m.id ? 'rgba(124,92,252,0.5)' : 'rgba(255,255,255,0.07)'}`,
                      background: method === m.id ? 'rgba(124,92,252,0.08)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ width: 36, textAlign: 'center', fontSize: '1.3rem' }}>{m.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{m.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{m.sublabel}</div>
                    </div>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${method === m.id ? '#7C5CFC' : 'rgba(255,255,255,0.2)'}`,
                      background: method === m.id ? '#7C5CFC' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {method === m.id && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* UPI specific: QR + ref input */}
            {method === 'upi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '20px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                    Scan QR or pay to UPI ID
                  </div>
                  <div style={{
                    width: 140, height: 140, margin: '0 auto 12px',
                    background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${planInfo.color}50`,
                  }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=upi://pay?pa=${UPI_ID}&pn=ClipInsight AI&am=${planInfo.inr}&cu=INR`}
                      alt="UPI QR Code" width={130} height={130}
                      style={{ borderRadius: 8 }}
                    />
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: planInfo.color, marginBottom: 4 }}>{UPI_ID}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                    Amount: <strong style={{ color: '#F5C96A' }}>{planInfo.price}</strong>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>
                    Enter UPI Transaction ID after payment
                  </label>
                  <input
                    placeholder="e.g. 4152xxxxxxxxxxxx"
                    value={upiRef} onChange={e => setUpiRef(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: '0.88rem',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,92,252,0.25)',
                      color: '#F8FAFC', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}

            {/* PayPal container */}
            {method === 'paypal' && step === 'pay' && (
              <div id="paypal-button-container" style={{ minHeight: 50 }} />
            )}

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                color: '#f87171', fontSize: '0.8rem',
              }}>⚠ {error}</div>
            )}

            {/* Back + Pay buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setStep('select'); setError(''); }}
                style={{
                  padding: '13px 18px', borderRadius: 12, flexShrink: 0,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', cursor: 'pointer',
                }}
              >← Back</button>
              <button
                onClick={() => {
                  setError('');
                  if (method === 'upi')      handleUPIConfirm();
                  if (method === 'razorpay') handleRazorpay();
                  if (method === 'paypal')   handlePayPal();
                }}
                disabled={loading}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  background: loading ? 'rgba(124,92,252,0.35)' : `linear-gradient(135deg, ${planInfo.color}, #3DD9FF)`,
                  border: 'none', color: '#fff', fontSize: '0.92rem', fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : `0 8px 28px ${planInfo.color}40`,
                  transition: 'all 0.2s',
                }}
              >
                {loading ? '⏳ Processing...'
                  : method === 'upi' ? `✓ Confirm UPI — ${planInfo.price}`
                  : method === 'razorpay' ? `💳 Pay with Razorpay — ${planInfo.price}`
                  : `🔵 Pay with PayPal — ${planInfo.priceUS}`}
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', margin: 0 }}>
              🔒 Secured by Razorpay / PayPal · Cancel anytime
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
