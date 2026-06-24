'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus, ChevronLeft, ChevronRight, Eye, Edit2,
  Sparkles, ImageIcon,
  Search, X, Link2, Link2Off, RefreshCw, User
} from 'lucide-react';
import { cmsApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { Suspense } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
  id: number | string;
  templateName?: string;
  name?: string;
  title?: string;
  featuredImage?: string;
  fullImage?: string;
  thumbLink?: string;
  editUrl?: string;
  templateUrl?: string;
  isVertical?: boolean;
  type?: string;
  size?: string;
  images?: { id?: number; url: string }[];
}

interface CanvaDesign {
  id: string;
  title?: string;
  thumbnail?: { url: string };
  urls?: { edit_url?: string };
}

interface TagSection {
  name: string;
  slug: string;
  templates: Template[];
  loading: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function templateImg(t: Template): string {
  // CMS templates: images[] is the primary source
  if (t.images && t.images.length > 0 && t.images[0].url) return t.images[0].url;
  return t.fullImage || t.featuredImage || t.thumbLink || '';
}

function templateName(t: Template): string {
  return t.templateName || t.name || t.title || 'Untitled';
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onView, compact = false }: {
  template: Template;
  onView: (t: Template) => void;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const img = templateImg(template);
  const name = templateName(template);

  return (
    <div
      className="canvas-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        position: 'relative',
        breakInside: 'avoid',
        marginBottom: compact ? 0 : 14,
        transition: 'transform 0.18s, box-shadow 0.18s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.08)',
        flexShrink: 0,
        width: compact ? 220 : undefined,
      }}
      onClick={() => onView(template)}
    >
      <div style={{ position: 'relative', background: 'var(--bg-base)', minHeight: compact ? 140 : 160 }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={name}
            style={{ width: '100%', height: compact ? 140 : undefined, display: 'block', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{ height: compact ? 140 : 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: hovered ? 1 : 0, transition: 'opacity 0.18s', backdropFilter: 'blur(2px)',
        }}>
          <button onClick={(e) => { e.stopPropagation(); onView(template); }} style={{
            padding: '7px 18px', borderRadius: 20, border: 'none', background: '#fff',
            color: '#111', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Eye size={13} /> {t('TEMPLATES.view', 'View')}
          </button>
          {template.editUrl && (
            <a href={template.editUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <button style={{
                padding: '7px 18px', borderRadius: 20, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700,
                fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Edit2 size={13} /> {t('TEMPLATES.edit', 'Edit')}
              </button>
            </a>
          )}
        </div>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </p>
        {!compact && (
          <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {template.type || 'Image'} · {template.size || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Canva Design Card ────────────────────────────────────────────────────────

function CanvaDesignCard({ design, onClick }: { design: CanvaDesign; onClick: () => void }) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const thumb = design.thumbnail?.url;
  const title = design.title || 'Untitled Design';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        position: 'relative',
        breakInside: 'avoid',
        marginBottom: 14,
        transition: 'transform 0.18s, box-shadow 0.18s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ position: 'relative', background: 'var(--bg-base)', minHeight: 160 }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={title}
            style={{ width: '100%', display: 'block', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.18s', backdropFilter: 'blur(2px)',
        }}>
          <button style={{
            padding: '7px 18px', borderRadius: 20, border: 'none', background: '#fff',
            color: '#111', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Eye size={13} /> {t('TEMPLATES.view_details', 'View Details')}
          </button>
        </div>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t('TEMPLATES.canva_design', 'Canva Design')}</p>
      </div>
    </div>
  );
}

// ─── Tag Row ──────────────────────────────────────────────────────────────────

function TagRow({ section, onView }: { section: TagSection; onView: (t: Template) => void }) {
  const { t } = useLanguage();
  const rowRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    rowRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{section.name}</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => scroll('left')} style={arrowBtn}><ChevronLeft size={14} /></button>
          <button onClick={() => scroll('right')} style={arrowBtn}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div ref={rowRef} style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {section.loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ flexShrink: 0, width: 220, height: 180, borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))
        ) : section.templates.length === 0 ? (
          <div style={{ padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{t('TEMPLATES.coming_soon', 'Coming soon…')}</div>
        ) : (
          section.templates.map((t) => (
            <TemplateCard key={t.id} template={t} onView={onView} compact />
          ))
        )}
      </div>
    </section>
  );
}

const arrowBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

function TemplatesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  // Tab state: 'dshub' = DSHub Canvas, 'canva' = My Canva Designs
  const [mainTab, setMainTab] = useState<'canva' | 'dshub'>('dshub');

  // ── Canva OAuth state ──────────────────────────────────────────────────────
  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaProfile, setCanvaProfile] = useState<any>(null);
  const [canvaDesigns, setCanvaDesigns] = useState<CanvaDesign[]>([]);
  const [canvaLoading, setCanvaLoading] = useState(false); // starts false — lazy loaded
  const [canvaLoaded, setCanvaLoaded] = useState(false);   // tracks first-load done
  const [canvaConnecting, setCanvaConnecting] = useState(false);
  const [canvaDisconnecting, setCanvaDisconnecting] = useState(false);

  // ── DSHub Canvas state ─────────────────────────────────────────────────────
  const [dshubTemplates, setDshubTemplates] = useState<Template[]>([]);
  const [dshubLoading, setDshubLoading] = useState(false);
  const [dshubPage, setDshubPage] = useState(0);
  const [dshubHasMore, setDshubHasMore] = useState(true);
  const [dshubLoadingMore, setDshubLoadingMore] = useState(false);
  // kept for backwards-compat, unused now
  const [tagSections] = useState<TagSection[]>([]);

  const [search, setSearch] = useState('');
  const topRef = useRef<HTMLDivElement>(null);

  // ── Handle OAuth callback AND seed Canva tab from cache on OAuth return ────
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast.success('Canva account connected successfully!');
      router.replace('/templates');
      // Force-reload Canva data (bypass cache) after OAuth
      setMainTab('canva');
      loadCanvaData(true);
    }
    // Do NOT load Canva data on mount — lazy load when tab is clicked
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canva: load profile + designs in parallel, with sessionStorage cache ───
  const CACHE_KEY = 'canva_cache';

  const loadCanvaData = useCallback(async (force = false) => {
    // Return from session cache unless forced (e.g. after connect/refresh)
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { profile, designs, connected } = JSON.parse(cached);
          setCanvaProfile(profile);
          setCanvaDesigns(designs || []);
          setCanvaConnected(connected);
          setCanvaLoaded(true);
          return;
        }
      } catch { /* ignore malformed cache */ }
    }

    setCanvaLoading(true);
    try {
      // Fetch profile and designs in parallel
      const [profileRes, designsRes] = await Promise.allSettled([
        cmsApi.get('/canva/profile'),
        cmsApi.get('/canva/designs'),
      ]);

      const profileData = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
      const designsData = designsRes.status === 'fulfilled' ? designsRes.value.data : null;

      const isConnected = !!profileData?.profile;
      const profile = profileData?.profile ?? null;
      const designs: CanvaDesign[] = designsData?.items || [];

      setCanvaConnected(isConnected);
      setCanvaProfile(profile);
      setCanvaDesigns(isConnected ? designs : []);

      // Write to session cache
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          profile, designs: isConnected ? designs : [], connected: isConnected,
        }));
      } catch { /* storage full — skip caching */ }
    } catch {
      setCanvaConnected(false);
    } finally {
      setCanvaLoading(false);
      setCanvaLoaded(true);
    }
  }, []);

  // Kept for manual refresh button
  const loadCanvaDesigns = useCallback(() => loadCanvaData(true), [loadCanvaData]);


  const connectCanva = async () => {
    setCanvaConnecting(true);
    try {
      const { data } = await cmsApi.get('/canva/connect');
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast.error('Could not initiate Canva connection');
        setCanvaConnecting(false);
      }
    } catch {
      toast.error('Failed to connect to Canva');
      setCanvaConnecting(false);
    }
  };

  const disconnectCanva = async () => {
    setCanvaDisconnecting(true);
    try {
      const { data } = await cmsApi.delete('/canva/disconnect');
      if (data?.success) {
        setCanvaConnected(false);
        setCanvaProfile(null);
        setCanvaDesigns([]);
        setCanvaLoaded(false);
        try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
        toast.success('Canva account disconnected');
      } else {
        toast.error('Failed to disconnect Canva account');
      }
    } catch {
      toast.error('Failed to disconnect Canva account');
    } finally {
      setCanvaDisconnecting(false);
    }
  };



  // ── DSHub Canvas templates from CMS ───────────────────────────────────────
  const loadDshubTemplates = useCallback(async (page = 0) => {
    if (page === 0) setDshubLoading(true);
    else setDshubLoadingMore(true);
    try {
      const { data } = await cmsApi.get('/ctc/templates', { params: { page, size: 24 } });
      const items: Template[] = data?.content || (Array.isArray(data) ? data : []);
      const totalPages: number = data?.totalPages ?? 1;
      if (page === 0) {
        setDshubTemplates(items);
      } else {
        setDshubTemplates((prev) => [...prev, ...items]);
      }
      setDshubPage(page);
      setDshubHasMore(page + 1 < totalPages);
    } catch {
      toast.error('Failed to load DSHub templates');
    } finally {
      setDshubLoading(false);
      setDshubLoadingMore(false);
    }
  }, []);

  // ── Lazy-load Canva data when tab is first opened ─────────────────────────
  useEffect(() => {
    if (mainTab !== 'canva') return;
    if (canvaLoaded) return; // already loaded (or loading)
    loadCanvaData(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab]);

  // ── Load DSHub templates when tab is first opened ─────────────────────────
  useEffect(() => {
    if (mainTab !== 'dshub') return;
    if (dshubTemplates.length > 0) return;
    loadDshubTemplates(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab]);


  const openTemplate = (template: Template) => {
    if (template.id) router.push(`/templates/${template.id}`);
  };



  const filteredCanva = canvaDesigns.filter(
    (d) => !search || (d.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>

      {/* ── Top sticky bar ──────────────────────────────────────────────── */}
      <div
        ref={topRef}
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--sidebar-bg)',
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
        }}
      >
        {/* Main tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingTop: 16 }}>
          {[
            { id: 'dshub', icon: <Sparkles size={15} />, label: t('TEMPLATES.tab_dshub_canvas') },
            { id: 'canva', icon: <Link2 size={15} />, label: t('TEMPLATES.tab_my_canva_designs') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: mainTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: mainTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: mainTab === tab.id ? 700 : 500, fontSize: '0.85rem', transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('TEMPLATES.search_placeholder')}
              style={{
                paddingLeft: 30, paddingRight: search ? 28 : 12, paddingTop: 7, paddingBottom: 7,
                borderRadius: 10, fontSize: '0.78rem', background: 'var(--input-bg)',
                border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', width: 200,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>





        {/* Canva tab header actions */}
        {mainTab === 'canva' && canvaConnected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12, paddingTop: 8, gap: 8 }}>
            {/* Connected pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px 6px 8px', borderRadius: 40,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem',
              }}>
                {canvaProfile?.display_name?.charAt(0)?.toUpperCase() || <User size={14} />}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
                {canvaProfile?.display_name || t('TEMPLATES.connected')}
              </span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <button
              onClick={() => loadCanvaDesigns()}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600,
              }}
            >
              <RefreshCw size={13} /> {t('TEMPLATES.refresh')}
            </button>
            <button
              onClick={disconnectCanva}
              disabled={canvaDisconnecting}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.06)', color: 'var(--destructive, #ef4444)',
                cursor: canvaDisconnecting ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem', fontWeight: 600, opacity: canvaDisconnecting ? 0.6 : 1,
              }}
            >
              <Link2Off size={13} /> {canvaDisconnecting ? t('TEMPLATES.disconnecting') : t('TEMPLATES.disconnect')}
            </button>
          </div>
        )}
      </div>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 40px' }}>

        {/* MY CANVA DESIGNS */}
        {mainTab === 'canva' && (
          <>
            {canvaLoading ? (
              <div style={{ columns: 'auto 220px', columnGap: 14 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{
                    breakInside: 'avoid', marginBottom: 14,
                    height: 180 + (i % 3) * 40, borderRadius: 14,
                    background: 'var(--card-bg)', border: '1px solid var(--border)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                ))}
              </div>
            ) : !canvaConnected ? (
              /* ── Not connected state ── */
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '80px 24px', textAlign: 'center',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20, marginBottom: 24,
                  background: 'linear-gradient(135deg, var(--btn-cta-bg), #475569)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                }}>
                  <Link2 size={32} color="#fff" />
                </div>
                <h2 style={{ margin: '0 0 10px', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>
                  {t('TEMPLATES.no_canva_connected')}
                </h2>
                <p style={{ margin: '0 0 32px', fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
                  {t('TEMPLATES.connect_canva_desc')}
                </p>
                <button
                  onClick={connectCanva}
                  disabled={canvaConnecting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 28px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, var(--btn-cta-bg), #475569)', color: '#fff',
                    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)', transition: 'all 0.2s',
                  }}
                >
                  {canvaConnecting ? <RefreshCw size={16} className="spin" /> : <Link2 size={16} />}
                  {canvaConnecting ? t('TEMPLATES.connecting') : t('DASHBOARD.connect_canva_account')}
                </button>
              </div>
            ) : filteredCanva.length === 0 ? (
              /* ── Connected but no designs ── */
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
                <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ fontSize: '0.9rem', margin: 0 }}>{t('TEMPLATES.no_designs_found')}</p>
                <button
                  onClick={loadCanvaDesigns}
                  style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <RefreshCw size={13} /> {t('TEMPLATES.refresh_designs')}
                </button>
              </div>
            ) : (
              /* ── Designs grid ── */
              <div style={{ columns: 'auto 220px', columnGap: 14 }}>
                {filteredCanva.map((design) => (
                  <CanvaDesignCard
                    key={design.id}
                    design={design}
                    onClick={() => router.push(`/templates/canva/${design.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}



        {/* DSHUB CANVAS */}
        {mainTab === 'dshub' && (
          dshubLoading ? (
            <div style={{ columns: 'auto 220px', columnGap: 14 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{
                  breakInside: 'avoid', marginBottom: 14, height: 180 + (i % 3) * 40,
                  borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--border)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          ) : dshubTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
              <Sparkles size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p style={{ fontSize: '0.9rem', margin: 0 }}>No DSHub templates available yet.</p>
              <button
                onClick={() => loadDshubTemplates(0)}
                style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : (
            <>
              <div style={{ columns: 'auto 220px', columnGap: 14 }}>
                {dshubTemplates
                  .filter((tpl) => !search || templateName(tpl).toLowerCase().includes(search.toLowerCase()))
                  .map((tpl) => (
                    <TemplateCard key={tpl.id} template={tpl} onView={openTemplate} />
                  ))}
              </div>
              {dshubHasMore && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <button
                    onClick={() => loadDshubTemplates(dshubPage + 1)}
                    disabled={dshubLoadingMore}
                    style={{
                      padding: '9px 28px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--card-bg)', color: 'var(--text)', cursor: dshubLoadingMore ? 'not-allowed' : 'pointer',
                      fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
                      opacity: dshubLoadingMore ? 0.6 : 1,
                    }}
                  >
                    {dshubLoadingMore ? <RefreshCw size={13} className="spin" /> : <Plus size={13} />}
                    {dshubLoadingMore ? 'Loading…' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )
        )}

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        div[style*="overflow-x: auto"]::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading…</div>}>
      <TemplatesPageInner />
    </Suspense>
  );
}
