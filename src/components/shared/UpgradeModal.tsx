'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';
import { Monitor, Plus, Minus, X, ArrowLeft, ArrowRight, ShieldCheck, Check, Zap, MapPin } from 'lucide-react';
import { cmsApiV2 } from '@/lib/api';

export type UpgradeMode = 'screen' | 'credit' | 'location';

interface UpgradeModalProps {
  mode: UpgradeMode;
  onClose: (result?: { success: boolean }) => void;
  initialScreens?: number;
}

const FALLBACK_PRICING = {
  monthly:  { perScreen: 5   },
  yearly:   { perScreen: 55  },
  lifetime: { perScreen: 199 },
  location: { monthly: 10, yearly: 110 },
  credit: [
    { id: 'starter', name: 'Starter Pack', credits: 10,  price: 9.99, save: '' },
    { id: 'value',   name: 'Value Pack',   credits: 50,  price: 39.99, save: 'Popular' },
    { id: 'pro',     name: 'Pro Pack',     credits: 150, price: 99.99, save: 'Best Value' },
  ],
};

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

export default function UpgradeModal({ mode, onClose, initialScreens = 1 }: UpgradeModalProps) {
  const [step, setStep] = useState(1);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');
  const [screenQuantity, setScreenQuantity] = useState(Math.max(1, initialScreens));
  const [usedScreens, setUsedScreens] = useState(initialScreens);
  const [PRICING, setPRICING] = useState(FALLBACK_PRICING);
  const [selectedPack, setSelectedPack] = useState(FALLBACK_PRICING.credit[1]);
  const [ltdVisible, setLtdVisible] = useState(true);
  const [cardholderName, setCardholderName] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const cardMountedRef = useRef(false);

  // Fetch dynamic pricing from backend
  useEffect(() => {
    cmsApiV2.get('/sac/plan-config/pricing').then(({ data }: any) => {
      if (data) {
        let parsedPacks = [];
        if (data.creditPacks) {
          try {
            parsedPacks = typeof data.creditPacks === 'string' ? JSON.parse(data.creditPacks) : data.creditPacks;
          } catch (e) {
            console.error('Failed to parse credit packs', e);
          }
        }
        
        if (data.ltdPlanVisible === false || data.ltdPlanVisible === 'false') {
          setLtdVisible(false);
        }
        const dynamicPricing = {
          monthly:  { perScreen: (data.screen?.monthly || 500) / 100 },
          yearly:   { perScreen: (data.screen?.yearly || 5500) / 100 },
          lifetime: { perScreen: (data.screen?.lifetime || 19900) / 100 },
          location: {
            monthly: (data.location?.monthly || 1000) / 100,
            yearly:  (data.location?.yearly || 11000) / 100,
          },
          credit: (Array.isArray(parsedPacks) ? parsedPacks : []).map((p: any) => ({
            id: p.id,
            name: p.name,
            credits: p.credits,
            price: (p.priceInCents || 0) / 100,
            save: p.badge || '',
          })),
        };
        setPRICING(dynamicPricing);
        if (dynamicPricing.credit.length > 1) {
          setSelectedPack(dynamicPricing.credit[1]);
        } else if (dynamicPricing.credit.length > 0) {
          setSelectedPack(dynamicPricing.credit[0]);
        }
      }
    }).catch(() => { /* use fallback */ });
  }, []);

  // Fetch real plan status on open (screen mode) to get accurate usedScreens
  useEffect(() => {
    if (mode === 'screen') {
      cmsApiV2.get('/sac/my/plan').then(({ data }: any) => {
        const subscription = data?.subscription;
        let used = 1;
        if (subscription?.subscriptionType === 'TRIAL_PLAN') {
          used = data.totalScreens || 1;
          setScreenQuantity(Math.max(1, used - (data.totalEntitlementScreens || 0)));
        }
        setUsedScreens(used);
      }).catch(() => {});
    }
  }, [mode]);

  const totalPrice = (() => {
    if (mode === 'location') return billingCycle === 'monthly' ? PRICING.location.monthly : PRICING.location.yearly;
    if (mode === 'credit')   return selectedPack.price;
    if (billingCycle === 'lifetime') return screenQuantity * PRICING.lifetime.perScreen;
    return screenQuantity * (billingCycle === 'monthly' ? PRICING.monthly.perScreen : PRICING.yearly.perScreen);
  })();

  const savingsText = mode === 'screen' && billingCycle === 'yearly'
    ? `Save $${(screenQuantity * (PRICING.monthly.perScreen * 12 - PRICING.yearly.perScreen)).toFixed(0)}/year with ${screenQuantity} screen${screenQuantity > 1 ? 's' : ''}`
    : mode === 'screen' && billingCycle === 'lifetime'
    ? `💎 Best Value: Buy once, use forever!`
    : mode === 'location' && billingCycle === 'yearly' ? `Save $${(PRICING.location.monthly * 12 - PRICING.location.yearly).toFixed(0)}/year` : '';

  const step2Title = mode === 'credit' ? 'Pay for Credits' : mode === 'location' ? 'Pay for Locations' : 'Pay per Screen';

  const mountCard = useCallback(async () => {
    if (cardMountedRef.current) return;
    const stripe = await stripePromise;
    if (!stripe) {
      setPaymentError('Payment is not configured. Please contact support.');
      return;
    }
    stripeRef.current = stripe;
    const elements = stripe.elements();
    const card = elements.create('card', {
      style: {
        base: { color: '#111827', fontFamily: 'Inter, sans-serif', fontSize: '15px', '::placeholder': { color: '#9ca3af' } },
        invalid: { color: '#ef4444' },
      },
    });
    cardRef.current = card;
    const el = document.getElementById('ud-card-element');
    if (el) { card.mount(el); cardMountedRef.current = true; }
  }, []);

  useEffect(() => {
    if (step === 2) { const t = setTimeout(mountCard, 120); return () => clearTimeout(t); }
  }, [step, mountCard]);

  useEffect(() => () => {
    if (cardRef.current && cardMountedRef.current) { cardRef.current.unmount(); cardMountedRef.current = false; }
  }, []);

  async function goToPayment() {
    setStep(2); setPaymentError('');
    const payload: any = mode === 'location'
      ? { stripPurposeType: 'LOCATION',        currencyCode: 'CAD', billingCycle, quantity: 3, totalPrice }
      : mode === 'credit'
      ? { stripPurposeType: 'TEMPLATE_CREDIT', currencyCode: 'CAD', billingCycle: 'oneTime', quantity: selectedPack.credits, totalPrice: selectedPack.price }
      : { stripPurposeType: 'SCREEN',          currencyCode: 'CAD', billingCycle, quantity: screenQuantity, totalPrice };
    try {
      const { data } = await cmsApiV2.post('/spgc/create-intent', payload);
      setClientSecret(data.clientSecret || '');
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || err?.message || 'Failed to initialize payment');
    }
  }

  function goBack() {
    setStep(1); setPaymentError('');
    if (cardRef.current && cardMountedRef.current) { cardRef.current.unmount(); cardMountedRef.current = false; }
  }

  async function confirmPayment() {
    if (!stripeRef.current || !cardRef.current) { setPaymentError('Payment system still initializing. Please wait.'); return; }
    if (!clientSecret) { setPaymentError('No payment secret. Please try again.'); return; }
    if (!cardholderName.trim()) { setPaymentError('Please enter cardholder name.'); return; }
    setIsProcessing(true); setPaymentError('');
    try {
      const pm = { card: cardRef.current, billing_details: { name: cardholderName } };
      // pi_ = PaymentIntent (one-time: credits, lifetime screens)
      // seti_ = SetupIntent (subscription: monthly/yearly screens & locations)
      const isOneTime = clientSecret.startsWith('pi_');
      const result: any = isOneTime
        ? await stripeRef.current.confirmCardPayment(clientSecret, { payment_method: pm })
        : await stripeRef.current.confirmCardSetup(clientSecret, { payment_method: pm });
      const { error, paymentIntent, setupIntent } = result;
      if (error) { setPaymentError(error.message || 'Payment failed'); }
      else if (paymentIntent?.status === 'succeeded' || setupIntent?.status === 'succeeded') {
        setPaymentSuccess(true);
        setTimeout(() => onClose({ success: true }), 2000);
      } else { setPaymentError('Payment is being processed. Please check back shortly.'); }
    } catch (e: any) { setPaymentError(e?.message || 'An unexpected error occurred.'); }
    finally { setIsProcessing(false); }
  }

  return (
    <div className="ud-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ud-dialog${step === 2 ? ' ud-step2' : ''}${mode === 'credit' && step === 1 ? ' ud-credit' : ''}`}>

        {step === 1 && mode === 'screen' && (
          <div className="ud-body">
            <button className="ud-x" onClick={() => onClose()}><X size={18}/></button>
            <div className="ud-hero">
              <div className="ud-icon-stack">
                <Monitor size={38} strokeWidth={1.5}/>
                <div className="ud-plus-badge"><Plus size={11}/></div>
              </div>
              <h2 className="ud-title">Expand your Screens</h2>
              <p className="ud-sub">Select how many additional screens you&apos;d like to manage.</p>
            </div>
            <div className="ud-impact"><div className="ud-stat-card"><span className="ud-slbl">SCREEN</span><span className="ud-sval">{screenQuantity}</span></div></div>
            <div className="ud-selector-row">
              <div className="ud-qrow">
                <button className="ud-qbtn" onClick={() => setScreenQuantity(q => Math.max(Math.max(1, usedScreens), q-1))} disabled={screenQuantity <= Math.max(1, usedScreens)}><Minus size={15}/></button>
                <div className="ud-qdisp"><span className="ud-qnum">{screenQuantity}</span><span className="ud-qlbl">SCREENS</span></div>
                <button className="ud-qbtn" onClick={() => setScreenQuantity(q => q+1)}><Plus size={15}/></button>
              </div>
              <div className="ud-cycle">
                <button className={billingCycle==='monthly'?'active':''} onClick={()=>setBillingCycle('monthly')}>Monthly</button>
                <button className={billingCycle==='yearly'?'active':''} onClick={()=>setBillingCycle('yearly')}>Yearly (Save 15%)</button>
                {ltdVisible && <button className={billingCycle==='lifetime'?'active':''} onClick={()=>setBillingCycle('lifetime')}>Lifetime 💎</button>}
              </div>
            </div>
            <div className="ud-psummary">
              <div className="ud-prow"><span>{screenQuantity} Screen Slot{screenQuantity > 1 ? 's' : ''}</span><span>${totalPrice.toFixed(2)}</span></div>
              {billingCycle==='yearly'&&<div className="ud-prow ud-prow--disc"><span>Annual Discount</span><span>-15%</span></div>}
              {billingCycle==='lifetime'&&<div className="ud-prow ud-prow--disc"><span>One-time · No renewal</span><span>✓</span></div>}
            </div>
            {savingsText && <p className="ud-savings">{savingsText}</p>}
            <div className="ud-footer">
              <button className="ud-btn-later" onClick={()=>onClose()}>Later</button>
              <button className="ud-btn-cta" onClick={goToPayment}><span>Continue to Payment</span><ArrowRight size={15}/></button>
            </div>
          </div>
        )}

        {step === 1 && mode === 'credit' && (
          <div className="ud-body">
            <button className="ud-x" onClick={()=>onClose()}><X size={18}/></button>
            <h2 className="ud-title">Buy Template Credits</h2>
            <p className="ud-sub">Purchase credits to unlock premium Canva templates</p>
            <div className="ud-packs">
              {PRICING.credit.map(pack => (
                <div key={pack.id} className={`ud-pack${selectedPack.id===pack.id?' ud-pack--sel':''}`} onClick={()=>setSelectedPack(pack)}>
                  {pack.save && <div className="ud-pack-save">{pack.save}</div>}
                  {selectedPack.id===pack.id && <div className="ud-pack-check"><Check size={12}/></div>}
                  <div className="ud-pack-icon"><Zap size={18}/></div>
                  <h3 className="ud-pack-name">{pack.name}</h3>
                  <div className="ud-pack-credits"><span className="ud-camt">{pack.credits}</span><span className="ud-clbl">Credits</span></div>
                  <div className="ud-pack-price"><span className="ud-pamt">${pack.price}</span><span className="ud-plbl">USD</span></div>
                  <div className="ud-pack-desc">One-time payment</div>
                </div>
              ))}
            </div>
            <button className="ud-btn-buy" onClick={goToPayment}>Buy {selectedPack.credits} Credits for ${selectedPack.price}</button>
          </div>
        )}

        {step === 1 && mode === 'location' && (
          <div className="ud-body">
            <button className="ud-x" onClick={()=>onClose()}><X size={18}/></button>
            <h2 className="ud-title">Add More Locations</h2>
            <p className="ud-sub">Manage multiple locations from a single account</p>
            <div className="ud-cycle ud-cycle--center">
              <button className={billingCycle==='monthly'?'active':''} onClick={()=>setBillingCycle('monthly')}>Monthly</button>
              <button className={billingCycle==='yearly'?'active':''} onClick={()=>setBillingCycle('yearly')}>Yearly (1 month free)</button>
            </div>
            <div className="ud-loc-card">
              {billingCycle==='yearly'&&<div className="ud-popular">Popular</div>}
              <div className="ud-pack-icon"><MapPin size={26}/></div>
              <h3>Location Pack</h3>
              <p className="ud-loc-desc">Expand your reach with additional locations.</p>
              <div className="ud-plan-price"><span className="ud-plan-amt">${billingCycle==='monthly'?PRICING.location.monthly:PRICING.location.yearly}</span><span className="ud-plan-per">USD / {billingCycle==='monthly'?'3 locations/month':'3 locations/year'}</span></div>
              {savingsText&&<p className="ud-savings">💰 {savingsText}</p>}
              <ul className="ud-loc-features">
                <li><Check size={13} className="ud-ck"/> 3 Additional Locations</li>
                <li><Check size={13} className="ud-ck"/> Centralized Management</li>
                <li><Check size={13} className="ud-ck"/> Unified Billing</li>
              </ul>
              <button className="ud-btn-buy" onClick={goToPayment}>Buy Locations</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="ud-s2">
            <div className="ud-s2-hdr">
              <button className="ud-back" onClick={goBack}><ArrowLeft size={17}/></button>
              <h2>{step2Title}</h2>
              <button className="ud-x ud-x--inline" onClick={()=>onClose()}><X size={17}/></button>
            </div>
            {mode !== 'credit' && (
              <div className="ud-cycle ud-cycle--center ud-cycle--sm">
                <button className={billingCycle==='monthly'?'active':''} onClick={()=>setBillingCycle('monthly')}>Monthly</button>
                <button className={billingCycle==='yearly'?'active':''} onClick={()=>setBillingCycle('yearly')}>Yearly (1 month free)</button>
              </div>
            )}
            <div className="ud-grid">
              <div className="ud-left">
                <h3>{mode==='screen'?'How many screens do you need?':'Order Summary'}</h3>
                {mode==='screen'&&(
                  <>
                    <div className="ud-qlg">
                      <button onClick={()=>setScreenQuantity(q=>Math.max(1,q-1))} disabled={screenQuantity<=1}><Minus size={15}/></button>
                      <span className="ud-qlg-num">{screenQuantity}</span>
                      <button onClick={()=>setScreenQuantity(q=>q+1)}><Plus size={15}/></button>
                    </div>
                    {usedScreens>0&&<p className="ud-qhelp">You have {usedScreens} screens created. To purchase fewer screens, delete some first.</p>}
                  </>
                )}
                {mode==='credit'&&(
                  <div className="ud-orow"><div className="ud-oico"><Zap size={15}/></div><div><div className="ud-oname">{selectedPack.name}</div><div className="ud-osub">{selectedPack.credits} Credits · One-time</div></div></div>
                )}
                {mode==='location'&&(
                  <div className="ud-orow"><div className="ud-oico"><MapPin size={15}/></div><div><div className="ud-oname">Location Pack</div><div className="ud-osub">3 Locations · {billingCycle}</div></div></div>
                )}
                <div className="ud-pdlg">
                  <div className="ud-curr">USD <span>▾</span></div>
                  <span className="ud-fprice">${totalPrice.toFixed(2)}</span>
                </div>
                <input type="text" placeholder="Coupon Code" value={couponCode} onChange={e=>setCouponCode(e.target.value)} className="ud-coupon" disabled={isProcessing}/>
              </div>
              <div className="ud-right">
                <h3>Pay with Card</h3>
                <input type="text" placeholder="Name on card" value={cardholderName} onChange={e=>setCardholderName(e.target.value)} className="ud-namein" disabled={isProcessing}/>
                <div id="ud-card-element" className="ud-cardel"/>
                {paymentError&&<div className="ud-perr"><ShieldCheck size={13}/>{paymentError}</div>}
                <div className="ud-actns">
                  <button className="ud-paybtn" onClick={confirmPayment} disabled={isProcessing||!clientSecret}>
                    {isProcessing?'Processing…':`Pay $${totalPrice.toFixed(2)}`}
                  </button>
                  <button className="ud-canbtn" onClick={()=>onClose()} disabled={isProcessing}>Cancel</button>
                </div>
                <div className="ud-sfooter">
                  <p>By confirming your card, you allow DigitalSignage to charge your card for future payments in accordance with their terms.</p>
                  <div className="ud-sbadge"><span>Powered by <strong>stripe</strong></span><div className="ud-cicons"><ShieldCheck size={12}/><span>VISA</span><span>MC</span><span>AMEX</span></div></div>
                </div>
              </div>
            </div>
            {paymentSuccess&&(
              <div className="ud-succ">
                <div className="ud-succ-inner">
                  <div className="ud-succ-ico"><Check size={34}/></div>
                  <h3>Payment Successful!</h3>
                  <p>Your subscription has been activated.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .ud-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);animation:udfade .15s ease}
        @keyframes udfade{from{opacity:0}}
        .ud-dialog{background:#fff;color:#111;border-radius:22px;width:460px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 28px 90px rgba(0,0,0,.3);animation:udin .2s ease;position:relative}
        .ud-dialog.ud-step2{width:900px}
        .ud-dialog.ud-credit{width:620px}
        @keyframes udin{from{opacity:0;transform:scale(.95) translateY(14px)}}
        .ud-body{padding:2rem 1.75rem 1.75rem;position:relative}
        .ud-x{position:absolute;top:1rem;right:1rem;background:none;border:1px solid #e5e7eb;border-radius:8px;padding:.3rem;cursor:pointer;color:#6b7280;display:flex;align-items:center;transition:background .15s}
        .ud-x:hover{background:#f3f4f6}
        .ud-x--inline{position:static}
        .ud-hero{text-align:center;margin-bottom:1.5rem}
        .ud-icon-stack{position:relative;display:inline-block;margin-bottom:.75rem}
        .ud-plus-badge{position:absolute;bottom:-4px;right:-6px;background:#111;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center}
        .ud-title{font-size:1.3rem;font-weight:800;margin:0 0 .35rem;text-align:center}
        .ud-sub{font-size:.875rem;color:#6b7280;text-align:center;margin:0 0 1.5rem}
        .ud-savings{font-size:.82rem;color:#059669;text-align:center;margin:.25rem 0 .75rem}
        .ud-impact{display:flex;justify-content:center;margin-bottom:1.25rem}
        .ud-stat-card{border:2px solid #111;border-radius:14px;padding:1rem 2.5rem;text-align:center;display:flex;flex-direction:column;gap:.2rem}
        .ud-slbl{font-size:.6rem;font-weight:800;letter-spacing:.1em;color:#9ca3af}
        .ud-sval{font-size:2.25rem;font-weight:800}
        .ud-selector-row{display:flex;align-items:center;justify-content:center;background:#f9fafb;border-radius:12px;padding:.75rem 1rem;margin-bottom:1.25rem;gap:1.5rem;flex-wrap:wrap}
        .ud-qrow{display:flex;align-items:center;gap:.75rem}
        .ud-qbtn{background:#fff;border:1px solid #e5e7eb;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}
        .ud-qbtn:hover:not(:disabled){background:#f3f4f6}
        .ud-qbtn:disabled{opacity:.4;cursor:not-allowed}
        .ud-qdisp{text-align:center}
        .ud-qnum{font-size:1.2rem;font-weight:700;display:block}
        .ud-qlbl{font-size:.58rem;font-weight:800;color:#9ca3af;letter-spacing:.08em}
        .ud-cycle{display:flex;gap:.2rem;background:#f3f4f6;border-radius:10px;padding:.18rem}
        .ud-cycle--center{justify-content:center;margin:0 auto 1.25rem;width:fit-content}
        .ud-cycle--sm{margin-top:.75rem;margin-bottom:.75rem}
        .ud-cycle button,.ud-cycle--center button{padding:.42rem .9rem;border:none;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;background:none;color:#6b7280;transition:all .15s}
        .ud-cycle button.active,.ud-cycle--center button.active{background:#fff;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.12)}
        .ud-psummary{background:#f9fafb;border-radius:10px;padding:.7rem 1rem;margin-bottom:.75rem}
        .ud-prow{display:flex;justify-content:space-between;font-size:.88rem;font-weight:500;padding:.18rem 0}
        .ud-prow--disc{color:#059669;font-weight:700}
        .ud-footer{display:flex;gap:.75rem;margin-top:1.25rem}
        .ud-btn-later{flex:1;padding:.72rem;border:1px solid #e5e7eb;border-radius:12px;background:#fff;font-weight:600;cursor:pointer;font-size:.875rem;color:#374151;transition:background .15s}
        .ud-btn-later:hover{background:#f9fafb}
        .ud-btn-cta{flex:1.6;padding:.72rem 1rem;background:#111;color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.45rem;font-size:.875rem;transition:background .15s}
        .ud-btn-cta:hover{background:#333}
        /* credit */
        .ud-packs{display:grid;grid-template-columns:repeat(3,1fr);gap:.85rem;margin-bottom:1.25rem}
        .ud-pack{border:2px solid #e5e7eb;border-radius:16px;padding:1.1rem .8rem;cursor:pointer;position:relative;text-align:center;transition:all .15s;background:#fff}
        .ud-pack:hover{border-color:#374151}
        .ud-pack--sel{border-color:#111;background:#f9fafb;box-shadow:0 0 0 3px rgba(0,0,0,.06)}
        .ud-pack-save{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#16a34a;color:#fff;font-size:.72rem;font-weight:800;padding:.25rem .75rem;border-radius:999px;white-space:nowrap;letter-spacing:.02em;box-shadow:0 2px 8px rgba(22,163,74,.35)}
        .ud-pack-check{position:absolute;top:.45rem;right:.45rem;background:#111;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center}
        .ud-pack-icon{color:#6366f1;display:flex;justify-content:center;margin-bottom:.4rem}
        .ud-pack-name{font-size:.82rem;font-weight:700;margin:0 0 .5rem}
        .ud-pack-credits{display:flex;flex-direction:column}
        .ud-camt{font-size:1.7rem;font-weight:800}
        .ud-clbl{font-size:.68rem;color:#6b7280}
        .ud-pack-price{display:flex;align-items:baseline;justify-content:center;gap:.2rem}
        .ud-pamt{font-size:1.05rem;font-weight:800}
        .ud-plbl{font-size:.68rem;color:#6b7280}
        .ud-pack-desc{font-size:.65rem;color:#9ca3af;margin-top:.25rem}
        .ud-btn-buy{width:100%;padding:.85rem;background:#111;color:#fff;border:none;border-radius:14px;font-weight:700;font-size:.9rem;cursor:pointer;transition:background .15s}
        .ud-btn-buy:hover{background:#333}
        /* location */
        .ud-loc-card{border:2px solid #e5e7eb;border-radius:16px;padding:1.5rem;text-align:center;position:relative}
        .ud-popular{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#6366f1;color:#fff;font-size:.62rem;font-weight:800;padding:.18rem .7rem;border-radius:999px}
        .ud-loc-desc{font-size:.85rem;color:#6b7280;margin:.2rem 0 .75rem}
        .ud-plan-price{display:flex;align-items:baseline;justify-content:center;gap:.35rem;margin-bottom:.5rem}
        .ud-plan-amt{font-size:2.1rem;font-weight:800}
        .ud-plan-per{font-size:.78rem;color:#6b7280}
        .ud-loc-features{list-style:none;padding:0;margin:.65rem 0 1.25rem;text-align:left;display:flex;flex-direction:column;gap:.4rem}
        .ud-loc-features li{display:flex;align-items:center;gap:.4rem;font-size:.84rem;color:#374151}
        .ud-ck{color:#059669;flex-shrink:0}
        /* step 2 */
        .ud-s2{position:relative}
        .ud-s2-hdr{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #f3f4f6}
        .ud-s2-hdr h2{font-size:.98rem;font-weight:700;margin:0}
        .ud-back{background:none;border:1px solid #e5e7eb;border-radius:8px;padding:.3rem;cursor:pointer;color:#6b7280;display:flex;align-items:center}
        .ud-back:hover{background:#f3f4f6}
        .ud-grid{display:grid;grid-template-columns:1fr 1fr;min-height:360px}
        .ud-left{padding:1.5rem 1.75rem;border-right:1px solid #f3f4f6;display:flex;flex-direction:column;gap:.9rem}
        .ud-left h3{font-size:.92rem;font-weight:700;margin:0}
        .ud-right{padding:1.5rem 1.75rem;display:flex;flex-direction:column;gap:.75rem}
        .ud-right h3{font-size:.92rem;font-weight:700;margin:0}
        .ud-qlg{display:flex;align-items:center;gap:.7rem;background:#f9fafb;border-radius:10px;padding:.5rem .75rem;width:fit-content}
        .ud-qlg button{background:#fff;border:1px solid #e5e7eb;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .ud-qlg button:disabled{opacity:.4;cursor:not-allowed}
        .ud-qlg-num{font-size:1.2rem;font-weight:700;min-width:2rem;text-align:center}
        .ud-qhelp{font-size:.76rem;color:#6b7280;margin:0}
        .ud-orow{display:flex;align-items:center;gap:.7rem}
        .ud-oico{width:34px;height:34px;background:#f3f4f6;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#6366f1;flex-shrink:0}
        .ud-oname{font-weight:700;font-size:.88rem}
        .ud-osub{font-size:.76rem;color:#6b7280}
        .ud-pdlg{display:flex;align-items:baseline;gap:.7rem}
        .ud-curr{display:flex;align-items:center;gap:.2rem;border:1px solid #e5e7eb;padding:.38rem .55rem;border-radius:8px;font-size:.82rem;font-weight:600;color:#374151;background:#fff}
        .ud-fprice{font-size:1.9rem;font-weight:800}
        .ud-coupon{border:1px solid #e5e7eb;border-radius:10px;padding:.6rem .85rem;font-size:.88rem;color:#374151;outline:none;background:#fff;width:100%;box-sizing:border-box}
        .ud-coupon:focus{border-color:#374151}
        .ud-namein{border:1px solid #e5e7eb;border-radius:10px;padding:.7rem .85rem;font-size:.92rem;color:#111;outline:none;background:#fff;width:100%;box-sizing:border-box}
        .ud-namein:focus{border-color:#374151}
        .ud-cardel{border:1px solid #e5e7eb;border-radius:10px;padding:.75rem .85rem;background:#fff;min-height:42px}
        .ud-perr{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:.8rem;padding:.55rem .75rem;border-radius:8px;display:flex;align-items:center;gap:.4rem}
        .ud-actns{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
        .ud-paybtn{padding:.72rem;background:#111;color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.88rem;transition:background .15s}
        .ud-paybtn:hover:not(:disabled){background:#333}
        .ud-paybtn:disabled{opacity:.55;cursor:not-allowed}
        .ud-canbtn{padding:.72rem;background:#fff;color:#374151;border:1px solid #e5e7eb;border-radius:12px;font-weight:600;cursor:pointer;font-size:.88rem;transition:background .15s}
        .ud-canbtn:hover:not(:disabled){background:#f9fafb}
        .ud-sfooter{margin-top:auto}
        .ud-sfooter p{font-size:.7rem;color:#9ca3af;margin:0 0 .45rem;line-height:1.5}
        .ud-sbadge{display:flex;align-items:center;justify-content:space-between}
        .ud-sbadge>span{font-size:.76rem;color:#6b7280}
        .ud-sbadge strong{color:#635bff}
        .ud-cicons{display:flex;align-items:center;gap:.35rem;font-size:.7rem;font-weight:700;color:#374151}
        .ud-succ{position:absolute;inset:0;background:rgba(255,255,255,.96);display:flex;align-items:center;justify-content:center;border-radius:22px;z-index:10;animation:udfade .2s ease}
        .ud-succ-inner{text-align:center}
        .ud-succ-ico{width:64px;height:64px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#16a34a;margin:0 auto 1rem}
        .ud-succ-inner h3{font-size:1.2rem;font-weight:800;margin:0 0 .35rem}
        .ud-succ-inner p{font-size:.88rem;color:#6b7280;margin:0}
        @media(max-width:700px){.ud-dialog.ud-step2{width:96vw}.ud-grid{grid-template-columns:1fr}.ud-left{border-right:none;border-bottom:1px solid #f3f4f6}.ud-packs{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
