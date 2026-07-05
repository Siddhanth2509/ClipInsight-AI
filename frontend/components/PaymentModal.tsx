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
    features: ['Unlimited analyses', 'URL + file upload', 'Full PDF reports', 'Priority processing', 'API access (1000 req/mo)', 'Email support'],
    color:   '#7C5CFC',
  },
  Enterprise: {
    name:    'Enterprise',
    price:   'Custom',
    priceUS: 'Custom',
    usd:     0,
    inr:     0,
    credits: 99999,
    features: ['Unlimited everything', 'Dedicated infrastructure', 'Custom integrations', 'SLA guarantee', 'Dedicated support'],
    color:   '#57D98D',
  },
};

const UPI_ID = 'clipinsight@paytm'; // Replace with real UPI ID

export default function PaymentModal({ isOpen, onClose, plan = 'Pro', onSuccess }: PaymentModalProps) {
  const [method,    setMethod]    = useState<'upi' | 'razorpay' | 'paypal'>('upi');
  const [upiRef,    setUpiRef]    = useState('');
  const [step,      setStep]      = useState<'select' | 'pay' | 'done'>('select');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const planInfo = PLANS[plan];

  if (!isOpen) return null;

  const handleUPIConfirm = () => {
    if (!upiRef.trim()) { setError('Please enter your UPI transaction ID'); return; }
    setLoading(true);
    // In production: send upiRef to backend for verification
    setTimeout(() => {
      const u = getCurrentUser();
      if (u) updateCurrentUser({ plan, credits: (u.credits || 0) + planInfo.credits });
      setLoading(false);
      setStep('done');
    }, 1500);
  };

  const handleRazorpay = () => {
    setLoading(true);
    // Load Razorpay SDK
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY || 'rzp_test_placeholder',
        amount: planInfo.inr * 100,
        currency: 'INR',
        name: 'ClipInsight AI',
        description: `${plan} Plan Subscription`,
        image: '',
        handler: (response: any) => {
          // Verify on backend in production
          const u = getCurrentUser();
          if (u) updateCurrentUser({ plan, credits: (u.credits || 0) + planInfo.credits });
          setLoading(false);
          setStep('done');
        },
        prefill: { name: getCurrentUser()?.name, email: getCurrentUser()?.email },
        theme: { color: '#7C5CFC' },
        modal: { ondismiss: () => setLoading(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    };
    script.onerror = () => {
      setLoading(false);
      setError('Razorpay SDK failed to load. Please try UPI or PayPal.');
    };
    document.body.appendChild(script);
  };

  const handlePayPal = () => {
    setLoading(true);
    // Load PayPal SDK
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
            if (u) updateCurrentUser({ plan, credits: (u.credits || 0) + planInfo.credits });
            setStep('done');
          }),
          onError: () => setError('PayPal payment failed. Please try again.'),
        }).render('#paypal-button-container');
      }, 200);
    };
    script.onerror = () => { setLoading(false); setError('PayPal SDK failed to load.'); };
    document.body.appendChild(script);
  };

  if (step === 'done') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2500,
        background: 'rgba(2,11,24,0.9)', backdropFilter: 'blur(24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{
          textAlign: 'center', padding: 48,
          background: 'rgba(12,20,38,0.98)', borderRadius: 24,
          border: '1px solid rgba(87,217,141,0.3)',
          boxShadow: '0 0 60px rgba(87,217,141,0.15)',
          maxWidth: 380,
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800, color: '#57D98D' }}>
            Payment Successful!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', margin: '0 0 24px' }}>
            You're now on the <strong style={{ color: planInfo.color }}>{plan}</strong> plan.<br/>
            {planInfo.credits.toLocaleString()} credits added to your account.
          </p>
          <button
            onClick={() => { onSuccess?.(); onClose(); setStep('select'); }}
            style={{
              padding: '12px 32px', borderRadius: 12,
              background: 'linear-gradient(135deg, #57D98D, #3DD9FF)',
              border: 'none', color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✓ Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2500,
        background: 'rgba(2,11,24,0.9)', backdropFilter: 'blur(24px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'rgba(10,18,36,0.99)',
        border: '1px solid rgba(124,92,252,0.2)',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
        animation: 'payFadeIn 0.3s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{`
          @keyframes payFadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          .pay-method:hover { border-color: rgba(124,92,252,0.5) !important; background: rgba(124,92,252,0.07) !important; }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '24px 28px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: `linear-gradient(135deg, ${planInfo.color}10, rgba(61,217,255,0.04))`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: planInfo.color, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              Upgrade Plan
            </div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
              {plan} <span style={{ color: planInfo.color }}>— {planInfo.price}</span>
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 10, padding: '7px 12px', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: '0.8rem',
          }}>✕</button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Features */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: '16px',
          }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              What you get
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {planInfo.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
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
                {/* QR placeholder — in production use a real QR library */}
                <div style={{
                  width: 140, height: 140, margin: '0 auto 12px',
                  background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', color: '#333', fontFamily: 'monospace',
                  border: '2px solid rgba(124,92,252,0.3)',
                }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=upi://pay?pa=${UPI_ID}&pn=ClipInsight AI&am=${planInfo.inr}&cu=INR`}
                    alt="UPI QR Code" width={130} height={130}
                    style={{ borderRadius: 8 }}
                  />
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#7C5CFC', marginBottom: 4 }}>
                  {UPI_ID}
                </div>
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

          {/* CTA */}
          <button
            onClick={() => {
              setError('');
              if (method === 'upi')      handleUPIConfirm();
              if (method === 'razorpay') handleRazorpay();
              if (method === 'paypal')   handlePayPal();
            }}
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: loading ? 'rgba(124,92,252,0.4)' : `linear-gradient(135deg, ${planInfo.color}, #3DD9FF)`,
              border: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : `0 8px 28px ${planInfo.color}40`,
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Processing...'
              : method === 'upi' ? `✓ Confirm UPI Payment — ${planInfo.price}`
              : method === 'razorpay' ? `💳 Pay with Razorpay — ${planInfo.price}`
              : `🔵 Pay with PayPal — ${planInfo.priceUS}`}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', margin: 0 }}>
            🔒 Secured by Razorpay / PayPal · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
