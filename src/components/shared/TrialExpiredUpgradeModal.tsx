'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';
import {
  Monitor, Plus, Minus, X, Check, ShieldCheck, ArrowRight, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import { cmsApiV2 } from '@/lib/api';

export interface TrialScreenSummary {
  screenId: number;
  screenName: string;
  pairCode: string;
}

interface Props {
  trialScreens: TrialScreenSummary[];
  onClose: (result?: { success: boolean }) => void;
}

const FALLBACK_PRICING = { monthly: { perScreen: 5 }, yearly: { perScreen: 4.58 } };
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

export default function TrialExpiredUpgradeModal({ trialScreens, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set(trialScreens.map(s => s.screenId)));
  const [extraQty, setExtraQty] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [PRICING, setPRICING] = useState(FALLBACK_PRICING);
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const cardMountedRef = useRef(false);

  const totalQuantity = selected.size + extraQty;
  const pricePerScreen = billingCycle === 'monthly' ? PRICING.monthly.perScreen : PRICING.yearly.perScreen;
  const totalPrice = totalQuantity * pricePerScreen;
  const unselectedCount = trialScreens.length - selected.size;

  useEffect(() => {
    cmsApiV2.get('/sac/plan-config/pricing').then(({ data }: any) => {
      if (data?.screen) {
        setPRICING({
          monthly: { perScreen: (data.screen.monthly || 500) / 100 },
          yearly:  { perScreen: (data.screen.yearly  || 5500) / 100 / 12 },
        });
      }
    }).catch(() => {});
  }, []);

  function toggleScreen(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const mountCard = useCallback(async () => {
    if (cardMountedRef.current) return;
    const stripe = await stripePromise;
    if (!stripe) {
      setPaymentError('Payment is not configured. Please contact support.');
      return;
    }
    stripeRef.current = stripe;
    const card = stripe.elements().create('card', {
      style: {
        base: { color: '#111827', fontFamily: 'Inter, sans-serif', fontSize: '15px', '::placeholder': { color: '#9ca3af' } },
        invalid: { color: '#ef4444' },
      },
    });
    cardRef.current = card;
    const el = document.getElementById('teu-card-element');
    if (el) { card.mount(el); cardMountedRef.current = true; }
  }, []);

  useEffect(() => {
    if (step === 2) { const t = setTimeout(mountCard, 120); return () => clearTimeout(t); }
  }, [step, mountCard]);

  useEffect(() => () => {
    if (cardRef.current && cardMountedRef.current) { cardRef.current.unmount(); cardMountedRef.current = false; }
  }, []);

  async function goToPayment() {
    setStep(2);
    setPaymentError('');
    try {
      const { data } = await cmsApiV2.post('/spgc/create-intent', {
        stripPurposeType: 'SCREEN',
        currencyCode: 'CAD',
        billingCycle,
        quantity: totalQuantity,
        totalPrice,
        selectedTrialScreenIds: Array.from(selected),
      });
      setClientSecret(data.clientSecret || '');
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || err?.message || 'Failed to initialize payment');
    }
  }

  function goBack() {
    setStep(1);
    setPaymentError('');
    if (cardRef.current && cardMountedRef.current) { cardRef.current.unmount(); cardMountedRef.current = false; }
  }

  async function confirmPayment() {
    if (!stripeRef.current || !cardRef.current) { setPaymentError('Payment system still initializing. Please wait.'); return; }
    if (!clientSecret) { setPaymentError('No payment secret. Please try again.'); return; }
    if (!cardholderName.trim()) { setPaymentError('Please enter cardholder name.'); return; }
    setIsProcessing(true);
    setPaymentError('');
    try {
      const result: any = await stripeRef.current.confirmCardSetup(clientSecret, {
        payment_method: { card: cardRef.current, billing_details: { name: cardholderName } },
      });
      if (result.error) {
        setPaymentError(result.error.message || 'Payment failed');
      } else if (result.setupIntent?.status === 'succeeded') {
        setPaymentSuccess(true);
        // Poll until webhook delivers and canCreateScreen flips true
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const { data } = await cmsApiV2.get('/sac/my/plan');
            if (data?.canCreateScreen || attempts >= 10) {
              clearInterval(poll);
              setTimeout(() => onClose({ success: true }), 1500);
            }
          } catch {
            if (attempts >= 10) { clearInterval(poll); onClose({ success: true }); }
          }
        }, 1500);
      } else {
        setPaymentError('Payment is being processed. Please check back shortly.');
      }
    } catch (e: any) {
      setPaymentError(e?.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="teu-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`teu-dialog${step === 2 ? ' teu-wide' : ''}`}>

        {/* ── Step 1: Screen selection ─────────────────────────────── */}
        {step === 1 && (
          <div className="teu-body">
            <button className="teu-x" onClick={() => onClose()}><X size={17} /></button>

            <div className="teu-alert"><AlertTriangle size={15} /> Your free trial has ended</div>
            <h2 className="teu-title">Keep your screens active</h2>
            <p className="teu-sub">
              Select the screens you want to keep. Unselected screens will be paused and can be
              reactivated later by purchasing more slots.
            </p>

            <div className="teu-screens">
              {trialScreens.map(s => (
                <div
                  key={s.screenId}
                  className={`teu-screen-row${selected.has(s.screenId) ? ' teu-sel' : ''}`}
                  onClick={() => toggleScreen(s.screenId)}
                >
                  <div className={`teu-cb${selected.has(s.screenId) ? ' teu-cb-on' : ''}`}>
                    {selected.has(s.screenId) && <Check size={10} />}
                  </div>
                  <Monitor size={14} className="teu-screen-ic" />
                  <div className="teu-screen-info">
                    <span className="teu-screen-name">{s.screenName || 'Unnamed Screen'}</span>
                    <span className="teu-screen-code">{s.pairCode}</span>
                  </div>
                </div>
              ))}
            </div>

            {unselectedCount > 0 && (
              <p className="teu-warn">
                {unselectedCount} screen{unselectedCount > 1 ? 's' : ''} will be paused.
                You can reactivate them later by purchasing additional slots.
              </p>
            )}

            <div className="teu-extra-row">
              <span className="teu-extra-label">Add extra screen slots:</span>
              <div className="teu-qrow">
                <button className="teu-qbtn" onClick={() => setExtraQty(q => Math.max(0, q - 1))} disabled={extraQty <= 0}><Minus size={12} /></button>
                <span className="teu-qnum">{extraQty}</span>
                <button className="teu-qbtn" onClick={() => setExtraQty(q => q + 1)}><Plus size={12} /></button>
              </div>
            </div>

            <div className="teu-cycle">
              <button className={billingCycle === 'monthly' ? 'active' : ''} onClick={() => setBillingCycle('monthly')}>Monthly</button>
              <button className={billingCycle === 'yearly'  ? 'active' : ''} onClick={() => setBillingCycle('yearly')}>Yearly (Save 15%)</button>
            </div>

            <div className="teu-summary">
              <div className="teu-srow">
                <span>{totalQuantity} screen slot{totalQuantity !== 1 ? 's' : ''}</span>
                <span>${totalPrice.toFixed(2)}{billingCycle === 'monthly' ? '/mo' : '/mo avg'}</span>
              </div>
              {selected.size > 0 && (
                <div className="teu-srow teu-srow-sub">
                  <span>{selected.size} kept from trial{extraQty > 0 ? `, ${extraQty} extra` : ''}</span>
                  <span>{unselectedCount > 0 ? `${unselectedCount} will be paused` : 'all kept'}</span>
                </div>
              )}
            </div>

            <div className="teu-footer">
              <button className="teu-btn-later" onClick={() => onClose()}>Later</button>
              <button className="teu-btn-cta" onClick={goToPayment} disabled={totalQuantity < 1}>
                Continue to Payment <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Payment ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="teu-s2" style={{ position: 'relative' }}>
            <div className="teu-s2-hdr">
              <button className="teu-back" onClick={goBack}><ArrowLeft size={15} /></button>
              <h2>Pay per Screen</h2>
              <button className="teu-x teu-x-inline" onClick={() => onClose()}><X size={15} /></button>
            </div>
            <div className="teu-grid">
              <div className="teu-left">
                <h3>Order Summary</h3>
                <div className="teu-orow">
                  <Monitor size={15} />
                  <div>
                    <div className="teu-oname">{totalQuantity} Screen Slot{totalQuantity !== 1 ? 's' : ''}</div>
                    <div className="teu-osub">
                      {billingCycle} · {selected.size} from trial{extraQty > 0 ? ` + ${extraQty} extra` : ''}
                    </div>
                  </div>
                </div>
                <div className="teu-price">
                  ${totalPrice.toFixed(2)}
                  <span className="teu-per"> / {billingCycle === 'monthly' ? 'mo' : 'yr'} CAD</span>
                </div>
                {unselectedCount > 0 && (
                  <p className="teu-warn" style={{ marginTop: '1.5rem' }}>
                    {unselectedCount} screen{unselectedCount > 1 ? 's' : ''} will be paused after payment.
                  </p>
                )}
              </div>
              <div className="teu-right">
                <h3>Pay with Card</h3>
                <input
                  type="text"
                  placeholder="Name on card"
                  value={cardholderName}
                  onChange={e => setCardholderName(e.target.value)}
                  className="teu-namein"
                  disabled={isProcessing}
                />
                <div id="teu-card-element" className="teu-cardel" />
                {paymentError && (
                  <div className="teu-perr"><ShieldCheck size={12} />{paymentError}</div>
                )}
                <div className="teu-actns">
                  <button className="teu-paybtn" onClick={confirmPayment} disabled={isProcessing || !clientSecret}>
                    {isProcessing ? 'Processing…' : `Pay $${totalPrice.toFixed(2)}`}
                  </button>
                  <button className="teu-canbtn" onClick={() => onClose()} disabled={isProcessing}>Cancel</button>
                </div>
                <p className="teu-sfooter">
                  By confirming, you allow DigitalSignage to charge your card per their terms.{' '}
                  Powered by <strong style={{ color: '#635bff' }}>stripe</strong>
                </p>
              </div>
            </div>

            {paymentSuccess && (
              <div className="teu-succ">
                <div className="teu-succ-ic"><Check size={30} /></div>
                <h3>Payment Successful!</h3>
                <p>Activating your screens…</p>
              </div>
            )}
          </div>
        )}

        <style>{`
          .teu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);animation:teufade .15s ease}
          @keyframes teufade{from{opacity:0}}
          .teu-dialog{background:#fff;color:#111;border-radius:20px;width:480px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 28px 80px rgba(0,0,0,.3);animation:teuin .2s ease;position:relative}
          .teu-dialog.teu-wide{width:740px}
          @keyframes teuin{from{opacity:0;transform:scale(.95) translateY(12px)}}
          .teu-body{padding:1.75rem;position:relative}
          .teu-x{position:absolute;top:.9rem;right:.9rem;background:none;border:1px solid #e5e7eb;border-radius:8px;padding:.28rem;cursor:pointer;color:#6b7280;display:flex;align-items:center;transition:background .15s}
          .teu-x:hover{background:#f3f4f6}
          .teu-x-inline{position:static}
          .teu-alert{display:inline-flex;align-items:center;gap:.4rem;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:8px;padding:.3rem .7rem;font-size:.78rem;font-weight:700;margin-bottom:.9rem}
          .teu-title{font-size:1.2rem;font-weight:800;margin:0 0 .3rem}
          .teu-sub{font-size:.85rem;color:#6b7280;margin:0 0 1rem;line-height:1.5}
          .teu-screens{display:flex;flex-direction:column;gap:.4rem;margin-bottom:.85rem;max-height:210px;overflow-y:auto}
          .teu-screen-row{display:flex;align-items:center;gap:.6rem;padding:.55rem .7rem;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .15s;user-select:none}
          .teu-screen-row:hover{border-color:#6366f1}
          .teu-sel{border-color:#111;background:#f9fafb}
          .teu-cb{width:17px;height:17px;border-radius:4px;border:2px solid #d1d5db;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s}
          .teu-cb-on{background:#111;border-color:#111;color:#fff}
          .teu-screen-ic{color:#6366f1;flex-shrink:0}
          .teu-screen-info{display:flex;flex-direction:column;min-width:0}
          .teu-screen-name{font-size:.875rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .teu-screen-code{font-size:.7rem;color:#9ca3af}
          .teu-warn{font-size:.78rem;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:.4rem .7rem;margin-bottom:.75rem;line-height:1.4}
          .teu-extra-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
          .teu-extra-label{font-size:.85rem;color:#374151;font-weight:500}
          .teu-qrow{display:flex;align-items:center;gap:.45rem}
          .teu-qbtn{width:27px;height:27px;border:1px solid #e5e7eb;border-radius:7px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
          .teu-qbtn:hover:not(:disabled){background:#f3f4f6}
          .teu-qbtn:disabled{opacity:.4;cursor:not-allowed}
          .teu-qnum{font-size:.95rem;font-weight:700;min-width:1.5rem;text-align:center}
          .teu-cycle{display:flex;background:#f3f4f6;border-radius:10px;padding:.18rem;margin-bottom:.85rem}
          .teu-cycle button{flex:1;padding:.38rem .5rem;border:none;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;background:none;color:#6b7280;transition:all .15s}
          .teu-cycle button.active{background:#fff;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.12)}
          .teu-summary{background:#f9fafb;border-radius:10px;padding:.6rem .85rem;margin-bottom:.85rem}
          .teu-srow{display:flex;justify-content:space-between;font-size:.875rem;font-weight:600;padding:.15rem 0}
          .teu-srow-sub{color:#6b7280;font-weight:400;font-size:.78rem}
          .teu-footer{display:flex;gap:.6rem}
          .teu-btn-later{flex:1;padding:.66rem;border:1px solid #e5e7eb;border-radius:11px;background:#fff;font-weight:600;cursor:pointer;font-size:.875rem;color:#374151;transition:background .15s}
          .teu-btn-later:hover{background:#f9fafb}
          .teu-btn-cta{flex:1.6;padding:.66rem 1rem;background:#111;color:#fff;border:none;border-radius:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:.875rem;transition:background .15s}
          .teu-btn-cta:hover:not(:disabled){background:#333}
          .teu-btn-cta:disabled{opacity:.45;cursor:not-allowed}
          /* step 2 */
          .teu-s2-hdr{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1.25rem;border-bottom:1px solid #f3f4f6}
          .teu-s2-hdr h2{font-size:.95rem;font-weight:700;margin:0}
          .teu-back{background:none;border:1px solid #e5e7eb;border-radius:7px;padding:.28rem;cursor:pointer;color:#6b7280;display:flex;align-items:center;transition:background .15s}
          .teu-back:hover{background:#f3f4f6}
          .teu-grid{display:grid;grid-template-columns:280px 1fr}
          .teu-left{padding:1.4rem 1.5rem;border-right:1px solid #f3f4f6;display:flex;flex-direction:column;gap:.75rem}
          .teu-left h3{font-size:.88rem;font-weight:700;margin:0}
          .teu-right{padding:1.4rem 1.5rem;display:flex;flex-direction:column;gap:.65rem}
          .teu-right h3{font-size:.88rem;font-weight:700;margin:0}
          .teu-orow{display:flex;align-items:center;gap:.6rem}
          .teu-oname{font-weight:700;font-size:.85rem}
          .teu-osub{font-size:.73rem;color:#6b7280}
          .teu-price{font-size:1.8rem;font-weight:800}
          .teu-per{font-size:.8rem;color:#6b7280;font-weight:400}
          .teu-namein{border:1px solid #e5e7eb;border-radius:9px;padding:.65rem .8rem;font-size:.9rem;color:#111;outline:none;background:#fff;width:100%;box-sizing:border-box}
          .teu-namein:focus{border-color:#374151}
          .teu-cardel{border:1px solid #e5e7eb;border-radius:9px;padding:.7rem .8rem;background:#fff;min-height:42px}
          .teu-perr{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:.78rem;padding:.5rem .7rem;border-radius:7px;display:flex;align-items:center;gap:.35rem}
          .teu-actns{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
          .teu-paybtn{padding:.66rem;background:#111;color:#fff;border:none;border-radius:11px;font-weight:700;cursor:pointer;font-size:.85rem;transition:background .15s}
          .teu-paybtn:hover:not(:disabled){background:#333}
          .teu-paybtn:disabled{opacity:.5;cursor:not-allowed}
          .teu-canbtn{padding:.66rem;background:#fff;color:#374151;border:1px solid #e5e7eb;border-radius:11px;font-weight:600;cursor:pointer;font-size:.85rem;transition:background .15s}
          .teu-canbtn:hover:not(:disabled){background:#f9fafb}
          .teu-sfooter{font-size:.68rem;color:#9ca3af;margin:0;line-height:1.5;margin-top:1.5rem}
          .teu-succ{position:absolute;inset:0;background:rgba(255,255,255,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:20px;z-index:10;animation:teufade .2s ease;gap:.25rem}
          .teu-succ-ic{width:58px;height:58px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#16a34a;margin-bottom:.5rem}
          .teu-succ h3{font-size:1.1rem;font-weight:800;margin:0}
          .teu-succ p{font-size:.85rem;color:#6b7280;margin:0}
          @media(max-width:700px){.teu-dialog.teu-wide{width:96vw}.teu-grid{grid-template-columns:1fr}.teu-left{border-right:none;border-bottom:1px solid #f3f4f6}}
        `}</style>
      </div>
    </div>
  );
}
