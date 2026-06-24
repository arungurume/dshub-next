'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslateContext';
import { useDSStore } from '@/store/useDSStore';
import {
  Palette, Plus, ChevronDown, MapPin,
  FileVideo, FolderHeart, Calendar, Monitor, ChevronRight,
  Sparkles, Loader2, AlertCircle, Building2,
  Star, Coins, ExternalLink, RefreshCw,
  CreditCard, Lock, Eye, Search,
  Zap, ShieldCheck, X
} from 'lucide-react';
import { cmsApi, cmsApiV2, umsApi, setCookie } from '@/lib/api';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface CanvaDesign {
  id: string;
  title: string;
  thumbnailUrl: string;
  updatedAt?: string;
}

interface TemplateImage {
  id?: number;
  url?: string;
  imageSource?: string;
}

interface CanvaCategoryDto {
  id: number;
  name: string;
  orderNo?: number;
}

interface DsTemplate {
  id: number;
  title: string;
  description?: string;
  creditCost?: number;
  plan?: string;
  canvaPublicLink?: string;
  canvaSmartEmbedLink?: string;
  viewUrl?: string;
  editUrl?: string;
  designUrl?: string;
  templateUrl?: string;
  status?: string;
  tags?: string;
  width?: number;
  height?: number;
  images?: TemplateImage[];
  categories?: CanvaCategoryDto[];
}

const getThumb = (tpl: DsTemplate): string | null => {
  if (tpl.images && tpl.images.length > 0) {
    const url = tpl.images[0].url;
    if (url) return url;
  }
  return tpl.viewUrl || tpl.designUrl || tpl.templateUrl || null;
};

interface Purchase {
  id: number;
  dsCanvaTemplateId: number;
  canvaDesignId?: string;
  creditCost?: number;
  purchaseDate?: string;
  templateType?: string;
}

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  amount: number;
  currency: string;
  badge?: string;
}

type CategoryTab = 'Trending' | 'Restaurant' | 'Cafe' | 'Fast Food' | 'Pizza' | 'Seasonal' | 'Recently Purchased';

// ─── Stripe helpers ────────────────────────────────────────────────────────────
const CREDIT_PACKS: CreditPack[] = [
  { id: 'credits_10',  name: 'Starter Pack', credits: 10,  amount: 999,  currency: 'USD' },
  { id: 'credits_50',  name: 'Value Pack',   credits: 50,  amount: 3999, currency: 'USD', badge: 'Popular' },
  { id: 'credits_150', name: 'Pro Pack',     credits: 150, amount: 9999, currency: 'USD', badge: 'Best Value' },
];

function getStripePromise(locale: string) {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '', { locale: locale as any });
}

