'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw, ReceiptText, Zap, MapPin, Monitor, Check, X, BarChart2, ShoppingBag, Download } from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import UpgradeModal, { UpgradeMode } from '@/components/shared/UpgradeModal';
import TrialExpiredUpgradeModal, { type TrialScreenSummary } from '@/components/shared/TrialExpiredUpgradeModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  planType: string;
  canCreateScreen: boolean;
  totalScreens: number;
  usedScreens: number;
  totalLocations?: number;
  totalTemplates?: number;
  currentPeriodEnd?: string;
  subscriptionId?: string;
  entityId?: number;
  productName?: string;
}

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  amount: number;
  currency: string;
  badge?: string;
}

// ─── Cancel Survey Modal ──────────────────────────────────────────────────────
// Mirrors Angular's CancelSurveyDialogComponent exactly (same 6 reasons, same 2-step flow)

const CANCEL_REASONS = [
  'Found a better alternative',
  'Too expensive',
  'Missing features',
  'Technical issues',
  'Not using it enough',
  'Other',
];

function CancelSurveyModal({
  plan,
  onClose,
  onConfirm,
}: {
  plan: Plan;
  onClose: () => void;
  onConfirm: (reasons: string[], comment: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<'survey' | 'confirm'>('survey');
  const [cancelling, setCancelling] = useState(false);

  function toggleReason(r: string) {
    setSelected(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function handleConfirm() {
    setCancelling(true);
    try {
      await onConfirm(selected, comment);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="cs-overlay" onClick={onClose}>
      <div className="cs-card" onClick={e => e.stopPropagation()}>

        {step === 'survey' ? (
          <>
            <button className="cs-close" onClick={onClose}><X size={16} /></button>
            <div className="cs-icon">😔</div>
            <h2 className="cs-title">We're sorry to see you go</h2>
            <p className="cs-subtitle">Please let us know why you're cancelling. Your feedback helps us improve.</p>

            <div className="cs-reasons">
              {CANCEL_REASONS.map(reason => (
                <div
                  key={reason}
                  className={`cs-reason-item ${selected.includes(reason) ? 'selected' : ''}`}
                  onClick={() => toggleReason(reason)}
                >
                  <div className={`cs-checkbox ${selected.includes(reason) ? 'checked' : ''}`}>
                    {selected.includes(reason) && <Check size={11} />}
                  </div>
                  <span>{reason}</span>
                </div>
              ))}
            </div>

            {selected.includes('Other') && (
              <textarea
                className="cs-comment"
                rows={3}
                placeholder="Please tell us more…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            )}

            <div className="cs-actions">
              <button className="cs-btn-keep" onClick={onClose}>Keep Subscription</button>
              <button
                className="cs-btn-next"
                disabled={selected.length === 0}
                onClick={() => setStep('confirm')}
              >
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Confirm — mirrors Angular's confirmMainPlanCancellation popup */}
            <button className="cs-close" onClick={onClose}><X size={16} /></button>
            <div className="cs-icon">⚠️</div>
            <h2 className="cs-title">Confirm Cancellation</h2>
            <h4 className="cs-confirm-sub">
              Are you sure you want to cancel{plan.productName ? ` "${plan.productName}"` : ' your subscription'}?
            </h4>
            <p className="cs-lose-label">After your subscription expires, you'll lose access to:</p>
            <ul className="cs-lose-list">
              <li>❌ Creating new Templates</li>
              <li>❌ Additional Screen Slots</li>
              <li>❌ Playlists &amp; Schedules</li>
            </ul>
            <div className="cs-warning-pill">
              ⚠️ Your subscription will be cancelled at the end of the billing period.
            </div>
            <div className="cs-actions" style={{ marginTop: '1.25rem' }}>
              <button className="cs-btn-keep" onClick={() => setStep('survey')}>← Back</button>
              <button className="cs-btn-cancel-confirm" onClick={handleConfirm} disabled={cancelling}>
                {cancelling
                  ? <><RefreshCw size={13} className="spin" /> Cancelling…</>
                  : 'Cancel Subscription'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const FALLBACK_CREDIT_PACKS: CreditPack[] = [
  { id: 'credits_10', name: 'Starter Pack', credits: 10, amount: 999, currency: 'USD' },
  { id: 'credits_50', name: 'Value Pack', credits: 50, amount: 3999, currency: 'USD', badge: 'Popular' },
  { id: 'credits_150', name: 'Pro Pack', credits: 150, amount: 9999, currency: 'USD', badge: 'Best Value' },
];

export default function BillingPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [upgradeModal, setUpgradeModal] = useState<UpgradeMode | null>(null);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialScreens, setTrialScreens] = useState<TrialScreenSummary[]>([]);
  const [trialExpiredWithActiveScreens, setTrialExpiredWithActiveScreens] = useState(false);
  const [showCancelSurvey, setShowCancelSurvey] = useState(false);
  const [creditBalance, setCreditBalance] = useState<{ total: number; used: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'usage' | 'purchases' | 'invoices'>('usage');
  const [usageSubTab, setUsageSubTab] = useState<'credits' | 'screens' | 'locations'>('credits');
  const [creditEntitlements, setCreditEntitlements] = useState<any[]>([]);
  const [usageScreens, setUsageScreens] = useState<any[]>([]);
  const [usageLocations, setUsageLocations] = useState<any[]>([]);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>(FALLBACK_CREDIT_PACKS);
  const [planLimits, setPlanLimits] = useState<{
    screens: number; storageGb: number; locations: number; templateCredits: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      cmsApi.get('/sac/my/subscriptions').then(({ data }) => setPlan(
        Array.isArray(data) ? data[0] : data
      )).catch(() => {}),
      cmsApiV2.get('/sac/my/purchase-history').then(({ data }) => setInvoices(
        data.purchaseHistory || data.invoices || []
      )).catch(() => {}),
      cmsApiV2.get('/sac/my/template-credit-summary').then(({ data }) =>
        setCreditBalance({ total: data.totalCredits ?? 0, used: data.usedCredits ?? 0 })
      ).catch(() => {}),
      cmsApiV2.get('/sac/my/template-credits').then(({ data }) =>
        setCreditEntitlements(Array.isArray(data) ? data : [])
      ).catch(() => {}),
      cmsApiV2.get('/sac/my/screens').then(({ data }) =>
        setUsageScreens(Array.isArray(data) ? data : data?.content || [])
      ).catch(() => {}),
      cmsApiV2.get('/sac/my/locations').then(({ data }) =>
        setUsageLocations(Array.isArray(data) ? data : [])
      ).catch(() => {}),
      cmsApiV2.get('/sac/my/plan').then(({ data }) => {
        setTrialExpiredWithActiveScreens(data?.trialExpiredWithActiveScreens ?? false);
        setTrialScreens(data?.trialScreens ?? []);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));

    // Fetch dynamic credit packs + plan limits from plan config
    cmsApiV2.get('/sac/plan-config/pricing').then(({ data }: any) => {
      if (data?.creditPacks && Array.isArray(data.creditPacks)) {
        setCreditPacks(data.creditPacks.map((p: any) => ({
          id: p.id,
          name: p.name,
          credits: p.credits,
          amount: p.priceInCents || 0,
          currency: p.currency || 'USD',
          badge: p.badge || undefined,
        })));
      }
      if (data?.freePlan) {
        setPlanLimits({
          screens: data.freePlan.screens ?? 4,
          storageGb: data.freePlan.storageGb ?? 4,
          locations: data.freePlan.locations ?? 3,
          templateCredits: data.freePlan.templateCredits ?? 1,
        });
      }
    }).catch(() => { /* use fallback */ });
  }, []);

  function refreshPlan() {
    cmsApi.get('/sac/my/subscriptions').then(({ data }) => setPlan(
      Array.isArray(data) ? data[0] : data
    )).catch(() => {});
  }

  function handleModalClose(result?: { success: boolean }) {
    setUpgradeModal(null);
    if (result?.success) {
      toast.success('Payment successful! Your plan has been updated.');
      refreshPlan();
    }
  }

  // Mirrors Angular's cancelSubscription via stripe-payment.service → /v2/spgc/subscription/{entityId}/cancel-end
  async function handleCancelConfirm(reasons: string[], comment: string) {
    try {
      const entityId = plan?.entityId || plan?.subscriptionId;
      const payload = {
        selectedReasons: reasons,
        otherComment: comment,
        entityId,
        entityName: plan?.productName || plan?.planType || 'Subscription',
      };
      await cmsApiV2.post(`/spgc/subscription/${entityId}/cancel-end`, payload);
      toast.success('Subscription cancelled. Access continues until the end of your billing period.');
    } catch {
      // Angular also shows success-like message on error (cancel is queued server-side)
      toast.info('Cancellation request sent. Your access continues until the end of the billing period.');
    } finally {
      setShowCancelSurvey(false);
      refreshPlan();
    }
  }

  // ─── Helpers (ported from Angular billing components) ──────────────────────
  function formatBilling(item: any): string {
    const amount = item.price !== undefined ? item.price : (item.totalPrice !== undefined ? item.totalPrice : item.amount);
    if (amount === undefined || amount === null) return '—';
    const price = (Number(amount) / 100).toFixed(2);
    const currency = (item.currencyCode || item.currency || 'USD').toUpperCase();
    const symbol = currency === 'USD' || currency === 'CAD' ? '$' : currency;
    const cycle = item.billingCycle;
    if (cycle === 'monthly') return `${symbol}${price}/mo ${currency}`;
    if (cycle === 'yearly') return `${symbol}${price}/yr ${currency}`;
    return `${symbol}${price} ${currency}`;
  }

  function getStatusLabel(item: any): string {
    const s = item?.stripeEntitlementStatus;
    if (s === 'ACTIVE') return 'Active';
    if (s === 'CANCEL_PENDING') return 'Cancellation Scheduled';
    if (s === 'CANCELED') return 'Canceled';
    return s || 'Unknown';
  }

  function getBadgeClass(item: any): string {
    const s = (item?.stripeEntitlementStatus || item?.status || item?.stripeTransactionStatus || '').toLowerCase();
    if (s.includes('active') || s.includes('complete') || s.includes('paid') || s.includes('succeeded')) return 'badge-active';
    if (s.includes('cancel') || s.includes('fail')) return 'badge-cancelled';
    return 'badge-active';
  }

  function getItemName(purchase: any): string {
    const qty = purchase.quantity || 0;
    switch (purchase.stripPurposeType) {
      case 'TEMPLATE_CREDIT': return `Template Credits (${qty})`;
      case 'SCREEN': return `Screen (${qty})`;
      case 'LOCATION': return `Location (${qty})`;
      case 'MAIN_PLAN': return purchase.metadata?.productName || 'Subscription Plan';
      default: return purchase.type ? purchase.type.replace(/_/g, ' ') + ` (${qty})` : 'Purchase';
    }
  }

  function getDisplayStatus(purchase: any): string {
    const s = (purchase.status || '').toLowerCase();
    const cycle = purchase.billingCycle || '';
    const isSuccess = s.includes('complete') || s.includes('paid') || s.includes('succeeded');
    if (isSuccess) return (cycle === 'monthly' || cycle === 'yearly') ? 'Active' : 'Completed';
    return purchase.status ? purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1) : 'Active';
  }

  function handleDownloadInvoice(purchase: any) {
    const link = purchase.stripeInvoiceUrl || purchase.stripeInvoicePdf;
    if (link && typeof link === 'string' && link.toLowerCase().startsWith('http')) {
      window.open(link, '_blank');
    } else {
      toast.info('Invoice link unavailable. Please check your billing portal.');
    }
  }

  return (
    <div className="billing-page">
      {loading ? (
        <div className="page-loading"><RefreshCw size={24} className="spin" /><span>Loading billing info…</span></div>
      ) : (
        <>
          {/* ── Page Header ─────────────────────────────────────────────── */}
          <div className="bp-header">
            <div>
              <h1 className="bp-title">Subscription &amp; Billing</h1>
              <p className="bp-subtitle">Manage credits, screens, locations, purchases, and invoices.</p>
            </div>
            {plan && plan.planType && plan.planType !== 'FREE' && (
              <button
                className="btn-cancel-sub"
                onClick={() => setShowCancelSurvey(true)}
                id="cancel-subscription-btn"
              >
                Cancel Subscription
              </button>
            )}
          </div>

          {/* Active Plan Bar — only when on a real plan */}
          {plan && plan.planType && plan.planType !== 'FREE' && (
            <div className="active-plan-bar">
              <span className="active-plan-badge">Active Plan</span>
              <span className="active-plan-name">{plan.productName || plan.planType}</span>
              {plan.currentPeriodEnd && (
                <span className="active-plan-renews">
                  Renews {new Date(plan.currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
            </div>
          )}

          {/* ── Usage Overview ──────────────────────────────────────────── */}
          <section className="billing-section">
            <h2 className="section-title" style={{ marginBottom: '.9rem' }}>Usage Overview</h2>
            <div className="overview-grid">
              <div className="overview-card">
                <div className="ov-icon ov-icon-purple"><Zap size={18} /></div>
                <div className="ov-body">
                  <div className="ov-value">{creditBalance ? ((plan?.totalTemplates ?? creditBalance.total) - creditBalance.used) : '—'}</div>
                  <div className="ov-label">Credits Remaining</div>
                  {creditBalance && (
                    <div className="ov-sub">{creditBalance.used} used of {plan?.totalTemplates ?? creditBalance.total} total</div>
                  )}
                </div>
              </div>
              <div className="overview-card">
                <div className="ov-icon ov-icon-blue"><Monitor size={18} /></div>
                <div className="ov-body">
                  <div className="ov-value">{usageScreens.length} / {plan?.totalScreens ?? '—'}</div>
                  <div className="ov-label">Active Screens</div>
                  <div className="ov-sub">{plan?.totalScreens ?? '—'} total screen slots</div>
                </div>
              </div>
              <div className="overview-card">
                <div className="ov-icon ov-icon-green"><MapPin size={18} /></div>
                <div className="ov-body">
                  <div className="ov-value">{usageLocations.length} / {plan?.totalLocations ?? planLimits?.locations ?? '—'}</div>
                  <div className="ov-label">Locations</div>
                  <div className="ov-sub">{plan?.totalLocations ?? planLimits?.locations ?? '—'} allowed locations</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Buy Additional Resources ────────────────────────────────── */}
          <section className="billing-section">
            <h2 className="section-title" style={{ marginBottom: '.9rem' }}>Buy Additional Resources</h2>
            <div className="resource-grid">
              <div className="resource-card">
                <div className="resource-icon"><Monitor size={20} /></div>
                <div className="resource-body">
                  <div className="resource-name">Screen Slots</div>
                  <div className="resource-desc">Purchase additional screen slots for your account.</div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => trialExpiredWithActiveScreens ? setShowTrialModal(true) : setUpgradeModal('screen')}
                  id="buy-screens-btn"
                >
                  <Monitor size={14} />
                  {trialExpiredWithActiveScreens ? 'Reactivate Trial Screens' : 'Buy Screen Slots'}
                </button>
              </div>
              <div className="resource-card">
                <div className="resource-icon"><MapPin size={20} /></div>
                <div className="resource-body">
                  <div className="resource-name">Additional Locations</div>
                  <div className="resource-desc">Manage multiple locations from a single account.</div>
                </div>
                <button className="btn-primary" onClick={() => setUpgradeModal('location')} id="buy-locations-btn">
                  <MapPin size={14} /> Buy Locations
                </button>
              </div>
            </div>
          </section>

          {/* ── Template Credits ────────────────────────────────────────── */}
          <section className="billing-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Template Credits</h2>
                <p className="section-sub">One-time credit packs for purchasing premium Canva templates</p>
              </div>
              {creditBalance !== null && (
                <div className="credit-balance-pill">
                  <Zap size={13} />
                  <span><strong>{creditBalance.total - creditBalance.used}</strong> credits remaining</span>
                </div>
              )}
            </div>
            <div className="credits-grid">
              {creditPacks.map(pack => (
                <div key={pack.id} className="credit-card" id={`credit-pack-${pack.id}`}>
                  {pack.badge && <div className="credit-badge">{pack.badge}</div>}
                  <div className="credit-icon"><Zap size={22} /></div>
                  <h3 className="credit-name">{pack.name}</h3>
                  <p className="credit-credits">{pack.credits} Credits</p>
                  <p className="credit-price">${pack.amount % 100 === 0 ? (pack.amount / 100) : (pack.amount / 100).toFixed(2)} <span className="credit-currency">{pack.currency}</span></p>
                  <button className="btn-primary btn-block" onClick={() => setUpgradeModal('credit')} id={`buy-${pack.id}`}>
                    Buy {pack.name}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ── Usage / Your Purchases / Invoices Tabs ─────────────────── */}
          <section className="billing-section tab-section">
            <div className="billing-tabs">
              <button className={`billing-tab ${activeTab === 'usage' ? 'tab-active' : ''}`} onClick={() => setActiveTab('usage')} id="tab-usage">
                <BarChart2 size={14} /> Usage
              </button>
              <button className={`billing-tab ${activeTab === 'purchases' ? 'tab-active' : ''}`} onClick={() => setActiveTab('purchases')} id="tab-purchases">
                <ShoppingBag size={14} /> Your Purchases
              </button>
              <button className={`billing-tab ${activeTab === 'invoices' ? 'tab-active' : ''}`} onClick={() => setActiveTab('invoices')} id="tab-invoices">
                <ReceiptText size={14} /> Invoices
              </button>
            </div>

            <div className="tab-body">
              {activeTab === 'usage' && (
                <div>
                  {/* Sub-tab chips */}
                  <div className="usage-chips">
                    <button
                      className={`usage-chip ${usageSubTab === 'credits' ? 'chip-active' : ''}`}
                      onClick={() => setUsageSubTab('credits')}
                      id="usage-sub-credits"
                    >
                      <Zap size={12} /> Credits
                    </button>
                    <button
                      className={`usage-chip ${usageSubTab === 'screens' ? 'chip-active' : ''}`}
                      onClick={() => setUsageSubTab('screens')}
                      id="usage-sub-screens"
                    >
                      <Monitor size={12} /> Screens
                    </button>
                    <button
                      className={`usage-chip ${usageSubTab === 'locations' ? 'chip-active' : ''}`}
                      onClick={() => setUsageSubTab('locations')}
                      id="usage-sub-locations"
                    >
                      <MapPin size={12} /> Locations
                    </button>
                  </div>

                  {/* Credits sub-panel */}
                  {usageSubTab === 'credits' && creditBalance && (
                    <div className="credit-stats-row">
                      <div className="credit-stat-box">
                        <div className="stat-label">Total Credits</div>
                        <div className="stat-value">{plan?.totalTemplates ?? creditBalance.total}</div>
                      </div>
                      <div className="credit-stat-box">
                        <div className="stat-label">Used</div>
                        <div className="stat-value">{creditBalance.used}</div>
                      </div>
                      <div className="credit-stat-box highlight">
                        <div className="stat-label">Remaining</div>
                        <div className="stat-value">{(plan?.totalTemplates ?? creditBalance.total) - creditBalance.used}</div>
                      </div>
                    </div>
                  )}
                  {usageSubTab === 'credits' && !creditBalance && (
                    <p className="usage-empty">No credit data available.</p>
                  )}

                  {/* Screens sub-panel */}
                  {usageSubTab === 'screens' && (
                    <div className="credit-stats-row">
                      <div className="credit-stat-box">
                        <div className="stat-label">Total Allowed</div>
                        <div className="stat-value">{plan?.totalScreens ?? '—'}</div>
                      </div>
                      <div className="credit-stat-box highlight">
                        <div className="stat-label">Active</div>
                        <div className="stat-value">{usageScreens.length}</div>
                      </div>
                    </div>
                  )}

                  {/* Locations sub-panel */}
                  {usageSubTab === 'locations' && (
                    <div className="credit-stats-row">
                      <div className="credit-stat-box">
                        <div className="stat-label">Total Allowed</div>
                        <div className="stat-value">{plan?.totalLocations ?? planLimits?.locations ?? '—'}</div>
                      </div>
                      <div className="credit-stat-box highlight">
                        <div className="stat-label">Active Locations</div>
                        <div className="stat-value">{usageLocations.length}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Your Purchases Tab */}
              {activeTab === 'purchases' && (
                <div className="tab-table-wrap">
                  <table className="billing-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditEntitlements.length === 0 ? (
                        <tr><td colSpan={4} className="empty-row">No purchases found.</td></tr>
                      ) : creditEntitlements.map((p: any, i: number) => (
                        <tr key={p.id || i}>
                          <td className="cell-muted">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}</td>
                          <td>{p.stripEntitlementType || 'Template Credits'}</td>
                          <td>{formatBilling(p)}</td>
                          <td><span className={`tbl-badge ${getBadgeClass(p)}`}>{getStatusLabel(p)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Invoices Tab */}
              {activeTab === 'invoices' && (
                <div className="tab-table-wrap">
                  <table className="billing-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.length === 0 ? (
                        <tr><td colSpan={6} className="empty-row">No invoices found.</td></tr>
                      ) : invoices.map((p: any, i: number) => (
                        <tr key={p.id || i} id={`invoice-${p.id || i}`}>
                          <td className="cell-muted">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}</td>
                          <td className="cell-muted cell-mono">{(p.stripeInvoiceId || p.stripeChargeId) || '—'}</td>
                          <td>{getItemName(p)}</td>
                          <td>{formatBilling(p)}</td>
                          <td><span className={`tbl-badge ${getBadgeClass(p)}`}>{getDisplayStatus(p)}</span></td>
                          <td>
                            <button className="dl-btn" onClick={() => handleDownloadInvoice(p)} id={`dl-${p.id || i}`}>
                              <Download size={12} /> PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {showTrialModal && trialScreens.length > 0 && (
        <TrialExpiredUpgradeModal
          trialScreens={trialScreens}
          onClose={result => {
            setShowTrialModal(false);
            if (result?.success) {
              handleModalClose({ success: true });
              // Refresh trial state
              cmsApiV2.get('/sac/my/plan').then(({ data }) => {
                setTrialExpiredWithActiveScreens(data?.trialExpiredWithActiveScreens ?? false);
                setTrialScreens(data?.trialScreens ?? []);
              }).catch(() => {});
            }
          }}
        />
      )}
      {upgradeModal && <UpgradeModal mode={upgradeModal} onClose={handleModalClose} />}

      {showCancelSurvey && plan && (
        <CancelSurveyModal
          plan={plan}
          onClose={() => setShowCancelSurvey(false)}
          onConfirm={handleCancelConfirm}
        />
      )}

      <style>{`
        /* ── Layout ──────────────────────────────────────────────────────── */
        .billing-page { padding: 1.75rem 2rem; max-width: 960px; margin: 0 auto; }
        .page-loading { display: flex; align-items: center; gap: .75rem; padding: 3rem; color: var(--text-muted); }
        .billing-section { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
        .section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.1rem; gap: 1rem; flex-wrap: wrap; }
        .section-title { font-size: 1rem; font-weight: 700; margin: 0 0 .2rem; }
        .section-sub { font-size: .8rem; color: var(--text-muted); margin: 0; }

        /* ── Page Header ─────────────────────────────────────────────────── */
        .bp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .bp-title { font-size: 1.35rem; font-weight: 800; margin: 0 0 .2rem; }
        .bp-subtitle { font-size: .82rem; color: var(--text-muted); margin: 0; }

        /* ── Active Plan Bar ─────────────────────────────────────────────── */
        .active-plan-bar { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; background: linear-gradient(135deg, rgba(125,42,232,.07), rgba(99,102,241,.05)); border: 1px solid rgba(125,42,232,.18); border-radius: 12px; padding: .75rem 1.1rem; margin-bottom: 1.25rem; }
        .active-plan-badge { background: #7D2AE8; color: #fff; font-size: .65rem; font-weight: 700; padding: .18rem .55rem; border-radius: 999px; text-transform: uppercase; letter-spacing: .04em; }
        .active-plan-name { font-size: .9rem; font-weight: 700; }
        .active-plan-renews { font-size: .78rem; color: var(--text-muted); margin-left: auto; }

        /* ── Usage Overview ──────────────────────────────────────────────── */
        .overview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .9rem; }
        @media (max-width: 640px) { .overview-grid { grid-template-columns: 1fr; } }
        .overview-card { display: flex; align-items: flex-start; gap: .85rem; border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; }
        .ov-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ov-icon-purple { background: rgba(125,42,232,.1); color: #7D2AE8; }
        .ov-icon-blue { background: rgba(59,130,246,.1); color: #2563eb; }
        .ov-icon-green { background: rgba(22,163,74,.1); color: #16a34a; }
        .ov-body { min-width: 0; }
        .ov-value { font-size: 1.45rem; font-weight: 800; line-height: 1; margin-bottom: .2rem; }
        .ov-label { font-size: .8rem; font-weight: 600; margin-bottom: .15rem; }
        .ov-sub { font-size: .72rem; color: var(--text-muted); }

        /* ── Buy Resources ───────────────────────────────────────────────── */
        .resource-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem; }
        @media (max-width: 560px) { .resource-grid { grid-template-columns: 1fr; } }
        .resource-card { display: flex; align-items: center; gap: .9rem; border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; }
        .resource-icon { width: 36px; height: 36px; border-radius: 9px; background: var(--sidebar-bg); display: flex; align-items: center; justify-content: center; color: var(--text-muted); flex-shrink: 0; }
        .resource-body { flex: 1; min-width: 0; }
        .resource-name { font-size: .88rem; font-weight: 700; margin-bottom: .15rem; }
        .resource-desc { font-size: .75rem; color: var(--text-muted); }

        /* ── Template Credits ────────────────────────────────────────────── */
        .credit-balance-pill { display: inline-flex; align-items: center; gap: .4rem; background: var(--sidebar-bg); border: 1px solid var(--border); color: var(--text-muted); font-size: .76rem; font-weight: 600; padding: .3rem .8rem; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
        .credit-balance-pill strong { color: var(--text); }
        .credits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .9rem; }
        @media (max-width: 600px) { .credits-grid { grid-template-columns: 1fr; } }
        .credit-card { border: 1px solid var(--border); border-radius: 12px; padding: 1.1rem; text-align: center; position: relative; }
        .credit-badge { position: absolute; top: -.6rem; left: 50%; transform: translateX(-50%); background: #16a34a; color: #fff; font-size: .62rem; font-weight: 800; padding: .18rem .6rem; border-radius: 999px; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; box-shadow: 0 2px 8px rgba(22,163,74,.3); }
        .credit-icon { color: #7D2AE8; margin-bottom: .4rem; }
        .credit-name { font-size: .88rem; font-weight: 700; margin: 0 0 .15rem; }
        .credit-credits { font-size: .78rem; color: var(--text-muted); margin: 0 0 .3rem; }
        .credit-price { font-size: 1.05rem; font-weight: 800; margin: 0 0 .8rem; }
        .credit-currency { font-size: .72rem; color: var(--text-muted); font-weight: 500; }

        /* ── Buttons ─────────────────────────────────────────────────────── */
        .btn-primary { display: inline-flex; align-items: center; gap: .4rem; background: #111; color: #fff; border: 1px solid #111; padding: .55rem 1rem; border-radius: 10px; font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap; flex-shrink: 0; }
        .btn-primary:hover { background: #222; border-color: #222; }
        .btn-block { width: 100%; justify-content: center; }
        .btn-secondary { display: inline-flex; align-items: center; gap: .4rem; background: transparent; color: var(--text); border: 1px solid var(--border); padding: .55rem 1rem; border-radius: 10px; font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .2s; }
        .btn-secondary:hover { background: var(--sidebar-bg); }
        .btn-cancel-sub { background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: .5rem 1.1rem; border-radius: 10px; font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap; flex-shrink: 0; }
        .btn-cancel-sub:hover { background: rgba(239,68,68,.06); }

        /* ── Tabs ────────────────────────────────────────────────────────── */
        .tab-section { padding: 0; overflow: hidden; }
        .billing-tabs { display: flex; border-bottom: 1px solid var(--border); padding: 0 1.5rem; gap: .2rem; }
        .billing-tab { display: inline-flex; align-items: center; gap: .4rem; background: transparent; border: none; border-bottom: 2px solid transparent; padding: .8rem .95rem; font-size: .82rem; font-weight: 600; color: var(--text-muted); cursor: pointer; margin-bottom: -1px; transition: all .15s; }
        .billing-tab:hover { color: var(--text); }
        .billing-tab.tab-active { color: var(--text); border-bottom-color: #111; }
        .tab-body { padding: 1.25rem 1.5rem; }
        .usage-block { margin-bottom: 1.25rem; }
        .usage-block-title { display: flex; align-items: center; gap: .4rem; font-size: .7rem; font-weight: 700; color: var(--text-muted); margin: 0 0 .65rem; text-transform: uppercase; letter-spacing: .05em; }
        .credit-stats-row { display: flex; gap: .75rem; flex-wrap: wrap; }
        .credit-stat-box { flex: 1; min-width: 90px; border: 1px solid var(--border); border-radius: 10px; padding: .75rem .9rem; }
        .credit-stat-box.highlight { border-color: rgba(125,42,232,.25); background: rgba(125,42,232,.04); }
        .stat-label { font-size: .7rem; color: var(--text-muted); font-weight: 600; margin-bottom: .25rem; }
        .stat-value { font-size: 1.5rem; font-weight: 800; }

        /* ── Usage Sub-tabs (chips) ──────────────────────────────────────── */
        .usage-chips { display: flex; gap: .4rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .usage-chip { display: inline-flex; align-items: center; gap: .3rem; background: transparent; border: 1px solid var(--border); color: var(--text-muted); font-size: .76rem; font-weight: 600; padding: .3rem .75rem; border-radius: 999px; cursor: pointer; transition: all .15s; }
        .usage-chip:hover { border-color: var(--text-muted); color: var(--text); }
        .usage-chip.chip-active { background: #111; border-color: #111; color: #fff; }
        .usage-empty { font-size: .83rem; color: var(--text-muted); margin: .5rem 0 0; }

        /* ── Tables ──────────────────────────────────────────────────────── */
        .tab-table-wrap { overflow-x: auto; }
        .billing-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
        .billing-table th { text-align: left; padding: .5rem .75rem; color: var(--text-muted); font-size: .69rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--border); }
        .billing-table td { padding: .65rem .75rem; border-bottom: 1px solid var(--border); }
        .billing-table tr:last-child td { border-bottom: none; }
        .tbl-badge { font-size: .67rem; font-weight: 700; padding: .17rem .48rem; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; }
        .badge-active { background: rgba(22,163,74,.12); color: #16a34a; }
        .badge-completed { background: rgba(59,130,246,.1); color: #2563eb; }
        .badge-cancelled { background: rgba(239,68,68,.1); color: #ef4444; }
        .empty-row { text-align: center; color: var(--text-muted); padding: 2.5rem !important; font-size: .83rem; }
        .cell-muted { color: var(--text-muted); }
        .cell-mono { font-family: monospace; font-size: .74rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dl-btn { display: inline-flex; align-items: center; gap: .3rem; font-size: .73rem; font-weight: 600; background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: .2rem .5rem; border-radius: 6px; cursor: pointer; transition: all .15s; white-space: nowrap; }
        .dl-btn:hover { color: var(--text); border-color: var(--text-muted); }

        /* ── Misc ────────────────────────────────────────────────────────── */
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Cancel Survey Modal ─────────────────────────────────────────── */
        .cs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .cs-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 22px; padding: 2rem 1.75rem; width: 480px; max-width: 96vw; position: relative; box-shadow: 0 24px 64px rgba(0,0,0,.28); }
        .cs-close { position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: .25rem; border-radius: 6px; }
        .cs-close:hover { color: var(--text); background: var(--sidebar-bg); }
        .cs-icon { text-align: center; font-size: 2rem; margin-bottom: .75rem; }
        .cs-title { text-align: center; font-size: 1.15rem; font-weight: 800; margin: 0 0 .35rem; }
        .cs-subtitle { text-align: center; font-size: .83rem; color: var(--text-muted); margin: 0 0 1.25rem; }
        .cs-reasons { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
        .cs-reason-item { display: flex; align-items: center; gap: .75rem; padding: .65rem .85rem; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: all .15s; font-size: .85rem; }
        .cs-reason-item:hover { border-color: #7D2AE8; background: rgba(125,42,232,.04); }
        .cs-reason-item.selected { border-color: #7D2AE8; background: rgba(125,42,232,.07); }
        .cs-checkbox { width: 18px; height: 18px; border-radius: 4px; border: 2px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .cs-reason-item.selected .cs-checkbox { background: #7D2AE8; border-color: #7D2AE8; color: white; }
        .cs-comment { width: 100%; padding: .65rem .85rem; border: 1px solid var(--border); border-radius: 10px; background: var(--sidebar-bg); color: var(--text); font-size: .85rem; resize: vertical; margin-bottom: .5rem; font-family: inherit; box-sizing: border-box; }
        .cs-comment:focus { outline: none; border-color: #7D2AE8; }
        .cs-actions { display: flex; gap: .75rem; margin-top: 1rem; }
        .cs-btn-keep { flex: 1; background: var(--card-bg); border: 1px solid var(--border); color: var(--text); padding: .65rem; border-radius: 10px; font-size: .85rem; font-weight: 600; cursor: pointer; transition: all .15s; }
        .cs-btn-keep:hover { background: var(--sidebar-bg); }
        .cs-btn-next { flex: 1.5; background: #7D2AE8; color: #fff; border: none; padding: .65rem; border-radius: 10px; font-size: .85rem; font-weight: 700; cursor: pointer; transition: all .2s; }
        .cs-btn-next:hover:not(:disabled) { background: #6a21cb; }
        .cs-btn-next:disabled { opacity: .4; cursor: not-allowed; }
        .cs-btn-cancel-confirm { flex: 1.5; background: #ef4444; color: #fff; border: none; padding: .65rem; border-radius: 10px; font-size: .85rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: .4rem; transition: all .2s; }
        .cs-btn-cancel-confirm:hover:not(:disabled) { background: #dc2626; }
        .cs-btn-cancel-confirm:disabled { opacity: .55; cursor: not-allowed; }
        .cs-confirm-sub { text-align: center; font-size: .9rem; font-weight: 600; margin: .25rem 0 1rem; color: var(--text-muted); }
        .cs-lose-label { font-size: .82rem; color: var(--text-muted); margin: 0 0 .5rem; }
        .cs-lose-list { font-size: .85rem; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: .35rem; margin: 0 0 1rem; }
        .cs-warning-pill { background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.25); color: #d97706; padding: .6rem .85rem; border-radius: 10px; font-size: .8rem; text-align: center; }
      `}</style>
    </div>
  );
}
