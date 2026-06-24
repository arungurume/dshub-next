'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  CreditCard, Zap, Check, RefreshCw, Star,
  AlertCircle, ShieldCheck, ReceiptText, ExternalLink, Monitor
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { cmsApi, cmsApiV2 } from '@/lib/api';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  planType: string;
  canCreateScreen: boolean;
  totalScreens: number;
  usedScreens: number;
  currentPeriodEnd?: string;
}

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  amount: number;
  currency: string;
  badge?: string;
}

// ─── Stripe locale-aware initializer ─────────────────────────────────────────
// Re-initialised when locale changes (per the Angular StripeElementsService pattern)
function getStripe(locale: string) {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '', { locale: locale as any });
}

// ─── Card Payment Form ────────────────────────────────────────────────────────

function CardPaymentForm({ clientSecret, amount, onSuccess, onCancel }: {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardErrors, setCardErrors] = useState({ number: '', expiry: '', cvc: '' });

  const elementStyle = {
    style: {
      base: {
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '15px',
        '::placeholder': { color: '#64748b' },
      },
      invalid: { color: '#ef4444' }
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) { setProcessing(false); return; }

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardNumber }
      });

      if (error) {
        toast.error(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        toast.success('Payment successful! Credits activated.');
        onSuccess();
      } else if (paymentIntent?.status === 'requires_action') {
        // SCA — stripe handles the 3DS flow
        toast.info('Additional verification required…');
      }
    } catch {
      toast.error('Payment error. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <div className="card-field">
        <label className="field-label">Card Number</label>
        <div className="stripe-element">
          <CardNumberElement
            options={elementStyle}
            onChange={e => setCardErrors(prev => ({ ...prev, number: e.error?.message || '' }))}
            id="card-number-element"
          />
        </div>
        {cardErrors.number && <p className="field-error">{cardErrors.number}</p>}
      </div>
      <div className="card-row-2">
        <div className="card-field">
          <label className="field-label">Expiry</label>
          <div className="stripe-element">
            <CardExpiryElement
              options={elementStyle}
              onChange={e => setCardErrors(prev => ({ ...prev, expiry: e.error?.message || '' }))}
              id="card-expiry-element"
            />
          </div>
          {cardErrors.expiry && <p className="field-error">{cardErrors.expiry}</p>}
        </div>
        <div className="card-field">
          <label className="field-label">CVC</label>
          <div className="stripe-element">
            <CardCvcElement
              options={elementStyle}
              onChange={e => setCardErrors(prev => ({ ...prev, cvc: e.error?.message || '' }))}
              id="card-cvc-element"
            />
          </div>
          {cardErrors.cvc && <p className="field-error">{cardErrors.cvc}</p>}
        </div>
      </div>
      <div className="card-form-footer">
        <div className="secure-note"><ShieldCheck size={13} /> Secured by Stripe</div>
        <div className="card-form-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={processing} id="pay-now-btn">
            {processing ? <RefreshCw size={13} className="spin" /> : <CreditCard size={13} />}
            Pay ${(amount / 100).toFixed(2)}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Credit Pack Card ─────────────────────────────────────────────────────────

function CreditPackCard({ pack, onBuy }: { pack: CreditPack; onBuy: (pack: CreditPack) => void }) {
  return (
    <div className="credit-card" id={`credit-pack-${pack.id}`}>
      {pack.badge && <div className="credit-badge">{pack.badge}</div>}
      <div className="credit-icon"><Zap size={22} /></div>
      <h3 className="credit-name">{pack.name}</h3>
      <p className="credit-credits">{pack.credits} Credits</p>
      <p className="credit-price">${(pack.amount / 100).toFixed(2)} <span className="credit-currency">{pack.currency.toUpperCase()}</span></p>
      <button className="btn-primary btn-block" onClick={() => onBuy(pack)} id={`buy-${pack.id}`}>
        Buy Now
      </button>
    </div>
  );
}

// ─── Subscription Plan Card ───────────────────────────────────────────────────

function PlanCard({ title, price, currency, screens, features, current, onSelect }: {
  title: string; price: string; currency: string; screens: number;
  features: string[]; current: boolean; onSelect: () => void;
}) {
  return (
    <div className={`plan-card${current ? ' plan-current' : ''}`}>
      {current && <div className="plan-badge">Current Plan</div>}
      <h3 className="plan-name">{title}</h3>
      <div className="plan-price">
        <span className="plan-amount">{price}</span>
        <span className="plan-period">/{currency} mo</span>
      </div>
      <p className="plan-screens"><Monitor size={13} /> Up to {screens} screens</p>
      <ul className="plan-features">
        {features.map((f, i) => (
          <li key={i}><Check size={13} className="check-icon" /> {f}</li>
        ))}
      </ul>
      <button
        className={current ? 'btn-secondary btn-block' : 'btn-primary btn-block'}
        onClick={onSelect}
        disabled={current}
        id={`select-plan-${title.toLowerCase().replace(' ', '-')}`}
      >
        {current ? 'Current Plan' : 'Upgrade'}
      </button>
    </div>
  );
}



// ─── Main Page ────────────────────────────────────────────────────────────────

const CREDIT_PACKS: CreditPack[] = [
  { id: 'credits_10', name: 'Starter Pack', credits: 10, amount: 999, currency: 'USD' },
  { id: 'credits_50', name: 'Value Pack', credits: 50, amount: 3999, currency: 'USD', badge: 'Popular' },
  { id: 'credits_150', name: 'Pro Pack', credits: 150, amount: 9999, currency: 'USD', badge: 'Best Value' },
];

export default function BillingPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [paymentModal, setPaymentModal] = useState<{ clientSecret: string; amount: number } | null>(null);
  const [stripeInstance, setStripeInstance] = useState<any>(null);

  // Get locale for Stripe locale-awareness (mirrors Angular StripeElementsService)
  const locale = typeof window !== 'undefined' ? (localStorage.getItem('lang') || 'en') : 'en';

  useEffect(() => {
    setStripeInstance(getStripe(locale));
  }, [locale]);

  useEffect(() => {
    Promise.all([
      cmsApi.get('/sac/my/subscriptions').then(({ data }) => setPlan(
        Array.isArray(data) ? data[0] : data
      )).catch(() => {}),
      cmsApiV2.get('/sac/my/purchase-history').then(({ data }) => setInvoices(
        data.purchaseHistory || data.invoices || []
      )).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  async function buyCredits(pack: CreditPack) {
    try {
      // Backend expects totalPrice in dollars (it converts to cents internally)
      const { data } = await cmsApiV2.post('/spgc/create-intent', {
        stripPurposeType: 'TEMPLATE_CREDIT',
        totalPrice: pack.amount / 100,      // cents → dollars
        quantity: pack.credits,
        currencyCode: pack.currency,
        billingCycle: 'one-time',
        unitPrice: 0,
      });
      setPaymentModal({ clientSecret: data.clientSecret, amount: pack.amount });
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data || err?.message || 'Unknown error';
      console.error('buyCredits error:', status, msg);
      // Show the real error so we can debug without DevTools
      toast.error(`Payment error [${status || 'NET'}]: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
  }

  async function handlePlanUpgrade(planKey: string, priceUsd: string) {
    const planPrices: Record<string, number> = { STARTER: 9, PRO: 29, BUSINESS: 79 };
    const totalPrice = planPrices[planKey] || 9;
    try {
      const { data } = await cmsApiV2.post('/spgc/create-intent', {
        stripPurposeType: 'SCREEN',
        totalPrice,
        quantity: 1,
        currencyCode: 'USD',
        billingCycle: 'monthly',
        unitPrice: totalPrice,
      });
      setPaymentModal({ clientSecret: data.clientSecret, amount: totalPrice * 100 });
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data || err?.message || 'Unknown';
      console.error('handlePlanUpgrade error:', status, msg);
      toast.error(`Upgrade error [${status || 'NET'}]: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
  }

  async function openPortal() {
    try {
      const { data } = await cmsApi.post('/spgc/create-customer-portal-session', {});
      window.open(data.url, '_blank');
    } catch {
      toast.error('Failed to open billing portal');
    }
  }

  function onPaymentSuccess() {
    setPaymentModal(null);
    // Refresh plan after payment
    cmsApi.get('/sac/my/subscriptions').then(({ data }) => setPlan(
      Array.isArray(data) ? data[0] : data
    )).catch(() => {});
  }

  const plans = [
    { key: 'STARTER', title: 'Starter', price: '9', currency: 'USD', screens: 3, features: ['3 Screens', '5 GB Storage', 'Basic Templates', 'Email Support'] },
    { key: 'PRO', title: 'Pro', price: '29', currency: 'USD', screens: 10, features: ['10 Screens', '25 GB Storage', 'All Templates', 'Priority Support', 'Canva Integration'] },
    { key: 'BUSINESS', title: 'Business', price: '79', currency: 'USD', screens: 50, features: ['50 Screens', '100 GB Storage', 'All Templates', 'Dedicated Support', 'Custom Branding', 'API Access'] },
  ];

  return (
    <div className="billing-page">
      {loading ? (
        <div className="page-loading"><RefreshCw size={24} className="spin" /><span>Loading billing info…</span></div>
      ) : (
        <>
          {/* Current plan banner */}
          {plan && (
            <div className="current-plan-bar">
              <div className="cpb-left">
                <Star size={16} />
                <div>
                  <span className="cpb-plan">{plan.planType || 'Free'} Plan</span>
                  <span className="cpb-screens"> — {plan.usedScreens}/{plan.totalScreens} screens used</span>
                </div>
              </div>
              <button className="btn-secondary btn-sm" onClick={openPortal} id="manage-billing-btn">
                <ExternalLink size={13} /> Manage Billing
              </button>
            </div>
          )}

          {/* Subscription Plans */}
          <section className="billing-section">
            <h2 className="section-title">Subscription Plans</h2>
            <div className="plans-grid">
              {plans.map(({ key: planKey, ...rest }) => (
                <PlanCard
                  key={planKey}
                  {...rest}
                  current={plan?.planType === planKey}
                  onSelect={() => handlePlanUpgrade(planKey, rest.price)}
                />
              ))}
            </div>
          </section>

          {/* Credit Packs */}
          <section className="billing-section">
            <h2 className="section-title">Template Credits</h2>
            <p className="section-sub">One-time credit packs for purchasing premium templates</p>
            <div className="credits-grid">
              {CREDIT_PACKS.map(pack => (
                <CreditPackCard key={pack.id} pack={pack} onBuy={buyCredits} />
              ))}
            </div>
          </section>

          {/* Invoice history */}
          {invoices.length > 0 && (
            <section className="billing-section">
              <h2 className="section-title">Invoice History</h2>
              <div className="invoice-table-wrap">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} id={`invoice-${inv.id}`}>
                        <td className="cell-muted">{inv.date ? new Date(inv.date * 1000).toLocaleDateString() : '—'}</td>
                        <td>{inv.description || inv.lines?.data?.[0]?.description || '—'}</td>
                        <td>${((inv.amount_paid || 0) / 100).toFixed(2)} {inv.currency?.toUpperCase()}</td>
                        <td>
                          <span className={`invoice-status ${inv.status === 'paid' ? 'status-paid' : 'status-pending'}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td>
                          {inv.invoice_pdf && (
                            <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" className="invoice-dl" id={`dl-invoice-${inv.id}`}>
                              <ReceiptText size={13} /> PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* Payment Modal — locale-aware Stripe Elements */}
      {paymentModal && stripeInstance && (
        <div className="modal-overlay">
          <div className="payment-modal">
            <div className="payment-modal-hd">
              <h3>Complete Payment</h3>
            </div>
            <div className="payment-modal-bd">
              <Elements stripe={stripeInstance} options={{ clientSecret: paymentModal.clientSecret, locale: locale as any }}>
                <CardPaymentForm
                  clientSecret={paymentModal.clientSecret}
                  amount={paymentModal.amount}
                  onSuccess={onPaymentSuccess}
                  onCancel={() => setPaymentModal(null)}
                />
              </Elements>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .billing-page { padding: 1.5rem 2rem; }
        .page-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 4rem; color: var(--text-muted); }

        .current-plan-bar { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(99,102,241,.15), rgba(139,92,246,.1)); border: 1px solid rgba(99,102,241,.3); border-radius: 14px; padding: 1rem 1.5rem; margin-bottom: 2rem; flex-wrap: wrap; gap: .75rem; }
        .cpb-left { display: flex; align-items: center; gap: .75rem; color: var(--accent); }
        .cpb-plan { font-weight: 700; font-size: 1rem; color: var(--text); }
        .cpb-screens { font-size: .875rem; color: var(--text-muted); }

        .billing-section { margin-bottom: 2.5rem; }
        .section-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 .5rem; }
        .section-sub { font-size: .85rem; color: var(--text-muted); margin: 0 0 1rem; }

        /* Plans */
        .plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.25rem; }
        .plan-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 1.5rem; display: flex; flex-direction: column; gap: .75rem; position: relative; transition: box-shadow .2s; }
        .plan-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,.15); }
        .plan-current { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .plan-badge { position: absolute; top: 1rem; right: 1rem; background: var(--accent); color: white; font-size: .65rem; font-weight: 700; padding: .2rem .55rem; border-radius: 999px; }
        .plan-name { font-size: 1rem; font-weight: 700; margin: 0; }
        .plan-price { display: flex; align-items: baseline; gap: .25rem; }
        .plan-amount { font-size: 2rem; font-weight: 800; }
        .plan-period { font-size: .8rem; color: var(--text-muted); }
        .plan-screens { font-size: .8rem; color: var(--text-muted); display: flex; align-items: center; gap: .3rem; margin: 0; }
        .plan-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .4rem; flex: 1; }
        .plan-features li { display: flex; align-items: center; gap: .5rem; font-size: .82rem; color: var(--text-muted); }
        .check-icon { color: #22c55e; flex-shrink: 0; }

        /* Credit packs */
        .credits-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.25rem; }
        .credit-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: .6rem; text-align: center; position: relative; transition: box-shadow .2s; }
        .credit-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.15); }
        .credit-badge { position: absolute; top: -10px; background: #f59e0b; color: white; font-size: .65rem; font-weight: 700; padding: .2rem .65rem; border-radius: 999px; }
        .credit-icon { width: 52px; height: 52px; border-radius: 14px; background: var(--btn-cta-bg); display: flex; align-items: center; justify-content: center; color: white; }
        .credit-name { font-size: .9rem; font-weight: 700; margin: 0; }
        .credit-credits { font-size: .8rem; color: var(--text-muted); margin: 0; }
        .credit-price { font-size: 1.4rem; font-weight: 800; margin: 0; }
        .credit-currency { font-size: .75rem; font-weight: 600; color: var(--text-muted); }

        /* Invoices */
        .invoice-table-wrap { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
        .invoice-table { width: 100%; border-collapse: collapse; }
        .invoice-table th { text-align: left; padding: .75rem 1rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--sidebar-bg); }
        .invoice-table td { padding: .75rem 1rem; font-size: .875rem; border-bottom: 1px solid var(--border); }
        .invoice-table tr:last-child td { border-bottom: none; }
        .cell-muted { color: var(--text-muted); }
        .invoice-status { font-size: .72rem; font-weight: 700; padding: .2rem .55rem; border-radius: 999px; }
        .status-paid { background: #dcfce7; color: #16a34a; }
        .status-pending { background: #fef3c7; color: #d97706; }
        .invoice-dl { display: inline-flex; align-items: center; gap: .3rem; font-size: .78rem; color: var(--accent); text-decoration: none; }
        .invoice-dl:hover { text-decoration: underline; }

        /* Payment modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(6px); }
        .payment-modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; width: 480px; max-width: 95vw; box-shadow: 0 32px 80px rgba(0,0,0,.5); animation: modal-in .2s ease; }
        @keyframes modal-in { from { opacity:0; transform: scale(.95) translateY(10px); } }
        .payment-modal-hd { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
        .payment-modal-hd h3 { font-size: .95rem; font-weight: 700; margin: 0; }
        .payment-modal-bd { padding: 1.5rem; }

        /* Card form */
        .card-form { display: flex; flex-direction: column; gap: 1rem; }
        .card-field { display: flex; flex-direction: column; gap: .4rem; }
        .field-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
        .stripe-element { background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; padding: .75rem 1rem; }
        .stripe-element:focus-within { border-color: var(--accent); }
        .field-error { font-size: .75rem; color: #ef4444; margin: 0; }
        .card-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .card-form-footer { display: flex; align-items: center; justify-content: space-between; padding-top: .5rem; }
        .secure-note { display: flex; align-items: center; gap: .4rem; font-size: .75rem; color: var(--text-muted); }
        .card-form-actions { display: flex; gap: .75rem; }

        .btn-primary { display: inline-flex; align-items: center; gap: .5rem; background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none; padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease; }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .btn-secondary { display: inline-flex; align-items: center; gap: .5rem; background: var(--btn-secondary-bg); color: var(--btn-secondary-text); border: 1px solid var(--btn-secondary-border); padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .btn-secondary:hover { background: var(--btn-secondary-hover); }
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; cursor: pointer; }
        .btn-block { width: 100%; justify-content: center; }
        .btn-sm { padding: .4rem .9rem !important; font-size: .8rem !important; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
