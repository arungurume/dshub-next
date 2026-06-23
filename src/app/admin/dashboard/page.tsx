'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslateContext';
import { useDSStore } from '@/store/useDSStore';
import { 
  Palette, Grid, HelpCircle, Plus, ChevronDown, MapPin, 
  FileVideo, FolderHeart, Calendar, Monitor, ChevronRight, 
  Lightbulb, ArrowUpRight, Link2, Sparkles, Loader2, AlertCircle, Building2,
  ShoppingBag, CheckCircle2, Link2Off, Star, Coins, ExternalLink, RefreshCw
} from 'lucide-react';
import { cmsApi, cmsApiV2, umsApi, setCookie } from '@/lib/api';
import { toast } from 'sonner';

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
}

/** Picks the best thumbnail URL from a template — images[] is the real source */
const getThumb = (tpl: DsTemplate): string | null => {
  if (tpl.images && tpl.images.length > 0) {
    const url = tpl.images[0].url;
    if (url) return url;
  }
  // fallbacks for older data
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

type HubTab = 'gallery' | 'purchased' | 'canva';

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

  // ── Template Hub State ───────────────────────────────────────────────────────
  const [hubTab, setHubTab] = useState<HubTab>('gallery');

  // Gallery tab
  const [gallery, setGallery] = useState<DsTemplate[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  // Purchased tab
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasedTemplates, setPurchasedTemplates] = useState<Map<number, DsTemplate>>(new Map());
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  // Credit balance
  const [credits, setCredits] = useState<{ total: number; used: number } | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<number>>(new Set());

  // Canva tab
  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaDesigns, setCanvaDesigns] = useState<CanvaDesign[]>([]);
  const [canvaLoading, setCanvaLoading] = useState(true);
  const [canvaConnecting, setCanvaConnecting] = useState(false);

  const locations = currentUser?.organization?.locations || [];

  // ── Load Everything On Mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadStats();
    loadGallery();
    loadPurchases();
    loadCredits();
    checkCanvaStatus();
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
      const res = await cmsApi.get('/ctc/templates', { params: { page: 0, size: 8 } });
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
      const res = await cmsApi.get('/ctpc/purchases', { params: { page: 0, size: 20 } });
      const items: Purchase[] = res.data?.content || res.data || [];
      setPurchases(items);
      // Track which template IDs are already purchased
      const ids = new Set(items.map((p) => p.dsCanvaTemplateId));
      setPurchasedIds(ids);
      // Fetch full template details for purchased items
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

  const checkCanvaStatus = async () => {
    setCanvaLoading(true);
    try {
      const profileRes = await cmsApi.get('/canva/profile');
      if (profileRes.status === 200 && profileRes.data) {
        setCanvaConnected(true);
        const designsRes = await cmsApi.get('/canva/designs', { params: { size: 6 } });
        setCanvaDesigns(designsRes.data?.designs || designsRes.data?.items || designsRes.data?.content || []);
      } else {
        setCanvaConnected(false);
      }
    } catch {
      setCanvaConnected(false);
    } finally {
      setCanvaLoading(false);
    }
  };

  const connectCanva = async () => {
    setCanvaConnecting(true);
    try {
      const { data } = await cmsApi.get('/canva/connect');
      const redirectUrl = data?.redirectUrl || data?.url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        toast.error('Failed to connect to Canva');
      }
    } catch {
      toast.error('Failed to connect to Canva');
    } finally {
      setCanvaConnecting(false);
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
      toast.success(`"${template.title}" added to your library!`);
      setPurchasedIds((prev) => new Set([...prev, template.id]));
      setPurchasedTemplates((prev) => new Map([...prev, [template.id, template]]));
      setPurchases((prev) => [...prev, {
        id: Date.now(), dsCanvaTemplateId: template.id,
        creditCost: template.creditCost, purchaseDate: new Date().toISOString(),
      }]);
      if (credits) setCredits({ ...credits, used: credits.used + cost });
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

  return (
    <div className="db-page">
      
      {/* ── 1. WELCOME BANNER ── */}
      <div className="db-welcome-card">
        <div className="db-welcome-left">
          <h1 className="db-welcome-title">
            {t('DASHBOARD.welcome', { name: currentUser?.firstName || 'Arun' })}
          </h1>
          
          <div className="db-location-context">
            <span className="db-location-label">{t('DASHBOARD.current_location_context')}</span>
            {!currentUser ? (
              <span className="db-location-loading">{t('DASHBOARD.loading')}</span>
            ) : (
              <div className="db-location-actions">
                {locations.length === 0 ? (
                  <button onClick={() => router.push('/admin/locations/0')} className="db-location-add-btn">
                    + {t('DASHBOARD.add_location')}
                  </button>
                ) : (
                  <>
                    <button
                      disabled={switching}
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="db-location-trigger-btn"
                    >
                      {currentLocation?.name || t('DASHBOARD.select_location')}
                      <ChevronDown size={13} className={`db-chevron ${isDropdownOpen ? 'open' : ''}`} />
                    </button>
                    <button onClick={() => router.push('/admin/locations/0')} className="db-location-add-btn" style={{ marginLeft: '0.4rem' }}>
                      + {t('DASHBOARD.add_location')}
                    </button>
                  </>
                )}
                {isDropdownOpen && (
                  <>
                    <div className="db-dropdown-overlay" onClick={() => setIsDropdownOpen(false)} />
                    <div className="db-location-dropdown">
                      <p className="db-dropdown-header">{t('DASHBOARD.select_location_prompt')}</p>
                      <div className="db-dropdown-list">
                        {locations.map((loc: any) => (
                          <button
                            key={loc.id}
                            onClick={() => handleLocationChange(loc)}
                            className={`db-dropdown-item ${currentLocation?.id === loc.id ? 'active' : ''}`}
                          >
                            <MapPin size={12} className="db-dropdown-icon" />
                            <span className="db-dropdown-text">{loc.name || 'Unnamed Location'}</span>
                          </button>
                        ))}
                      </div>
                      <div className="db-dropdown-footer">
                        <button onClick={() => { setIsDropdownOpen(false); router.push('/admin/locations/0'); }} className="db-add-loc-btn">
                          <Plus size={12} /><span>{t('DASHBOARD.add_location')}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="db-welcome-right" aria-hidden="true">
          <svg className="db-welcome-svg" width="320" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" opacity="0.18" />
              </pattern>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="lineGrad2" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.15" />
              </linearGradient>
              <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="320" height="160" fill="url(#dotGrid)" className="db-svg-dots" />
            <line x1="60" y1="-10" x2="-10" y2="80" stroke="url(#lineGrad)" strokeWidth="1.5" />
            <line x1="120" y1="-10" x2="20" y2="120" stroke="url(#lineGrad)" strokeWidth="1" />
            <line x1="200" y1="-10" x2="60" y2="170" stroke="url(#lineGrad)" strokeWidth="0.8" />
            <line x1="280" y1="-10" x2="160" y2="170" stroke="url(#lineGrad2)" strokeWidth="1.5" />
            <line x1="340" y1="10" x2="220" y2="170" stroke="url(#lineGrad2)" strokeWidth="1" />
            <line x1="340" y1="60" x2="260" y2="170" stroke="url(#lineGrad2)" strokeWidth="0.7" />
            <line x1="100" y1="40" x2="320" y2="40" stroke="var(--accent)" strokeWidth="0.6" opacity="0.2" />
            <line x1="80" y1="90" x2="320" y2="90" stroke="#a855f7" strokeWidth="0.6" opacity="0.2" />
            <line x1="120" y1="130" x2="320" y2="130" stroke="var(--accent)" strokeWidth="0.6" opacity="0.15" />
            <ellipse cx="240" cy="55" rx="55" ry="55" fill="url(#glow1)" />
            <ellipse cx="290" cy="115" rx="40" ry="40" fill="url(#glow2)" />
            <circle cx="240" cy="55" r="30" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
            <circle cx="240" cy="55" r="48" stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.2" strokeDasharray="4 6" />
            <circle cx="290" cy="115" r="22" stroke="#a855f7" strokeWidth="1" fill="none" opacity="0.35" />
            <circle cx="290" cy="115" r="36" stroke="#a855f7" strokeWidth="0.5" fill="none" opacity="0.15" strokeDasharray="3 5" />
            <circle cx="180" cy="30" r="4" fill="var(--accent)" opacity="0.5" />
            <circle cx="160" cy="120" r="3" fill="#a855f7" opacity="0.45" />
            <circle cx="310" cy="45" r="3" fill="var(--accent)" opacity="0.4" />
            <circle cx="130" cy="70" r="2.5" fill="#a855f7" opacity="0.35" />
          </svg>
        </div>
      </div>

      {/* ── 2. QUICK ACTION GRID ── */}
      <div className="db-action-grid">
        <div className="db-action-card" onClick={() => router.push('/admin/content')}>
          <div className="db-action-icon-wrapper purple"><FileVideo size={20} /></div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.upload_manage')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.upload_manage_desc')}</p>
          </div>
          <div className="db-action-arrow"><ChevronRight size={14} /></div>
        </div>
        <div className="db-action-card" onClick={() => router.push('/admin/playlists')}>
          <div className="db-action-icon-wrapper pink"><FolderHeart size={20} /></div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.create_playlist')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.create_playlist_desc')}</p>
          </div>
          <div className="db-action-arrow"><ChevronRight size={14} /></div>
        </div>
        <div className="db-action-card" onClick={() => router.push('/admin/schedules')}>
          <div className="db-action-icon-wrapper deep-purple"><Calendar size={20} /></div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.schedule_content')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.schedule_content_desc')}</p>
          </div>
          <div className="db-action-arrow"><ChevronRight size={14} /></div>
        </div>
        <div className="db-action-card" onClick={() => router.push('/admin/screens')}>
          <div className="db-action-icon-wrapper green"><Monitor size={20} /></div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.manage_screens')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.manage_screens_desc')}</p>
          </div>
          <div className="db-action-arrow"><ChevronRight size={14} /></div>
        </div>
      </div>

      {/* ── 3. TWO-COLUMN MAIN BODY ── */}
      <div className="db-columns-layout">

        {/* ── TEMPLATE HUB (Left Column) ── */}
        <div className="db-card db-hub-card">

          {/* Card Header */}
          <div className="db-card-header">
            <div>
              <h2 className="db-card-title">
                <Sparkles size={16} className="db-primary-color" />
                Template Hub
              </h2>
              <p className="db-card-desc">Browse, buy, and use DSHub and your own Canva designs</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {credits !== null && (
                <div className="db-credit-badge">
                  <Coins size={12} />
                  <span>{remainingCredits} credit{remainingCredits !== 1 ? 's' : ''}</span>
                </div>
              )}
              <button onClick={() => router.push('/admin/templates')} className="db-browse-templates-link">
                Browse All <ArrowUpRight size={13} />
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="db-hub-tabs">
            {([
              { id: 'gallery', label: 'DSHub Gallery', icon: <Sparkles size={13} /> },
              { id: 'purchased', label: `My Purchases${purchases.length > 0 ? ` (${purchases.length})` : ''}`, icon: <CheckCircle2 size={13} /> },
              { id: 'canva', label: 'My Canva Designs', icon: <Link2 size={13} /> },
            ] as { id: HubTab; label: string; icon: React.ReactNode }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHubTab(tab.id)}
                className={`db-hub-tab ${hubTab === tab.id ? 'active' : ''}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Body */}
          <div className="db-card-body">

            {/* ── TAB 1: DSHub Gallery ── */}
            {hubTab === 'gallery' && (
              galleryLoading ? (
                <div className="db-loading-state">
                  <Loader2 className="db-spin db-primary-color" size={22} />
                  <span className="db-loading-text">Loading templates…</span>
                </div>
              ) : gallery.length === 0 ? (
                <div className="db-empty-state-card">
                  <div className="db-empty-icon-wrapper"><Sparkles size={22} /></div>
                  <div className="db-empty-text-wrap">
                    <p className="db-empty-title">No templates yet</p>
                    <p className="db-empty-desc">Check back soon — templates are being added.</p>
                  </div>
                  <button onClick={() => router.push('/admin/templates')} className="db-btn-secondary">
                    <ArrowUpRight size={13} /> Browse all templates
                  </button>
                </div>
              ) : (
                <div className="db-tpl-grid">
                  {gallery.map((tpl) => {
                    const owned = purchasedIds.has(tpl.id);
                    const isBuying = buyingId === tpl.id;
                    const cost = tpl.creditCost ?? 0;
                    return (
                      <div key={tpl.id} className="db-tpl-card">
                        <div className="db-tpl-thumb">
                          {getThumb(tpl) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getThumb(tpl)!} alt={tpl.title} className="db-tpl-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="db-tpl-thumb-placeholder"><Sparkles size={20} opacity={0.3} /></div>
                          )}
                          {owned && <div className="db-tpl-owned-badge"><CheckCircle2 size={11} /> Owned</div>}
                          {cost > 0 && !owned && (
                            <div className="db-tpl-credit-badge"><Coins size={10} /> {cost}</div>
                          )}
                        </div>
                        <div className="db-tpl-info">
                          <p className="db-tpl-title">{tpl.title || 'Untitled'}</p>
                          {owned ? (
                            <a
                              href={tpl.canvaSmartEmbedLink || tpl.canvaPublicLink || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="db-tpl-btn-open"
                            >
                              <ExternalLink size={11} /> Open in Canva
                            </a>
                          ) : (
                            <button
                              onClick={() => buyTemplate(tpl)}
                              disabled={isBuying || buyingId !== null}
                              className="db-tpl-btn-buy"
                            >
                              {isBuying ? <Loader2 size={11} className="db-spin" /> : <ShoppingBag size={11} />}
                              {cost === 0 ? 'Get Free' : `Buy · ${cost} cr`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* View more card */}
                  <div className="db-tpl-card db-tpl-card-more" onClick={() => router.push('/admin/templates')}>
                    <div className="db-tpl-more-inner">
                      <ArrowUpRight size={22} style={{ opacity: 0.5 }} />
                      <span>Browse all</span>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ── TAB 2: My Purchased ── */}
            {hubTab === 'purchased' && (
              purchasesLoading ? (
                <div className="db-loading-state">
                  <Loader2 className="db-spin db-primary-color" size={22} />
                  <span className="db-loading-text">Loading your library…</span>
                </div>
              ) : purchases.length === 0 ? (
                <div className="db-empty-state-card">
                  <div className="db-empty-icon-wrapper"><ShoppingBag size={22} /></div>
                  <div className="db-empty-text-wrap">
                    <p className="db-empty-title">No purchased templates yet</p>
                    <p className="db-empty-desc">Browse the DSHub Gallery and buy templates with your credits.</p>
                  </div>
                  <button onClick={() => setHubTab('gallery')} className="db-btn-primary">
                    <Sparkles size={13} /> Browse DSHub Gallery
                  </button>
                </div>
              ) : (
                <div className="db-tpl-grid">
                  {purchases.map((p) => {
                    const tpl = purchasedTemplates.get(p.dsCanvaTemplateId);
                    return (
                      <div key={p.id} className="db-tpl-card">
                        <div className="db-tpl-thumb">
                          {tpl && getThumb(tpl) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getThumb(tpl!)!} alt={tpl?.title} className="db-tpl-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="db-tpl-thumb-placeholder"><CheckCircle2 size={20} opacity={0.3} /></div>
                          )}
                          <div className="db-tpl-owned-badge"><CheckCircle2 size={11} /> Owned</div>
                        </div>
                        <div className="db-tpl-info">
                          <p className="db-tpl-title">{tpl?.title || `Template #${p.dsCanvaTemplateId}`}</p>
                          <a
                            href={tpl?.canvaSmartEmbedLink || tpl?.canvaPublicLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="db-tpl-btn-open"
                          >
                            <ExternalLink size={11} /> Open in Canva
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ── TAB 3: My Canva Designs ── */}
            {hubTab === 'canva' && (
              canvaLoading ? (
                <div className="db-loading-state">
                  <Loader2 className="db-spin db-primary-color" size={22} />
                  <span className="db-loading-text">{t('DASHBOARD.loading_designs')}</span>
                </div>
              ) : canvaConnected && canvaDesigns.length > 0 ? (
                <>
                  <div className="db-canva-connected-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div className="db-canva-dot" />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)' }}>Canva account connected</span>
                    </div>
                    <button onClick={() => router.push('/admin/templates')} className="db-browse-templates-link" style={{ fontSize: '0.7rem' }}>
                      Manage <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <div className="db-canva-grid">
                    {canvaDesigns.slice(0, 6).map((design) => (
                      <div
                        key={design.id}
                        className="db-design-item"
                        onClick={() => router.push(`/admin/templates?designId=${design.id}`)}
                      >
                        <div className="db-design-thumb-wrapper">
                          {design.thumbnailUrl
                            ? <img src={design.thumbnailUrl} alt={design.title} className="db-design-thumb" />
                            : <div className="db-tpl-thumb-placeholder"><Palette size={16} opacity={0.3} /></div>
                          }
                        </div>
                        <p className="db-design-title">{design.title || 'Untitled'}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="db-empty-state-card">
                  <div className="db-empty-icon-wrapper"><Link2 size={24} /></div>
                  <div className="db-empty-text-wrap">
                    <p className="db-empty-title">{t('DASHBOARD.no_designs_matched')}</p>
                    <p className="db-empty-desc">{t('DASHBOARD.no_designs_matched_desc')}</p>
                  </div>
                  <div className="db-empty-actions">
                    <button onClick={connectCanva} disabled={canvaConnecting} className="db-btn-primary">
                      {canvaConnecting ? <Loader2 className="db-spin" size={14} /> : <Link2 size={14} />}
                      {t('DASHBOARD.connect_canva_account')}
                    </button>
                    <button onClick={() => router.push('/admin/templates')} className="db-btn-secondary">
                      <Sparkles size={14} />{t('DASHBOARD.browse_gallery')}
                    </button>
                  </div>
                </div>
              )
            )}

          </div>
        </div>

        {/* ── Quick Stats (Right Column) ── */}
        <div className="db-card db-stats-card">
          <div className="db-card-header no-border">
            <h2 className="db-card-title">{t('DASHBOARD.quick_stats')}</h2>
          </div>
          <div className="db-card-body">
            {statsLoading ? (
              <div className="db-loading-state"><Loader2 className="db-spin db-primary-color" size={24} /></div>
            ) : (
              <div className="db-stats-list">
                <div className="db-stat-row" onClick={() => router.push('/admin/screens')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg green"><Monitor size={15} /></div>
                    <span className="db-stat-label">{t('DASHBOARD.screens_online')}</span>
                  </div>
                  <span className="db-stat-val green-text">{stats.screensOnline}</span>
                </div>
                <div className="db-stat-row" onClick={() => router.push('/admin/schedules')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg purple"><Calendar size={15} /></div>
                    <span className="db-stat-label">{t('DASHBOARD.scheduled_today')}</span>
                  </div>
                  <span className="db-stat-val purple-text">{stats.scheduledToday}</span>
                </div>
                <div className="db-stat-row" onClick={() => router.push('/admin/playlists')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg orange"><FolderHeart size={15} /></div>
                    <span className="db-stat-label">{t('DASHBOARD.playlists')}</span>
                  </div>
                  <span className="db-stat-val orange-text">{stats.playlists}</span>
                </div>
                <div className="db-stat-row" onClick={() => router.push('/admin/content')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg blue"><FileVideo size={15} /></div>
                    <span className="db-stat-label">{t('DASHBOARD.files')}</span>
                  </div>
                  <span className="db-stat-val blue-text">{stats.files}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 4. TIP BAR ── */}
      {(!currentUser?.organization?.name || currentUser.organization.name === 'My Organization') ? (
        <div className="db-tip-bar db-tip-bar--warning">
          <Building2 size={16} className="db-tip-icon--warning" />
          <span className="db-tip-text">{t('DASHBOARD.org_info_warning')}</span>
          <button onClick={() => router.push('/admin/my-account?tab=organization')} className="db-tip-action-btn">
            {t('DASHBOARD.update_org_info')}
          </button>
        </div>
      ) : (
        <div className="db-tip-bar">
          <Lightbulb size={16} className="db-tip-icon" />
          <span className="db-tip-text">{t('DASHBOARD.tip_bar_default')}</span>
        </div>
      )}

      {/* ── Styles ── */}
      <style>{`
        .db-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 0 0.5rem;
        }

        /* Welcome Card */
        .db-welcome-card {
          position: relative;
          background: linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.06) 100%);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
          min-height: 180px;
        }
        .db-welcome-left { display: flex; flex-direction: column; gap: 0.75rem; z-index: 2; }
        .db-welcome-title { font-size: 1.75rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .db-location-context { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: var(--text-muted); }
        .db-location-label { font-weight: 500; }
        .db-location-loading { color: var(--accent); font-weight: 600; }
        .db-location-actions { display: flex; align-items: center; gap: 0.5rem; }
        .db-location-add-btn { background: rgba(99,102,241,0.1); color: var(--accent); border: 1px solid rgba(99,102,241,0.2); padding: 0.2rem 0.65rem; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .db-location-add-btn:hover { background: rgba(99,102,241,0.18); }
        .db-location-trigger-btn { background: none; border: none; color: var(--accent); font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0.15rem 0.35rem; border-radius: 4px; }
        .db-location-trigger-btn:hover { background: rgba(99,102,241,0.05); }
        .db-chevron { transition: transform 0.2s; }
        .db-chevron.open { transform: rotate(180deg); }
        .db-dropdown-overlay { position: fixed; inset: 0; z-index: 10; }
        .db-location-dropdown { position: absolute; left: 0; top: calc(100% + 6px); width: 220px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 20; padding: 0.35rem 0; animation: db-dropdown-anim 0.15s ease-out; }
        @keyframes db-dropdown-anim { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .db-dropdown-header { font-size: 0.65rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.08em; padding: 0.45rem 1rem; margin: 0; }
        .db-dropdown-list { max-height: 200px; overflow-y: auto; }
        .db-dropdown-item { width: 100%; border: none; background: none; padding: 0.5rem 1rem; font-size: 0.78rem; color: var(--text); display: flex; align-items: center; gap: 0.5rem; cursor: pointer; text-align: left; transition: background 0.1s; }
        .db-dropdown-item:hover { background: var(--sidebar-hover); }
        .db-dropdown-item.active { color: var(--accent); font-weight: 700; background: rgba(99,102,241,0.04); }
        .db-dropdown-icon { color: var(--text-muted); opacity: 0.7; }
        .db-dropdown-item.active .db-dropdown-icon { color: var(--accent); opacity: 1; }
        .db-dropdown-footer { border-top: 1px solid var(--border); margin-top: 0.35rem; padding: 0.35rem 0.5rem 0; }
        .db-add-loc-btn { width: 100%; background: none; border: none; color: var(--accent); font-weight: 600; font-size: 0.75rem; display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.5rem; cursor: pointer; border-radius: 8px; }
        .db-add-loc-btn:hover { background: var(--sidebar-hover); }
        .db-welcome-right { position: absolute; right: 0; top: 0; bottom: 0; width: 340px; display: flex; align-items: center; justify-content: flex-end; pointer-events: none; overflow: hidden; border-radius: 0 20px 20px 0; }
        .db-welcome-svg { width: 100%; height: 100%; color: var(--text-muted); }

        /* Action Grid */
        .db-action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
        .db-action-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; display: flex; align-items: center; gap: 0.85rem; cursor: pointer; transition: all 0.2s cubic-bezier(0.16,1,0.3,1); }
        .db-action-card:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: 0 8px 24px rgba(99,102,241,0.05); }
        .db-action-icon-wrapper { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .db-action-icon-wrapper.purple { background: rgba(99,102,241,0.1); color: var(--accent); }
        .db-action-icon-wrapper.pink { background: rgba(236,72,153,0.1); color: #ec4899; }
        .db-action-icon-wrapper.deep-purple { background: rgba(139,92,246,0.1); color: var(--accent); }
        .db-action-icon-wrapper.green { background: rgba(34,197,94,0.1); color: #22c55e; }
        .db-action-text-wrapper { flex: 1; overflow: hidden; }
        .db-action-card-title { font-size: 0.85rem; font-weight: 700; color: var(--text); margin: 0 0 0.15rem; }
        .db-action-card-desc { font-size: 0.7rem; color: var(--text-muted); margin: 0; line-height: 1.3; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
        .db-action-arrow { width: 24px; height: 24px; border-radius: 50%; background: var(--sidebar-bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); transition: all 0.2s; flex-shrink: 0; }
        .db-action-card:hover .db-action-arrow { background: var(--accent); color: white; border-color: var(--accent); transform: translateX(1px); }

        /* Columns Layout */
        .db-columns-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; }
        .db-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
        .db-card-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .db-card-header.no-border { border-bottom: none; }
        .db-card-title { font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 0; display: flex; align-items: center; gap: 0.5rem; }
        .db-card-desc { font-size: 0.7rem; color: var(--text-muted); margin: 0.2rem 0 0; }
        .db-browse-templates-link { background: none; border: none; color: var(--accent); font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; padding: 0; white-space: nowrap; }
        .db-browse-templates-link:hover { text-decoration: underline; }
        .db-card-body { flex: 1; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; }

        /* Credit Badge */
        .db-credit-badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.65rem; border-radius: 20px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); color: #f59e0b; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }

        /* Hub Tabs */
        .db-hub-card { min-height: 340px; }
        .db-hub-tabs { display: flex; border-bottom: 1px solid var(--border); padding: 0 1.5rem; gap: 0; }
        .db-hub-tab { display: flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; margin-bottom: -1px; }
        .db-hub-tab:hover { color: var(--text); }
        .db-hub-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        /* Template Grid */
        .db-tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.75rem; }
        .db-tpl-card { border-radius: 12px; border: 1px solid var(--border); background: var(--sidebar-bg); overflow: hidden; cursor: pointer; transition: all 0.18s; }
        .db-tpl-card:hover { border-color: var(--accent); box-shadow: 0 6px 20px rgba(99,102,241,0.1); transform: translateY(-2px); }
        .db-tpl-thumb { position: relative; aspect-ratio: 4/3; background: var(--bg-base); overflow: hidden; }
        .db-tpl-img { width: 100%; height: 100%; object-fit: cover; }
        .db-tpl-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
        .db-tpl-owned-badge { position: absolute; top: 5px; left: 5px; display: flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 6px; background: rgba(34,197,94,0.85); color: #fff; font-size: 0.6rem; font-weight: 700; backdrop-filter: blur(4px); }
        .db-tpl-credit-badge { position: absolute; top: 5px; right: 5px; display: flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 6px; background: rgba(245,158,11,0.85); color: #fff; font-size: 0.6rem; font-weight: 700; backdrop-filter: blur(4px); }
        .db-tpl-info { padding: 0.5rem 0.6rem; display: flex; flex-direction: column; gap: 0.35rem; }
        .db-tpl-title { margin: 0; font-size: 0.68rem; font-weight: 600; color: var(--text); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
        .db-tpl-btn-buy { display: flex; align-items: center; justify-content: center; gap: 0.3rem; width: 100%; padding: 0.3rem 0.5rem; border-radius: 7px; border: none; background: var(--accent); color: #fff; font-size: 0.63rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .db-tpl-btn-buy:hover { opacity: 0.88; }
        .db-tpl-btn-buy:disabled { opacity: 0.5; cursor: not-allowed; }
        .db-tpl-btn-open { display: flex; align-items: center; justify-content: center; gap: 0.3rem; width: 100%; padding: 0.3rem 0.5rem; border-radius: 7px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text-muted); font-size: 0.63rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: all 0.15s; }
        .db-tpl-btn-open:hover { border-color: var(--accent); color: var(--accent); }
        .db-tpl-card-more { background: var(--bg-base); border-style: dashed; }
        .db-tpl-card-more:hover { border-color: var(--accent); }
        .db-tpl-more-inner { height: 100%; min-height: 90px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.35rem; color: var(--text-muted); font-size: 0.68rem; font-weight: 600; }

        /* Canva Connected Bar */
        .db-canva-connected-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.75rem; border-radius: 8px; background: rgba(34,197,94,0.07); border: 1px solid rgba(34,197,94,0.2); margin-bottom: 0.85rem; }
        .db-canva-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.6); animation: db-pulse 2s infinite; }
        @keyframes db-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

        /* Canva Grid */
        .db-canva-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.75rem; }
        .db-design-item { cursor: pointer; display: flex; flex-direction: column; gap: 0.4rem; }
        .db-design-thumb-wrapper { aspect-ratio: 16/10; border-radius: 10px; border: 1px solid var(--border); background: rgba(0,0,0,0.05); overflow: hidden; }
        .db-design-thumb { width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s; }
        .db-design-item:hover .db-design-thumb { transform: scale(1.04); }
        .db-design-title { font-size: 0.68rem; font-weight: 600; color: var(--text); margin: 0; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }

        /* Empty State */
        .db-empty-state-card { margin: auto; display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 280px; gap: 0.85rem; padding: 2rem 0; }
        .db-empty-icon-wrapper { width: 52px; height: 52px; border-radius: 50%; border: 1px dashed rgba(99,102,241,0.4); display: flex; align-items: center; justify-content: center; color: var(--accent); background: rgba(99,102,241,0.04); }
        .db-empty-text-wrap { display: flex; flex-direction: column; gap: 0.2rem; }
        .db-empty-title { font-size: 0.8rem; font-weight: 700; color: var(--text); margin: 0; }
        .db-empty-desc { font-size: 0.7rem; color: var(--text-muted); margin: 0; line-height: 1.4; }
        .db-empty-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
        .db-btn-primary { width: 100%; background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none; padding: 0.5rem 1rem; border-radius: 10px; font-size: 0.74rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.4rem; cursor: pointer; transition: all 0.2s ease; }
        .db-btn-primary:hover { background: var(--btn-cta-hover); }
        .db-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .db-btn-secondary { width: 100%; background: var(--btn-secondary-bg); color: var(--btn-secondary-text); border: 1px solid var(--btn-secondary-border); padding: 0.5rem 1rem; border-radius: 10px; font-size: 0.74rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.4rem; cursor: pointer; transition: all 0.2s ease; }
        .db-btn-secondary:hover { background: var(--btn-secondary-hover); }

        /* Stats Card */
        .db-stats-card { background: var(--card-bg); }
        .db-stats-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .db-stat-row { display: flex; align-items: center; justify-content: space-between; padding: 0.7rem 0.9rem; border-radius: 12px; border: 1px solid var(--border); background: var(--sidebar-bg); cursor: pointer; transition: all 0.15s; }
        .db-stat-row:hover { border-color: var(--accent); background: var(--card-bg); }
        .db-stat-left { display: flex; align-items: center; gap: 0.65rem; }
        .db-stat-icon-bg { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .db-stat-icon-bg.green { background: rgba(34,197,94,0.1); color: #22c55e; }
        .db-stat-icon-bg.purple { background: rgba(139,92,246,0.1); color: var(--accent); }
        .db-stat-icon-bg.orange { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .db-stat-icon-bg.blue { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .db-stat-label { font-size: 0.76rem; font-weight: 600; color: var(--text); }
        .db-stat-val { font-size: 0.85rem; font-weight: 800; }
        .db-stat-val.green-text { color: #22c55e; }
        .db-stat-val.purple-text { color: var(--accent); }
        .db-stat-val.orange-text { color: #f59e0b; }
        .db-stat-val.blue-text { color: #3b82f6; }

        /* Tip Bar */
        .db-tip-bar { background: rgba(99,102,241,0.05); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 0.75rem 1.25rem; display: flex; align-items: center; gap: 0.65rem; }
        .db-tip-bar--warning { background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.25); }
        .db-tip-icon { color: var(--accent); flex-shrink: 0; }
        .db-tip-icon--warning { color: #f59e0b; flex-shrink: 0; }
        .db-tip-text { font-size: 0.72rem; color: var(--text-muted); font-weight: 500; line-height: 1.4; flex: 1; }
        .db-tip-action-btn { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; font-size: 0.7rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .db-tip-action-btn:hover { background: rgba(245,158,11,0.2); border-color: rgba(245,158,11,0.5); }

        /* Utilities */
        .db-loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 160px; gap: 0.5rem; color: var(--text-muted); }
        .db-loading-text { font-size: 0.72rem; }
        .db-primary-color { color: var(--accent); }
        .db-spin { animation: db-spin-key 1s linear infinite; }
        @keyframes db-spin-key { to { transform: rotate(360deg); } }

        /* Responsive */
        @media (max-width: 900px) {
          .db-welcome-right { display: none; }
          .db-columns-layout { grid-template-columns: 1fr; }
          .db-hub-tabs { overflow-x: auto; padding: 0 1rem; scrollbar-width: none; }
        }
        @media (max-width: 600px) {
          .db-tpl-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
        }
      `}</style>
    </div>
  );
}