// ─── Stripe card form (reused from billing page) ──────────────────────────────
function DashCardPaymentForm({ clientSecret, amount, onSuccess, onCancel }: {
  clientSecret: string; amount: number; onSuccess: () => void; onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardErrors, setCardErrors] = useState({ number: '', expiry: '', cvc: '' });

  const elStyle = {
    style: {
      base: { color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px', '::placeholder': { color: '#64748b' } },
      invalid: { color: '#ef4444' },
    },
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) { setProcessing(false); return; }
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardNumber } });
      if (error) {
        toast.error(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        toast.success('Payment successful! Credits activated.');
        onSuccess();
      } else if (paymentIntent?.status === 'requires_action') {
        toast.info('Additional verification required…');
      }
    } catch { toast.error('Payment error. Please try again.'); }
    finally { setProcessing(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="dbc-card-form">
      <div className="dbc-field">
        <label className="dbc-label">Card Number</label>
        <div className="dbc-stripe-el"><CardNumberElement options={elStyle} onChange={e => setCardErrors(p => ({ ...p, number: e.error?.message || '' }))} /></div>
        {cardErrors.number && <p className="dbc-field-err">{cardErrors.number}</p>}
      </div>
      <div className="dbc-row-2">
        <div className="dbc-field">
          <label className="dbc-label">Expiry</label>
          <div className="dbc-stripe-el"><CardExpiryElement options={elStyle} onChange={e => setCardErrors(p => ({ ...p, expiry: e.error?.message || '' }))} /></div>
          {cardErrors.expiry && <p className="dbc-field-err">{cardErrors.expiry}</p>}
        </div>
        <div className="dbc-field">
          <label className="dbc-label">CVC</label>
          <div className="dbc-stripe-el"><CardCvcElement options={elStyle} onChange={e => setCardErrors(p => ({ ...p, cvc: e.error?.message || '' }))} /></div>
          {cardErrors.cvc && <p className="dbc-field-err">{cardErrors.cvc}</p>}
        </div>
      </div>
      <div className="dbc-form-footer">
        <div className="dbc-secure"><ShieldCheck size={13} /> Secured by Stripe</div>
        <div className="dbc-form-actions">
          <button type="button" className="dbc-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="dbc-btn-primary" disabled={processing}>
            {processing ? <RefreshCw size={13} className="db-spin" /> : <CreditCard size={13} />}
            Pay ${(amount / 100).toFixed(2)}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Credit Buy Modal (pack selector + payment form) ─────────────────────────
function CreditBuyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ clientSecret: string; amount: number } | null>(null);
  const [stripeInst, setStripeInst] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const locale = typeof window !== 'undefined' ? (localStorage.getItem('lang') || 'en') : 'en';
    setStripeInst(getStripePromise(locale));
  }, []);

  async function handleBuy(pack: CreditPack) {
    setSelectedPack(pack);
    setLoading(true);
    try {
      const { data } = await cmsApi.post('/sac/subscriptions/pay', {
        packId: pack.id, amount: pack.amount, currency: pack.currency.toLowerCase(),
      });
      setPaymentInfo({ clientSecret: data.clientSecret, amount: pack.amount });
    } catch {
      toast.error('Failed to initiate payment');
      setSelectedPack(null);
    } finally { setLoading(false); }
  }

  function handleSuccess() {
    setPaymentInfo(null);
    setSelectedPack(null);
    onSuccess();
    onClose();
  }

  return (
    <div className="dbc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dbc-modal">
        {/* Header */}
        <div className="dbc-modal-hd">
          <div className="dbc-modal-hd-left">
            <div className="dbc-modal-icon"><Coins size={18} /></div>
            <div>
              <h3 className="dbc-modal-title">Buy Template Credits</h3>
              <p className="dbc-modal-sub">One-time purchase · No subscription needed</p>
            </div>
          </div>
          <button className="dbc-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="dbc-modal-body">
          {paymentInfo && stripeInst ? (
            <>
              <div className="dbc-pack-summary">
                <Zap size={16} />
                <span><strong>{selectedPack?.credits} Credits</strong> — ${((selectedPack?.amount || 0) / 100).toFixed(2)} {selectedPack?.currency}</span>
              </div>
              <Elements stripe={stripeInst} options={{ clientSecret: paymentInfo.clientSecret }}>
                <DashCardPaymentForm
                  clientSecret={paymentInfo.clientSecret}
                  amount={paymentInfo.amount}
                  onSuccess={handleSuccess}
                  onCancel={() => { setPaymentInfo(null); setSelectedPack(null); }}
                />
              </Elements>
            </>
          ) : (
            <>
              <p className="dbc-pack-prompt">Select a credit pack to get started:</p>
              <div className="dbc-packs-grid">
                {CREDIT_PACKS.map(pack => (
                  <button
                    key={pack.id}
                    className={`dbc-pack-card ${selectedPack?.id === pack.id && loading ? 'dbc-pack-loading' : ''}`}
                    onClick={() => handleBuy(pack)}
                    disabled={loading}
                    id={`dash-buy-${pack.id}`}
                  >
                    {pack.badge && <div className="dbc-pack-badge">{pack.badge}</div>}
                    <div className="dbc-pack-icon"><Zap size={20} /></div>
                    <div className="dbc-pack-name">{pack.name}</div>
                    <div className="dbc-pack-credits">{pack.credits} Credits</div>
                    <div className="dbc-pack-price">${(pack.amount / 100).toFixed(2)} <span className="dbc-pack-cur">{pack.currency}</span></div>
                    {selectedPack?.id === pack.id && loading
                      ? <div className="dbc-pack-spinner"><RefreshCw size={14} className="db-spin" /> Processing…</div>
                      : <div className="dbc-pack-cta">Buy Now</div>
                    }
                  </button>
                ))}
              </div>
              <p className="dbc-pack-note"><ShieldCheck size={12} /> Payments secured by Stripe · Credits never expire</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardMainPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const currentUser = useDSStore((state) => state.currentUser);
  const currentLocation = useDSStore((state) => state.currentLocation);
  const setCurrentLocation = useDSStore((state) => state.setCurrentLocation);
  
  // Location UI
  const [switching, setSwitching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState({ screensOnline: 0, scheduledToday: 0, playlists: 0, files: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // State
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('Trending');
  const [searchQuery, setSearchQuery] = useState('');

  // Templates
  const [gallery, setGallery] = useState<DsTemplate[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  // Purchased Templates
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasedTemplates, setPurchasedTemplates] = useState<Map<number, DsTemplate>>(new Map());
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  // Credit balance & Buying State
  const [credits, setCredits] = useState<{ total: number; used: number } | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [purchasedIds, setPurchasedIds] = useState<Set<number>>(new Set());

  // Subscription info
  const [subPlan, setSubPlan] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);

  // Canva tab State (for background connectivity checks)
  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaDesigns, setCanvaDesigns] = useState<CanvaDesign[]>([]);

  // Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<DsTemplate | null>(null);

  const locations = currentUser?.organization?.locations || [];

  // Load everything on mount
  useEffect(() => {
    loadStats();
    loadGallery();
    loadPurchases();
    loadCredits();
    checkCanvaStatus();
    loadSubscription();
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const [screensRes, playlistsRes, filesRes, schedulesRes] = await Promise.all([
        cmsApi.get('/sc/screen', { params: { page: 0, size: 500, includeLiveStatus: true } }).catch(() => ({ data: {} })),
        cmsApiV2.get('/pc/playlist', { params: { page: 0, size: 1 } }).catch(() => ({ data: {} })),
        cmsApi.get('/cc/content', { params: { page: 0, size: 1 } }).catch(() => ({ data: {} })),
        cmsApiV2.get('/scc/schedule', { params: { page: 0, size: 500 } }).catch(() => ({ data: {} })),
      ]);
      const screens = screensRes.data?.content || [];
      const onlineCount = screens.filter((s: any) => s.liveStatus === true).length;
      const schedules = schedulesRes.data?.content || [];
      const today = new Date();
      const activeSchedulesCount = schedules.filter((s: any) => {
        if (!s.startDate || !s.endDate) return false;
        return today >= new Date(s.startDate) && today <= new Date(s.endDate);
      }).length;
      setStats({
        screensOnline: onlineCount,
        scheduledToday: activeSchedulesCount || schedules.length,
        playlists: playlistsRes.data?.totalElements || 0,
        files: filesRes.data?.totalElements || 0,
      });
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadGallery = async () => {
    setGalleryLoading(true);
    try {
      const res = await cmsApi.get('/ctc/templates', { params: { page: 0, size: 100 } });
      const items: DsTemplate[] = res.data?.content || res.data || [];
      setGallery(items);
    } catch {
      setGallery([]);
    } finally {
      setGalleryLoading(false);
    }
  };

  const loadPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const res = await cmsApi.get('/ctpc/purchases', { params: { page: 0, size: 100 } });
      const items: Purchase[] = res.data?.content || res.data || [];
      setPurchases(items);
      const ids = new Set(items.map((p) => p.dsCanvaTemplateId));
      setPurchasedIds(ids);

      if (ids.size > 0) {
        try {
          const galleryRes = await cmsApi.get('/ctc/templates', { params: { page: 0, size: 100 } });
          const allTemplates: DsTemplate[] = galleryRes.data?.content || galleryRes.data || [];
          const map = new Map<number, DsTemplate>();
          allTemplates.forEach((tpl) => { if (ids.has(tpl.id)) map.set(tpl.id, tpl); });
          setPurchasedTemplates(map);
        } catch { /* silently fail */ }
      }
    } catch {
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  };

  const loadCredits = async () => {
    try {
      const res = await cmsApiV2.get('/sac/my/template-credit-summary');
      if (res.data) {
        setCredits({ total: res.data.totalCredits ?? 0, used: res.data.usedCredits ?? 0 });
      }
    } catch {
      setCredits(null);
    }
  };

  const loadSubscription = async () => {
    setSubLoading(true);
    try {
      const { data } = await cmsApi.get('/sac/my/subscriptions');
      setSubPlan(Array.isArray(data) ? data[0] : data);
    } catch {
      setSubPlan(null);
    } finally {
      setSubLoading(false);
    }
  };

  const checkCanvaStatus = async () => {
    try {
      const profileRes = await cmsApi.get('/canva/profile');
      if (profileRes.status === 200 && profileRes.data) {
        setCanvaConnected(true);
        const designsRes = await cmsApi.get('/canva/designs', { params: { size: 12 } });
        setCanvaDesigns(designsRes.data?.designs || designsRes.data?.items || designsRes.data?.content || []);
      } else {
        setCanvaConnected(false);
      }
    } catch {
      setCanvaConnected(false);
    }
  };

  const buyTemplate = async (template: DsTemplate) => {
    if (buyingId) return;
    const cost = template.creditCost ?? 0;
    const available = credits ? credits.total - credits.used : 0;
    if (cost > 0 && available < cost) {
      toast.error(`Not enough credits. You have ${available} credits, this template costs ${cost}.`);
      return;
    }
    setBuyingId(template.id);
    try {
      await cmsApi.post('/ctpc/purchases', {
        dsCanvaTemplateId: template.id,
        canvaDesignId: (template as any).canvaDesignId ?? null,
        creditCost: template.creditCost ?? 0,
        templateType: 'DIGITAL',
      });
      toast.success(`"${template.title}" unlocked successfully!`);
      setPurchasedIds((prev) => new Set([...prev, template.id]));
      setPurchasedTemplates((prev) => new Map([...prev, [template.id, template]]));
      setPurchases((prev) => [...prev, {
        id: Date.now(), dsCanvaTemplateId: template.id,
        creditCost: template.creditCost, purchaseDate: new Date().toISOString(),
      }]);
      if (credits) setCredits({ ...credits, used: credits.used + cost });
      
      if (previewTemplate?.id === template.id) {
        setPreviewTemplate({ ...template });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to purchase template';
      toast.error(msg);
    } finally {
      setBuyingId(null);
    }
  };

  const handleLocationChange = async (loc: any) => {
    setIsDropdownOpen(false);
    if (!loc || loc.id === currentLocation?.id) return;
    setSwitching(true);
    const toastId = toast.loading(`Switching to ${loc.name}...`);
    try {
      const response = await umsApi.get(`/auth/change-location/${loc.id}/refresh-token`);
      const updatedUser = response.data;
      setCookie('token', updatedUser.token);
      localStorage.setItem('token', updatedUser.token);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      localStorage.setItem('role', updatedUser.roles[0].name);
      setCurrentLocation(loc);
      toast.success(`Location switched to ${loc.name}`, { id: toastId });
      window.location.reload();
    } catch (err: any) {
      toast.error('Failed to switch location', { id: toastId });
      setSwitching(false);
    }
  };

  const remainingCredits = credits ? credits.total - credits.used : 0;
  const estimatedTemplates = Math.floor(remainingCredits / 10);
  const orgName = currentUser?.organization?.name || 'My Organization';
  const isNewUser = !statsLoading && stats.screensOnline === 0 && stats.scheduledToday === 0 && stats.playlists === 0;

  const getFilteredTemplates = (catName: CategoryTab): DsTemplate[] => {
    if (!gallery || gallery.length === 0) return [];

    if (catName === 'Recently Purchased') {
      return gallery.filter(t => purchasedIds.has(t.id));
    }

    let filtered = [...gallery];

    if (catName !== 'Trending') {
      const searchTerms: Record<string, string[]> = {
        'Restaurant': ['restaurant', 'food', 'menu', 'dining', 'burger', 'kitchen', 'recipe', 'cook'],
        'Cafe': ['cafe', 'coffee', 'bakery', 'tea', 'drink', 'beverage', 'cup', 'morning', 'latte', 'espresso'],
        'Fast Food': ['fast food', 'burger', 'fries', 'combo', 'meal', 'takeout', 'drive', 'qsr', 'quick'],
        'Pizza': ['pizza', 'pizzeria', 'slice', 'pepperoni', 'margherita', 'topping', 'crust'],
        'Seasonal': ['seasonal', 'winter', 'summer', 'spring', 'autumn', 'christmas', 'holiday', 'halloween', 'easter', 'festive', 'october', 'july', 'party', 'valentines', 'thanksgiving']
      };

      const terms = searchTerms[catName] || [];
      filtered = gallery.filter(t => {
        if (t.categories && t.categories.length > 0) {
          if (t.categories.some(c => c.name?.toLowerCase().includes(catName.toLowerCase()))) {
            return true;
          }
        }
        const text = `${t.title || ''} ${t.description || ''} ${t.tags || ''}`.toLowerCase();
        return terms.some(term => text.includes(term));
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.tags || '').toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const getRecommendedTemplates = (): DsTemplate[] => {
    if (!gallery || gallery.length === 0) return [];
    return gallery.filter(t => !purchasedIds.has(t.id)).slice(0, 8);
  };

  const activeTemplates = getFilteredTemplates(categoryTab);
  const recommendedTemplates = getRecommendedTemplates();

  const handleUseTemplate = (tpl: DsTemplate) => {
    const link = tpl.canvaSmartEmbedLink || tpl.canvaPublicLink || '#';
    if (link !== '#') {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Canva Link not available for this template');
    }
  };

  return (
    <div className="db-page">

      {/* ─── MAIN DESKTOP GRID ─── */}
      <div className="db-main-container">

        {/* ─── LEFT PANEL ─── */}
        <div className="db-content-left">

          {/* 1. HERO SECTION */}
          <div className="db-compact-hero">
            <div className="db-hero-glass-shine" />
            <div className="db-hero-inner">
              <div className="db-hero-left">
                <h1 className="db-hero-title">Create stunning digital signage in minutes.</h1>
                <p className="db-hero-pitch">
                  Browse premium digital signage templates for restaurant menus, cafe boards, retail promotions, schools, and seasonal campaigns.
                </p>
                <div className="db-hero-credit-msg">
                  <Coins size={14} />
                  <span>You currently have <strong>{remainingCredits}</strong> Template Credits available.</span>
                </div>
                <div className="db-hero-ctas">
                  <button onClick={() => router.push('/templates')} className="db-cta-primary">
                    <Sparkles size={14} />
                    <span>Browse Templates</span>
                  </button>
                  <button onClick={() => setShowCreditModal(true)} className="db-cta-buy-credits">
                    <Coins size={14} />
                    <span>Buy Credits</span>
                  </button>
                  <button onClick={() => router.push('/playlists')} className="db-cta-secondary">
                    <FolderHeart size={14} />
                    <span>Create Playlist</span>
                  </button>
                  <button onClick={() => router.push('/screens/new')} className="db-cta-screen">
                    <Monitor size={14} />
                    <span>Add Screen</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* QUICK STATS BAR */}
          <div className="db-stats-bar">
            <div className="db-stat-chip" onClick={() => router.push('/screens')}>
              <div className="db-stat-chip-icon green"><Monitor size={13} /></div>
              <div className="db-stat-chip-info">
                <span className="db-stat-chip-val">{statsLoading ? '–' : stats.screensOnline}</span>
                <span className="db-stat-chip-lbl">Screens Online</span>
              </div>
            </div>
            <div className="db-stat-chip" onClick={() => router.push('/schedules')}>
              <div className="db-stat-chip-icon purple"><Calendar size={13} /></div>
              <div className="db-stat-chip-info">
                <span className="db-stat-chip-val">{statsLoading ? '–' : stats.scheduledToday}</span>
                <span className="db-stat-chip-lbl">Active Schedules</span>
              </div>
            </div>
            <div className="db-stat-chip" onClick={() => router.push('/playlists')}>
              <div className="db-stat-chip-icon pink"><FolderHeart size={13} /></div>
              <div className="db-stat-chip-info">
                <span className="db-stat-chip-val">{statsLoading ? '–' : stats.playlists}</span>
                <span className="db-stat-chip-lbl">Playlists</span>
              </div>
            </div>
            <div className="db-stat-chip" onClick={() => router.push('/content')}>
              <div className="db-stat-chip-icon indigo"><FileVideo size={13} /></div>
              <div className="db-stat-chip-info">
                <span className="db-stat-chip-val">{statsLoading ? '–' : stats.files}</span>
                <span className="db-stat-chip-lbl">Files Uploaded</span>
              </div>
            </div>
          </div>

          {/* NEW USER: GETTING STARTED */}
          {isNewUser && (
            <div className="db-getting-started">
              <h3 className="db-getting-started-title">Getting Started</h3>
              <p className="db-getting-started-sub">Set up your digital signage in four simple steps</p>
              <div className="db-steps-grid">
                <div className="db-step-card" onClick={() => router.push('/content')}>
                  <div className="db-step-num">1</div>
                  <div className="db-step-info">
                    <span className="db-step-name">Upload Content</span>
                    <span className="db-step-desc">Add images, videos, and media files</span>
                  </div>
                  <ChevronRight size={14} className="db-step-arrow" />
                </div>
                <div className="db-step-card" onClick={() => router.push('/playlists')}>
                  <div className="db-step-num">2</div>
                  <div className="db-step-info">
                    <span className="db-step-name">Create Playlist</span>
                    <span className="db-step-desc">Arrange content into display loops</span>
                  </div>
                  <ChevronRight size={14} className="db-step-arrow" />
                </div>
                <div className="db-step-card" onClick={() => router.push('/screens')}>
                  <div className="db-step-num">3</div>
                  <div className="db-step-info">
                    <span className="db-step-name">Add Screen</span>
                    <span className="db-step-desc">Register and pair your display hardware</span>
                  </div>
                  <ChevronRight size={14} className="db-step-arrow" />
                </div>
                <div className="db-step-card" onClick={() => router.push('/schedules')}>
                  <div className="db-step-num">4</div>
                  <div className="db-step-info">
                    <span className="db-step-name">Schedule Content</span>
                    <span className="db-step-desc">Set display hours and content rotation</span>
                  </div>
                  <ChevronRight size={14} className="db-step-arrow" />
                </div>
              </div>
              <div className="db-getting-started-alt">
                <span>Or start with a premium template</span>
                <button onClick={() => router.push('/templates')} className="db-alt-browse-btn">
                  <Sparkles size={13} />
                  <span>Browse Templates</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. TEMPLATE MARKETPLACE SECTION */}
          <div className="db-discovery-panel">
            <div className="db-discovery-header">
              <div>
                <h2 className="db-discovery-title">Template Marketplace</h2>
                <p className="db-discovery-sub">Browse, purchase, customize, and publish premium templates directly to your screens.</p>
              </div>

              <div className="db-search-bar-wrapper">
                <Search size={14} className="db-search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="db-search-input-premium"
                />
              </div>
            </div>

            <div className="db-category-pills">
              {([
                'Trending',
                'Restaurant',
                'Cafe',
                'Fast Food',
                'Pizza',
                'Seasonal',
                'Recently Purchased'
              ] as CategoryTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCategoryTab(tab)}
                  className={`db-pill-btn ${categoryTab === tab ? 'active' : ''}`}
                >
                  <span>{tab}</span>
                </button>
              ))}
            </div>

            {galleryLoading ? (
              <div className="db-grid-loading">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="db-skeleton-large-card" />
                ))}
              </div>
            ) : activeTemplates.length === 0 ? (
              <div className="db-no-results-card">
                <AlertCircle size={22} className="db-muted-icon" />
                <p className="db-no-results-text">No templates match the active criteria.</p>
              </div>
            ) : (
              <div className="db-large-templates-grid">
                {activeTemplates.map((tpl) => {
                  const owned = purchasedIds.has(tpl.id);
                  const cost = tpl.creditCost ?? 0;
                  const isVertical = tpl.width && tpl.height ? tpl.height > tpl.width : false;
                  const isSquare = tpl.width && tpl.height ? tpl.height === tpl.width : false;
                  const orientationLabel = isVertical ? 'Portrait' : (isSquare ? 'Square' : 'Landscape');

                  return (
                    <div key={tpl.id} className="db-large-template-card" onClick={() => setPreviewTemplate(tpl)}>
                      <div className="db-card-preview-container">
                        {getThumb(tpl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getThumb(tpl)!} alt={tpl.title} className="db-card-preview-image" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="db-card-preview-placeholder"><Palette size={32} opacity={0.15} /></div>
                        )}

                        <div className="db-card-top-left-badges">
                          <span className="db-badge-orientation">{orientationLabel}</span>
                        </div>

                        <div className="db-card-top-right-badges">
                          <span className={`db-badge-credits ${owned ? 'owned' : (cost === 0 ? 'free' : 'cost')}`}>
                            {owned ? 'Owned' : (cost === 0 ? 'Free' : `${cost} Credits`)}
                          </span>
                        </div>
                      </div>

                      <div className="db-card-details-row">
                        <div className="db-card-info-texts">
                          <h4 className="db-card-title-text">{tpl.title || 'Untitled Design'}</h4>
                        </div>
                        <div className="db-card-actions-wrapper" onClick={(e) => e.stopPropagation()}>
                          <button className="db-btn-card-preview" onClick={() => setPreviewTemplate(tpl)}>
                            <Eye size={12} />
                            <span>Preview</span>
                          </button>
                          {owned ? (
                            <button className="db-btn-card-action use" onClick={() => handleUseTemplate(tpl)}>
                              <ExternalLink size={12} />
                              <span>Use</span>
                            </button>
                          ) : (
                            <button className="db-btn-card-action buy" onClick={() => buyTemplate(tpl)} disabled={buyingId !== null}>
                              {buyingId === tpl.id ? <Loader2 size={12} className="db-spin" /> : <Lock size={12} />}
                              <span>Unlock Template</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. RECOMMENDED TEMPLATES */}
          <div className="db-discovery-panel">
            <h3 className="db-discovery-title-small">Recommended for You</h3>

            {galleryLoading ? (
              <div className="db-slider-loading-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="db-skeleton-card" />
                ))}
              </div>
            ) : recommendedTemplates.length === 0 ? (
              <p className="db-empty-discovery">All templates unlocked!</p>
            ) : (
              <div className="db-horizontal-recommended-row">
                {recommendedTemplates.map((tpl) => {
                  const cost = tpl.creditCost ?? 0;
                  const isVertical = tpl.width && tpl.height ? tpl.height > tpl.width : false;
                  const isSquare = tpl.width && tpl.height ? tpl.height === tpl.width : false;
                  const orientationLabel = isVertical ? 'Portrait' : (isSquare ? 'Square' : 'Landscape');

                  return (
                    <div key={tpl.id} className="db-recommended-card-item" onClick={() => setPreviewTemplate(tpl)}>
                      <div className="db-recommended-thumb-area">
                        {getThumb(tpl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getThumb(tpl)!} alt={tpl.title} className="db-recommended-img" />
                        ) : (
                          <div className="db-slider-placeholder"><Sparkles size={20} opacity={0.2} /></div>
                        )}
                        <span className="db-recommended-orient-lbl">{orientationLabel}</span>
                        <span className="db-recommended-cost-lbl">{cost === 0 ? 'Free' : `${cost} cr`}</span>
                      </div>
                      <div className="db-recommended-info">
                        <p className="db-recommended-title">{tpl.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. CMS OPERATIONS (at the bottom for existing users) */}
          {!isNewUser && (
            <div className="db-operations-panel">
              <h3 className="db-operations-title">Signage Operations</h3>
              <div className="db-operations-grid">
                <div className="db-ops-card" onClick={() => router.push('/content')}>
                  <div className="db-ops-icon purple"><FileVideo size={16} /></div>
                  <div className="db-ops-texts">
                    <span className="db-ops-name">Upload Content</span>
                    <span className="db-ops-desc">Upload files & media</span>
                  </div>
                  <ChevronRight size={14} className="db-ops-arrow" />
                </div>
                <div className="db-ops-card" onClick={() => router.push('/playlists')}>
                  <div className="db-ops-icon pink"><FolderHeart size={16} /></div>
                  <div className="db-ops-texts">
                    <span className="db-ops-name">Create Playlist</span>
                    <span className="db-ops-desc">Design loops & order</span>
                  </div>
                  <ChevronRight size={14} className="db-ops-arrow" />
                </div>
                <div className="db-ops-card" onClick={() => router.push('/schedules')}>
                  <div className="db-ops-icon indigo"><Calendar size={16} /></div>
                  <div className="db-ops-texts">
                    <span className="db-ops-name">Schedule Content</span>
                    <span className="db-ops-desc">Configure display hours</span>
                  </div>
                  <ChevronRight size={14} className="db-ops-arrow" />
                </div>
                <div className="db-ops-card" onClick={() => router.push('/screens')}>
                  <div className="db-ops-icon green"><Monitor size={16} /></div>
                  <div className="db-ops-texts">
                    <span className="db-ops-name">Manage Screens</span>
                    <span className="db-ops-desc">Monitor hardware states</span>
                  </div>
                  <ChevronRight size={14} className="db-ops-arrow" />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ─── RIGHT SIDEBAR ─── */}
        <div className="db-content-right-sidebar">

          {/* CREDITS WIDGET */}
          <div className="db-sidebar-widget db-credits-widget">
            <h4 className="db-widget-title">Template Credits</h4>
            <div className="db-sidebar-credits-box">
              <span className="db-credits-big-number">{remainingCredits}</span>
              <span className="db-credits-big-label">Available for premium template purchases</span>

              <div className="db-credits-progress-horizontal-bg">
                <div className="db-credits-progress-horizontal-fill" style={{ width: `${Math.min(100, ((credits?.used ?? 0) / (credits?.total || 1)) * 100)}%` }} />
              </div>

              <div className="db-credits-metrics-row">
                <span>Used: <strong>{credits?.used ?? 0}</strong></span>
                <span>Total: <strong>{credits?.total || 0}</strong></span>
              </div>

              {remainingCredits > 0 && (
                <p className="db-credits-estimate">Enough for approximately {Math.max(1, estimatedTemplates)}–{Math.max(2, estimatedTemplates + Math.ceil(estimatedTemplates * 0.5))} premium templates</p>
              )}

              <button onClick={() => setShowCreditModal(true)} className="db-widget-buy-btn" id="dash-buy-credits-btn">
                <Coins size={13} />
                <span>Buy More Credits</span>
              </button>
            </div>
          </div>

          {/* QUICK STATS */}
          <div className="db-sidebar-widget">
            <h4 className="db-widget-title">Quick Stats</h4>
            <div className="db-widget-stats-rows">
              <div className="db-widget-stat-row" onClick={() => router.push('/screens')}>
                <div className="db-widget-stat-icon green"><Monitor size={12} /></div>
                <span className="db-widget-stat-label">Screens Online</span>
                {statsLoading ? <div className="db-widget-spinner" /> : <span className="db-widget-stat-val green-text">{stats.screensOnline}</span>}
              </div>
              <div className="db-widget-stat-row" onClick={() => router.push('/schedules')}>
                <div className="db-widget-stat-icon purple"><Calendar size={12} /></div>
                <span className="db-widget-stat-label">Active Schedules</span>
                {statsLoading ? <div className="db-widget-spinner" /> : <span className="db-widget-stat-val purple-text">{stats.scheduledToday}</span>}
              </div>
              <div className="db-widget-stat-row" onClick={() => router.push('/playlists')}>
                <div className="db-widget-stat-icon orange"><FolderHeart size={12} /></div>
                <span className="db-widget-stat-label">Playlists</span>
                {statsLoading ? <div className="db-widget-spinner" /> : <span className="db-widget-stat-val">{stats.playlists}</span>}
              </div>
              <div className="db-widget-stat-row" onClick={() => router.push('/content')}>
                <div className="db-widget-stat-icon indigo"><FileVideo size={12} /></div>
                <span className="db-widget-stat-label">Files Uploaded</span>
                {statsLoading ? <div className="db-widget-spinner" /> : <span className="db-widget-stat-val">{stats.files}</span>}
              </div>
            </div>
          </div>

          {/* MINIMAL SUBSCRIPTION */}
          {!subLoading && subPlan && (
            <div className="db-sidebar-widget-sub">
              <div className="db-sub-plan-badge-compact">
                <Star size={11} />
                <span>{subPlan.planType || 'Free'} Plan</span>
              </div>
              <span className="db-sub-plan-licenses-compact">{subPlan.usedScreens} / {subPlan.totalScreens} screen licenses used</span>
            </div>
          )}

          {/* COMPACT ORG INFO & LOCATION SELECTOR (moved to bottom) */}
          <div className="db-sidebar-widget-compact">
            <div className="db-widget-org-compact-row">
              <Building2 size={12} className="db-widget-icon-dim" />
              <span className="db-widget-org-name-text">{orgName}</span>
            </div>
            <div className="db-widget-loc-picker-container">
              <button
                disabled={switching}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="db-widget-loc-trigger"
              >
                <MapPin size={12} />
                <span className="db-widget-loc-name-txt">{currentLocation?.name || 'Switch Location'}</span>
                <ChevronDown size={12} className={`db-widget-loc-chevron ${isDropdownOpen ? 'open' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  <div className="db-widget-loc-overlay" onClick={() => setIsDropdownOpen(false)} />
                  <div className="db-widget-loc-popover">
                    <p className="db-popover-title">Locations ({locations.length})</p>
                    <div className="db-popover-scrollable">
                      {locations.map((loc: any) => (
                        <button
                          key={loc.id}
                          onClick={() => handleLocationChange(loc)}
                          className={`db-popover-item ${currentLocation?.id === loc.id ? 'active' : ''}`}
                        >
                          <MapPin size={12} />
                          <span>{loc.name || 'Unnamed'}</span>
                        </button>
                      ))}
                    </div>
                    <div className="db-popover-footer">
                      <button onClick={() => { setIsDropdownOpen(false); router.push('/locations/0'); }} className="db-popover-add-btn">
                        <Plus size={12} />
                        <span>Add Location</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ─── TEMPLATE PREVIEW MODAL ─── */}
      {previewTemplate && (
        <div className="db-preview-modal-overlay" onClick={() => setPreviewTemplate(null)}>
          <div className="db-preview-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="db-preview-modal-header">
              <h3 className="db-preview-modal-title">{previewTemplate.title || 'Template Details'}</h3>
              <button className="db-preview-close-btn" onClick={() => setPreviewTemplate(null)}>×</button>
            </div>
            <div className="db-preview-modal-body">
              <div className="db-preview-layout-grid">
                
                {/* Fixed preview container with contain ratio */}
                <div className="db-preview-image-section">
                  {getThumb(previewTemplate) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getThumb(previewTemplate)!} alt={previewTemplate.title} className="db-preview-large-img" />
                  ) : (
                    <div className="db-preview-placeholder-bg"><Sparkles size={48} opacity={0.15} /></div>
                  )}
                </div>

                <div className="db-preview-info-section">
                  <div className="db-preview-tags-row">
                    <span className="db-preview-badge">Digital Template</span>
                    <span className="db-preview-badge dim">{previewTemplate.width || 1920} × {previewTemplate.height || 1080}px</span>
                    {purchasedIds.has(previewTemplate.id) && (
                      <span className="db-preview-badge green">Unlocked</span>
                    )}
                  </div>

                  <p className="db-preview-description">
                    {previewTemplate.description || 'No template description available. Enhance your signage layouts using premium Canva integration directly on DSHub screens.'}
                  </p>

                  <div className="db-preview-cost-area">
                    <Coins size={16} className="gold-text" />
                    <span className="db-preview-cost-val">Cost: <strong>{previewTemplate.creditCost ?? 0} Credits</strong></span>
                  </div>

                  <div className="db-preview-modal-actions">
                    {purchasedIds.has(previewTemplate.id) ? (
                      <button className="db-preview-action-btn primary" onClick={() => handleUseTemplate(previewTemplate)}>
                        <ExternalLink size={14} />
                        <span>Open in Canva</span>
                      </button>
                    ) : (
                      <button
                        className="db-preview-action-btn primary"
                        disabled={buyingId !== null}
                        onClick={() => buyTemplate(previewTemplate)}
                      >
                        {buyingId === previewTemplate.id ? <Loader2 size={14} className="db-spin" /> : <Lock size={14} />}
                        <span>Unlock Template ({previewTemplate.creditCost ?? 0} Credits)</span>
                      </button>
                    )}
                    <button className="db-preview-action-btn secondary" onClick={() => setPreviewTemplate(null)}>
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .db-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 0 0.5rem;
          animation: dbFadeIn 0.35s ease-out;
        }

        @keyframes dbFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .db-main-container {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 1.5rem;
          align-items: start;
        }

        .db-content-left {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* ─── HERO ─── */
        .db-compact-hero {
          position: relative;
          background: linear-gradient(135deg, #4f46e5 0%, #7d2ae8 60%, #ec4899 100%);
          border-radius: 20px;
          padding: 2rem 2.25rem;
          color: white;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(125, 42, 232, 0.12);
        }

        .db-hero-glass-shine {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.15) 0%, transparent 60%);
          pointer-events: none;
        }

        .db-hero-inner {
          position: relative;
          z-index: 2;
        }

        .db-hero-left {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .db-hero-title {
          font-size: 1.45rem;
          font-weight: 800;
          margin: 0;
          line-height: 1.25;
          max-width: 520px;
        }

        .db-hero-pitch {
          font-size: 0.88rem;
          line-height: 1.5;
          margin: 0;
          max-width: 580px;
          opacity: 0.92;
          font-weight: 500;
        }

        .db-hero-credit-msg {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          padding: 0.4rem 0.85rem;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 500;
          align-self: flex-start;
        }

        .db-hero-credit-msg strong {
          font-weight: 800;
          color: #fbbf24;
        }

        .db-hero-ctas {
          display: flex;
          gap: 0.65rem;
          margin-top: 0.35rem;
          flex-wrap: wrap;
        }

        .db-cta-primary {
          background: white;
          color: #7d2ae8;
          border: none;
          font-weight: 700;
          font-size: 0.8rem;
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
          transition: all 0.2s;
        }

        .db-cta-primary:hover {
          transform: translateY(-1px);
          background: #fbfbfd;
        }

        .db-cta-buy-credits {
          background: #f59e0b;
          color: white;
          border: none;
          font-weight: 700;
          font-size: 0.8rem;
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);
          transition: all 0.2s;
        }

        .db-cta-buy-credits:hover {
          transform: translateY(-1px);
          background: #e89209;
        }

        .db-cta-secondary {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: white;
          font-weight: 600;
          font-size: 0.8rem;
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          backdrop-filter: blur(8px);
          transition: all 0.2s;
        }

        .db-cta-secondary:hover {
          background: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
        }

        .db-cta-screen {
          background: #10b981;
          color: white;
          border: none;
          font-weight: 700;
          font-size: 0.8rem;
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
          transition: all 0.2s;
        }

        .db-cta-screen:hover {
          transform: translateY(-1px);
          background: #059669;
        }

        /* ─── QUICK STATS BAR ─── */
        .db-stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
        }

        .db-stat-chip {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 0.75rem 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .db-stat-chip:hover {
          border-color: #7d2ae8;
          box-shadow: 0 4px 12px rgba(125, 42, 232, 0.06);
        }

        .db-stat-chip-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .db-stat-chip-icon.green { background: rgba(34, 197, 94, 0.08); color: #22c55e; }
        .db-stat-chip-icon.purple { background: rgba(125, 42, 232, 0.08); color: #7d2ae8; }
        .db-stat-chip-icon.pink { background: rgba(236, 72, 153, 0.08); color: #ec4899; }
        .db-stat-chip-icon.indigo { background: rgba(79, 70, 229, 0.08); color: #4f46e5; }

        .db-stat-chip-info {
          display: flex;
          flex-direction: column;
        }

        .db-stat-chip-val {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1.15;
        }

        .db-stat-chip-lbl {
          font-size: 0.62rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        /* ─── GETTING STARTED (new users) ─── */
        .db-getting-started {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.5rem;
        }

        .db-getting-started-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }

        .db-getting-started-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0.2rem 0 1rem;
        }

        .db-steps-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .db-step-card {
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .db-step-card:hover {
          border-color: #7d2ae8;
          background: var(--card-bg);
        }

        .db-step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7d2ae8, #ec4899);
          color: white;
          font-size: 0.72rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .db-step-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .db-step-name {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text);
        }

        .db-step-desc {
          font-size: 0.62rem;
          color: var(--text-muted);
        }

        .db-step-arrow {
          color: var(--text-muted);
          opacity: 0.4;
        }

        .db-getting-started-alt {
          margin-top: 1.1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 0.85rem;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .db-alt-browse-btn {
          background: linear-gradient(135deg, #7d2ae8 0%, #ec4899 100%);
          color: white;
          border: none;
          padding: 0.45rem 1rem;
          border-radius: 8px;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          transition: all 0.2s;
        }

        .db-alt-browse-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        /* ─── TEMPLATE MARKETPLACE ─── */
        .db-discovery-panel {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .db-discovery-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .db-discovery-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }

        .db-discovery-title-small {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.25rem;
        }

        .db-discovery-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin: 0.15rem 0 0;
        }

        .db-search-bar-wrapper {
          position: relative;
          width: 240px;
        }

        .db-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          opacity: 0.6;
        }

        .db-search-input-premium {
          width: 100%;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.45rem 0.6rem 0.45rem 1.85rem;
          font-size: 0.75rem;
          color: var(--text);
          outline: none;
          transition: border-color 0.2s;
        }

        .db-search-input-premium:focus {
          border-color: #7d2ae8;
          background: var(--card-bg);
        }

        .db-category-pills {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 0.15rem;
        }

        .db-category-pills::-webkit-scrollbar {
          display: none;
        }

        .db-pill-btn {
          flex-shrink: 0;
          padding: 0.42rem 0.85rem;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .db-pill-btn:hover {
          border-color: #7d2ae8;
          color: #7d2ae8;
        }

        .db-pill-btn.active {
          background: #7d2ae8;
          color: white;
          border-color: #7d2ae8;
          box-shadow: 0 4px 10px rgba(125, 42, 232, 0.12);
        }

        /* Template cards - LARGER */
        .db-large-templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.35rem;
        }

        .db-large-template-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
        }

        .db-large-template-card:hover {
          transform: translateY(-3px);
          border-color: #7d2ae8;
          box-shadow: 0 12px 28px rgba(125, 42, 232, 0.1);
        }

        .db-card-preview-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16/10;
          background: #f8fafc;
          border-bottom: 1px solid var(--border);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .db-card-preview-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
        }

        .db-card-preview-placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .db-card-top-left-badges {
          position: absolute;
          top: 10px;
          left: 10px;
          display: flex;
          gap: 0.3rem;
        }

        .db-badge-orientation {
          background: rgba(0, 0, 0, 0.65);
          color: white;
          font-size: 0.6rem;
          font-weight: 700;
          padding: 0.22rem 0.5rem;
          border-radius: 5px;
          backdrop-filter: blur(2px);
        }

        .db-card-top-right-badges {
          position: absolute;
          top: 10px;
          right: 10px;
        }

        .db-badge-credits {
          font-size: 0.6rem;
          font-weight: 700;
          padding: 0.22rem 0.55rem;
          border-radius: 5px;
          color: white;
        }

        .db-badge-credits.owned { background: #22c55e; }
        .db-badge-credits.free { background: #3b82f6; }
        .db-badge-credits.cost { background: #f59e0b; }

        .db-card-details-row {
          padding: 0.85rem 1.1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }

        .db-card-info-texts {
          flex: 1;
          overflow: hidden;
        }

        .db-card-title-text {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .db-card-actions-wrapper {
          display: flex;
          gap: 0.4rem;
          flex-shrink: 0;
        }

        .db-btn-card-preview {
          background: var(--sidebar-bg);
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 0.38rem 0.65rem;
          font-size: 0.68rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          transition: all 0.15s;
        }

        .db-btn-card-preview:hover {
          border-color: #7d2ae8;
          color: #7d2ae8;
        }

        .db-btn-card-action {
          border: none;
          border-radius: 7px;
          padding: 0.38rem 0.7rem;
          font-size: 0.68rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: white;
          transition: all 0.15s;
        }

        .db-btn-card-action.use { background: #7d2ae8; }
        .db-btn-card-action.buy { background: linear-gradient(135deg, #7d2ae8 0%, #6d28d9 100%); }
        .db-btn-card-action:hover { opacity: 0.9; transform: translateY(-1px); }

        /* Recommended horizontal */
        .db-horizontal-recommended-row {
          display: flex;
          gap: 0.85rem;
          overflow-x: auto;
          scrollbar-width: thin;
          padding-bottom: 0.5rem;
        }

        .db-recommended-card-item {
          flex-shrink: 0;
          width: 160px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.15s;
        }

        .db-recommended-card-item:hover {
          border-color: #7d2ae8;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(125, 42, 232, 0.06);
        }

        .db-recommended-thumb-area {
          position: relative;
          aspect-ratio: 4/3;
          background: var(--sidebar-bg);
          overflow: hidden;
        }

        .db-recommended-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .db-recommended-orient-lbl {
          position: absolute;
          bottom: 5px;
          left: 5px;
          background: rgba(0,0,0,0.6);
          color: white;
          font-size: 0.52rem;
          font-weight: 600;
          padding: 2px 4px;
          border-radius: 3px;
        }

        .db-recommended-cost-lbl {
          position: absolute;
          top: 5px;
          right: 5px;
          background: rgba(245, 158, 11, 0.85);
          color: white;
          font-size: 0.52rem;
          font-weight: 700;
          padding: 2px 4px;
          border-radius: 3px;
        }

        .db-recommended-info {
          padding: 0.4rem 0.5rem;
        }

        .db-recommended-title {
          margin: 0;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── OPERATIONS ─── */
        .db-operations-panel {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.25rem 1.5rem;
        }

        .db-operations-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.85rem;
        }

        .db-operations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.75rem;
        }

        .db-ops-card {
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0.65rem 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .db-ops-card:hover {
          border-color: #7d2ae8;
          background: var(--card-bg);
        }

        .db-ops-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .db-ops-icon.purple { background: rgba(125, 42, 232, 0.08); color: #7d2ae8; }
        .db-ops-icon.pink { background: rgba(236, 72, 153, 0.08); color: #ec4899; }
        .db-ops-icon.indigo { background: rgba(79, 70, 229, 0.08); color: #4f46e5; }
        .db-ops-icon.green { background: rgba(34, 197, 94, 0.08); color: #22c55e; }

        .db-ops-texts {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .db-ops-name {
          font-size: 0.74rem;
          font-weight: 700;
          color: var(--text);
        }

        .db-ops-desc {
          font-size: 0.58rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .db-ops-arrow {
          color: var(--text-muted);
          opacity: 0.5;
        }

        /* ─── SIDEBAR ─── */
        .db-content-right-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .db-sidebar-widget {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01);
        }

        .db-widget-title {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin: 0;
        }

        /* Credits Widget (enhanced) */
        .db-credits-widget {
          background: linear-gradient(135deg, rgba(125, 42, 232, 0.03), rgba(236, 72, 153, 0.03));
          border-color: rgba(125, 42, 232, 0.15);
        }

        .db-sidebar-credits-box {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          align-items: center;
        }

        .db-credits-big-number {
          font-size: 2.8rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1;
          background: linear-gradient(135deg, #7d2ae8, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .db-credits-big-label {
          font-size: 0.68rem;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.35;
        }

        .db-credits-progress-horizontal-bg {
          width: 100%;
          height: 5px;
          background: var(--border);
          border-radius: 10px;
          overflow: hidden;
        }

        .db-credits-progress-horizontal-fill {
          height: 100%;
          background: linear-gradient(90deg, #7d2ae8, #f59e0b);
          border-radius: 10px;
        }

        .db-credits-metrics-row {
          width: 100%;
          display: flex;
          justify-content: space-between;
          font-size: 0.65rem;
          color: var(--text-muted);
        }

        .db-credits-estimate {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-align: center;
          margin: 0;
          font-style: italic;
          opacity: 0.85;
        }

        .db-widget-buy-btn {
          width: 100%;
          background: linear-gradient(135deg, #7d2ae8 0%, #ec4899 100%);
          color: white;
          border: none;
          padding: 0.55rem;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          box-shadow: 0 4px 12px rgba(125, 42, 232, 0.15);
          transition: all 0.2s;
        }

        .db-widget-buy-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        /* Stats rows */
        .db-widget-stats-rows {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .db-widget-stat-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.6rem;
          border-radius: 8px;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: border-color 0.15s;
        }

        .db-widget-stat-row:hover {
          border-color: #7d2ae8;
        }

        .db-widget-stat-icon {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .db-widget-stat-icon.green { background: rgba(34, 197, 94, 0.07); color: #22c55e; }
        .db-widget-stat-icon.purple { background: rgba(125, 42, 232, 0.07); color: #7d2ae8; }
        .db-widget-stat-icon.orange { background: rgba(245, 158, 11, 0.07); color: #f59e0b; }
        .db-widget-stat-icon.indigo { background: rgba(79, 70, 229, 0.07); color: #4f46e5; }

        .db-widget-stat-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          flex: 1;
        }

        .db-widget-stat-val {
          font-size: 0.7rem;
          font-weight: 800;
        }

        .db-widget-stat-val.green-text { color: #22c55e; }
        .db-widget-stat-val.purple-text { color: #7d2ae8; }

        .db-widget-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--border);
          border-top-color: #7d2ae8;
          border-radius: 50%;
          animation: db-spin-key 0.8s linear infinite;
        }

        /* Subscription */
        .db-sidebar-widget-sub {
          background: rgba(125, 42, 232, 0.04);
          border: 1px solid rgba(125, 42, 232, 0.15);
          border-radius: 12px;
          padding: 0.65rem 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .db-sub-plan-badge-compact {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: #7d2ae8;
          font-size: 0.68rem;
          font-weight: 700;
        }

        .db-sub-plan-licenses-compact {
          font-size: 0.6rem;
          color: var(--text-muted);
        }

        /* Compact Org Widget (bottom of sidebar) */
        .db-sidebar-widget-compact {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0.75rem 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .db-widget-org-compact-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .db-widget-icon-dim {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .db-widget-org-name-text {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .db-widget-loc-picker-container {
          position: relative;
        }

        .db-widget-loc-trigger {
          width: 100%;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.35rem 0.55rem;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          cursor: pointer;
          color: var(--text);
          text-align: left;
          font-size: 0.68rem;
        }

        .db-widget-loc-name-txt {
          font-weight: 600;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .db-widget-loc-chevron {
          color: var(--text-muted);
          transition: transform 0.2s;
        }

        .db-widget-loc-chevron.open {
          transform: rotate(180deg);
        }

        .db-widget-loc-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
        }

        .db-widget-loc-popover {
          position: absolute;
          right: 0;
          bottom: calc(100% + 6px);
          width: 200px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 -8px 24px rgba(0,0,0,0.15);
          z-index: 200;
          padding: 0.35rem 0;
        }

        .db-popover-title {
          font-size: 0.6rem;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--text-muted);
          padding: 0.3rem 0.75rem;
          margin: 0;
        }

        .db-popover-scrollable {
          max-height: 140px;
          overflow-y: auto;
        }

        .db-popover-item {
          width: 100%;
          border: none;
          background: none;
          padding: 0.4rem 0.75rem;
          font-size: 0.7rem;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          text-align: left;
        }

        .db-popover-item:hover {
          background: var(--sidebar-hover);
        }

        .db-popover-item.active {
          color: #7d2ae8;
          font-weight: 700;
          background: rgba(125, 42, 232, 0.04);
        }

        .db-popover-footer {
          border-top: 1px solid var(--border);
          margin-top: 0.25rem;
          padding: 0.25rem 0.4rem 0;
        }

        .db-popover-add-btn {
          width: 100%;
          background: none;
          border: none;
          color: #7d2ae8;
          font-weight: 700;
          font-size: 0.68rem;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.35rem;
          cursor: pointer;
          border-radius: 5px;
        }

        .db-popover-add-btn:hover {
          background: var(--sidebar-hover);
        }

        /* ─── PREVIEW MODAL ─── */
        .db-preview-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .db-preview-modal-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 700px;
          max-width: 90vw;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          animation: dbModalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes dbModalScaleIn {
          from { opacity: 0; transform: scale(0.97) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .db-preview-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
        }

        .db-preview-modal-title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
        }

        .db-preview-close-btn {
          background: none;
          border: none;
          font-size: 1.4rem;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .db-preview-modal-body {
          padding: 1.25rem;
        }

        .db-preview-layout-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 1.25rem;
        }

        .db-preview-image-section {
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid var(--border);
          aspect-ratio: 4/3;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
        }

        .db-preview-large-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
        }

        .db-preview-placeholder-bg {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          width: 100%;
          height: 100%;
        }

        .db-preview-info-section {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .db-preview-tags-row {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .db-preview-badge {
          background: rgba(125, 42, 232, 0.08);
          border: 1px solid rgba(125, 42, 232, 0.2);
          color: #7d2ae8;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 5px;
        }

        .db-preview-badge.dim {
          background: var(--bg-base);
          border-color: var(--border);
          color: var(--text-muted);
        }

        .db-preview-badge.green {
          background: rgba(34, 197, 94, 0.08);
          border-color: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .db-preview-description {
          font-size: 0.74rem;
          color: var(--text-muted);
          line-height: 1.45;
          margin: 0;
        }

        .db-preview-cost-area {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          color: var(--text);
        }

        .db-preview-cost-val strong {
          color: #f59e0b;
        }

        .db-preview-modal-actions {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-top: auto;
          padding-top: 0.75rem;
        }

        .db-preview-action-btn {
          width: 100%;
          padding: 0.55rem;
          border-radius: 8px;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          transition: all 0.2s;
        }

        .db-preview-action-btn.primary {
          background: #7d2ae8;
          color: white;
          border: none;
        }

        .db-preview-action-btn.primary:hover {
          opacity: 0.92;
        }

        .db-preview-action-btn.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .db-preview-action-btn.secondary {
          background: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
          border: 1px solid var(--btn-secondary-border);
        }

        .db-preview-action-btn.secondary:hover {
          background: var(--btn-secondary-hover);
        }

        /* ─── UTILITIES ─── */
        .db-spin {
          animation: db-spin-key 1s linear infinite;
        }

        @keyframes db-spin-key {
          to { transform: rotate(360deg); }
        }

        .db-slider-loading-grid {
          display: flex;
          gap: 0.85rem;
        }

        .db-skeleton-card {
          width: 160px;
          height: 120px;
          border-radius: 12px;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          animation: dbPulse 1.5s ease-in-out infinite;
        }

        .db-skeleton-large-card {
          height: 240px;
          border-radius: 16px;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          animation: dbPulse 1.5s ease-in-out infinite;
        }

        @keyframes dbPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .db-grid-loading {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.35rem;
        }

        .db-no-results-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 3rem 0;
          color: var(--text-muted);
        }

        .db-no-results-text {
          font-size: 0.75rem;
          margin: 0;
        }

        .db-empty-discovery {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
        }

        .gold-text { color: #f59e0b; }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 1100px) {
          .db-stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 900px) {
          .db-main-container {
            grid-template-columns: 1fr;
          }
          .db-content-right-sidebar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1rem;
          }
        }

        @media (max-width: 640px) {
          .db-compact-hero {
            padding: 1.5rem;
          }
          .db-hero-title {
            font-size: 1.15rem;
          }
          .db-hero-ctas {
            flex-direction: column;
          }
          .db-stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
          .db-steps-grid {
            grid-template-columns: 1fr;
          }
          .db-large-templates-grid {
            grid-template-columns: 1fr;
          }
          .db-preview-layout-grid {
            grid-template-columns: 1fr;
          }
        }
        /* ─── CREDIT BUY MODAL ─── */
        .dbc-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.75);
          display: flex; align-items: center; justify-content: center;
          z-index: 2000; backdrop-filter: blur(8px);
          animation: dbc-fade .18s ease;
        }
        @keyframes dbc-fade { from { opacity: 0; } }

        .dbc-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 22px; width: 520px; max-width: 95vw;
          box-shadow: 0 40px 100px rgba(0,0,0,.55);
          animation: dbc-in .2s ease;
          overflow: hidden;
        }
        @keyframes dbc-in { from { opacity:0; transform: scale(.95) translateY(12px); } }

        .dbc-modal-hd {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, rgba(99,102,241,.1), rgba(139,92,246,.07));
        }
        .dbc-modal-hd-left { display: flex; align-items: center; gap: .85rem; }
        .dbc-modal-icon {
          width: 42px; height: 42px; border-radius: 12px;
          background: var(--btn-cta-bg); display: flex; align-items: center;
          justify-content: center; color: #fff;
        }
        .dbc-modal-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .dbc-modal-sub { font-size: .75rem; color: var(--text-muted); margin: 0; }
        .dbc-close-btn {
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; width: 34px; height: 34px; display: flex;
          align-items: center; justify-content: center; cursor: pointer;
          color: var(--text-muted); transition: all .15s;
        }
        .dbc-close-btn:hover { background: var(--border); color: var(--text); }

        .dbc-modal-body { padding: 1.5rem; }

        .dbc-pack-prompt { font-size: .85rem; color: var(--text-muted); margin: 0 0 1rem; }
        .dbc-packs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        @media (max-width: 480px) { .dbc-packs-grid { grid-template-columns: 1fr; } }

        .dbc-pack-card {
          background: var(--sidebar-bg); border: 2px solid var(--border);
          border-radius: 16px; padding: 1.1rem; display: flex; flex-direction: column;
          align-items: center; gap: .45rem; text-align: center; cursor: pointer;
          transition: all .2s; position: relative; color: var(--text);
        }
        .dbc-pack-card:hover:not(:disabled) {
          border-color: var(--accent); background: rgba(99,102,241,.06);
          transform: translateY(-2px); box-shadow: 0 6px 24px rgba(99,102,241,.15);
        }
        .dbc-pack-card:disabled { opacity: .65; cursor: not-allowed; }
        .dbc-pack-loading { border-color: var(--accent) !important; }

        .dbc-pack-badge {
          position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
          background: #f59e0b; color: #fff; font-size: .6rem; font-weight: 700;
          padding: .18rem .6rem; border-radius: 999px; white-space: nowrap;
        }
        .dbc-pack-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: var(--btn-cta-bg); display: flex; align-items: center;
          justify-content: center; color: #fff; margin-top: .35rem;
        }
        .dbc-pack-name { font-size: .82rem; font-weight: 700; margin: 0; }
        .dbc-pack-credits { font-size: .72rem; color: var(--text-muted); }
        .dbc-pack-price { font-size: 1.3rem; font-weight: 800; }
        .dbc-pack-cur { font-size: .7rem; font-weight: 600; color: var(--text-muted); }
        .dbc-pack-cta {
          margin-top: .35rem; background: var(--btn-cta-bg); color: var(--btn-cta-text);
          padding: .38rem .9rem; border-radius: 10px; font-size: .75rem;
          font-weight: 700; width: 100%; text-align: center;
        }
        .dbc-pack-spinner {
          display: flex; align-items: center; gap: .35rem;
          font-size: .75rem; color: var(--accent); margin-top: .35rem;
        }

        .dbc-pack-summary {
          display: flex; align-items: center; gap: .6rem;
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 12px; padding: .75rem 1rem;
          margin-bottom: 1.25rem; font-size: .875rem; color: var(--text-muted);
        }
        .dbc-pack-summary svg { color: var(--accent); flex-shrink: 0; }

        .dbc-pack-note {
          display: flex; align-items: center; gap: .4rem;
          font-size: .72rem; color: var(--text-muted); margin: 1rem 0 0;
          justify-content: center;
        }

        /* Stripe card form inside modal */
        .dbc-card-form { display: flex; flex-direction: column; gap: 1rem; }
        .dbc-field { display: flex; flex-direction: column; gap: .4rem; }
        .dbc-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
        .dbc-stripe-el { background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; padding: .75rem 1rem; }
        .dbc-stripe-el:focus-within { border-color: var(--accent); }
        .dbc-field-err { font-size: .75rem; color: #ef4444; margin: 0; }
        .dbc-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .dbc-form-footer { display: flex; align-items: center; justify-content: space-between; padding-top: .5rem; }
        .dbc-secure { display: flex; align-items: center; gap: .4rem; font-size: .75rem; color: var(--text-muted); }
        .dbc-form-actions { display: flex; gap: .75rem; }
        .dbc-btn-primary {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--btn-cta-bg); color: var(--btn-cta-text);
          border: none; padding: .6rem 1.25rem; border-radius: 12px;
          font-size: .875rem; font-weight: 600; cursor: pointer; transition: all .2s;
        }
        .dbc-btn-primary:hover { background: var(--btn-cta-hover); }
        .dbc-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .dbc-btn-ghost {
          background: transparent; border: 1px solid var(--border);
          color: var(--text); padding: .6rem 1.25rem; border-radius: 12px;
          font-size: .875rem; cursor: pointer; transition: all .15s;
        }
        .dbc-btn-ghost:hover { background: var(--sidebar-bg); }
      `}</style>

      {/* Credit Buy Modal */}
      {showCreditModal && (
        <CreditBuyModal
          onClose={() => setShowCreditModal(false)}
          onSuccess={() => { loadCredits(); }}
        />
      )}

    </div>
  );
}
