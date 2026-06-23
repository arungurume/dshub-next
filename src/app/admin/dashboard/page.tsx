'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslateContext';
import { useDSStore } from '@/store/useDSStore';
import { 
  Palette, Grid, HelpCircle, Plus, ChevronDown, MapPin, 
  FileVideo, FolderHeart, Calendar, Monitor, ChevronRight, 
  Lightbulb, ArrowUpRight, Link2, Sparkles, Loader2, AlertCircle, Building2
} from 'lucide-react';
import { cmsApi, cmsApiV2, umsApi, setCookie } from '@/lib/api';
import { toast } from 'sonner';

interface CanvaDesign {
  id: string;
  title: string;
  thumbnailUrl: string;
  updatedAt?: string;
}

export default function DashboardMainPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const currentUser = useDSStore((state) => state.currentUser);
  const currentLocation = useDSStore((state) => state.currentLocation);
  const setCurrentLocation = useDSStore((state) => state.setCurrentLocation);
  
  // State
  const [switching, setSwitching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [stats, setStats] = useState({
    screensOnline: 0,
    scheduledToday: 0,
    playlists: 0,
    files: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Canva State
  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaDesigns, setCanvaDesigns] = useState<CanvaDesign[]>([]);
  const [canvaLoading, setCanvaLoading] = useState(true);
  const [canvaConnecting, setCanvaConnecting] = useState(false);

  const locations = currentUser?.organization?.locations || [];

  // Load stats and Canva status on mount
  useEffect(() => {
    const loadDashboardData = async () => {
      setStatsLoading(true);
      try {
        const [screensRes, playlistsRes, filesRes, schedulesRes] = await Promise.all([
          cmsApi.get('/sc/screen', { params: { page: 0, size: 500, includeLiveStatus: true } }).catch(() => ({ data: {} })),
          cmsApiV2.get('/pc/playlist', { params: { page: 0, size: 1 } }).catch(() => ({ data: {} })),
          cmsApi.get('/cc/content', { params: { page: 0, size: 1 } }).catch(() => ({ data: {} })),
          cmsApiV2.get('/scc/schedule', { params: { page: 0, size: 500 } }).catch(() => ({ data: {} })),
        ]);

        // Calculate Online Screens
        const screens = screensRes.data?.content || [];
        const onlineCount = screens.filter((s: any) => s.liveStatus === true).length;

        // Calculate Scheduled Today
        const schedules = schedulesRes.data?.content || [];
        const today = new Date();
        const activeSchedulesCount = schedules.filter((s: any) => {
          if (!s.startDate || !s.endDate) return false;
          const start = new Date(s.startDate);
          const end = new Date(s.endDate);
          return today >= start && today <= end;
        }).length;

        setStats({
          screensOnline: onlineCount,
          scheduledToday: activeSchedulesCount || schedules.length, // fallback to total schedules if date parsing mismatch
          playlists: playlistsRes.data?.totalElements || 0,
          files: filesRes.data?.totalElements || 0,
        });
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setStatsLoading(false);
      }
    };

    const checkCanvaStatus = async () => {
      setCanvaLoading(true);
      try {
        const profileRes = await cmsApi.get('/canva/profile');
        if (profileRes.status === 200 && profileRes.data) {
          setCanvaConnected(true);
          const designsRes = await cmsApi.get('/canva/designs', { params: { size: 4 } });
          setCanvaDesigns(designsRes.data?.designs || designsRes.data?.content || []);
        } else {
          setCanvaConnected(false);
        }
      } catch (err) {
        setCanvaConnected(false);
      } finally {
        setCanvaLoading(false);
      }
    };

    loadDashboardData();
    checkCanvaStatus();
  }, []);

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
      console.error('Switch location failed', err);
      toast.error('Failed to switch location', { id: toastId });
      setSwitching(false);
    }
  };

  const connectCanva = async () => {
    setCanvaConnecting(true);
    try {
      const { data } = await cmsApi.get('/canva/connect');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to connect to Canva');
      }
    } catch (err) {
      toast.error('Failed to connect to Canva');
    } finally {
      setCanvaConnecting(false);
    }
  };

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
              <div className="db-location-dropdown-wrapper">
                {locations.length === 0 ? (
                  <button
                    onClick={() => router.push('/admin/locations/0')}
                    className="db-location-add-btn"
                  >
                    + {t('DASHBOARD.add_location')}
                  </button>
                ) : (
                  <button
                    disabled={switching}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="db-location-trigger-btn"
                  >
                    {currentLocation?.name || t('DASHBOARD.select_location')}
                    <ChevronDown size={13} className={`db-chevron ${isDropdownOpen ? 'open' : ''}`} />
                  </button>
                )}

                {isDropdownOpen && (
                  <>
                    <div 
                      className="db-dropdown-overlay" 
                      onClick={() => setIsDropdownOpen(false)} 
                    />
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
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            router.push('/admin/locations/0');
                          }}
                          className="db-add-loc-btn"
                        >
                          <Plus size={12} />
                          <span>{t('DASHBOARD.add_location')}</span>
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
          <svg
            className="db-welcome-svg"
            width="320"
            height="160"
            viewBox="0 0 320 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Dot grid */}
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

            {/* Dot grid fill */}
            <rect width="320" height="160" fill="url(#dotGrid)" className="db-svg-dots" />

            {/* Diagonal accent lines */}
            <line x1="60" y1="-10" x2="-10" y2="80" stroke="url(#lineGrad)" strokeWidth="1.5" />
            <line x1="120" y1="-10" x2="20" y2="120" stroke="url(#lineGrad)" strokeWidth="1" />
            <line x1="200" y1="-10" x2="60" y2="170" stroke="url(#lineGrad)" strokeWidth="0.8" />
            <line x1="280" y1="-10" x2="160" y2="170" stroke="url(#lineGrad2)" strokeWidth="1.5" />
            <line x1="340" y1="10" x2="220" y2="170" stroke="url(#lineGrad2)" strokeWidth="1" />
            <line x1="340" y1="60" x2="260" y2="170" stroke="url(#lineGrad2)" strokeWidth="0.7" />

            {/* Horizontal accent lines */}
            <line x1="100" y1="40" x2="320" y2="40" stroke="var(--accent)" strokeWidth="0.6" opacity="0.2" />
            <line x1="80" y1="90" x2="320" y2="90" stroke="#a855f7" strokeWidth="0.6" opacity="0.2" />
            <line x1="120" y1="130" x2="320" y2="130" stroke="var(--accent)" strokeWidth="0.6" opacity="0.15" />

            {/* Glow blobs */}
            <ellipse cx="240" cy="55" rx="55" ry="55" fill="url(#glow1)" />
            <ellipse cx="290" cy="115" rx="40" ry="40" fill="url(#glow2)" />

            {/* Floating rings */}
            <circle cx="240" cy="55" r="30" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.4" />
            <circle cx="240" cy="55" r="48" stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.2" strokeDasharray="4 6" />
            <circle cx="290" cy="115" r="22" stroke="#a855f7" strokeWidth="1" fill="none" opacity="0.35" />
            <circle cx="290" cy="115" r="36" stroke="#a855f7" strokeWidth="0.5" fill="none" opacity="0.15" strokeDasharray="3 5" />

            {/* Small accent dots */}
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
          <div className="db-action-icon-wrapper purple">
            <FileVideo size={20} />
          </div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.upload_manage')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.upload_manage_desc')}</p>
          </div>
          <div className="db-action-arrow">
            <ChevronRight size={14} />
          </div>
        </div>

        <div className="db-action-card" onClick={() => router.push('/admin/playlists')}>
          <div className="db-action-icon-wrapper pink">
            <FolderHeart size={20} />
          </div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.create_playlist')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.create_playlist_desc')}</p>
          </div>
          <div className="db-action-arrow">
            <ChevronRight size={14} />
          </div>
        </div>

        <div className="db-action-card" onClick={() => router.push('/admin/schedules')}>
          <div className="db-action-icon-wrapper deep-purple">
            <Calendar size={20} />
          </div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.schedule_content')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.schedule_content_desc')}</p>
          </div>
          <div className="db-action-arrow">
            <ChevronRight size={14} />
          </div>
        </div>

        <div className="db-action-card" onClick={() => router.push('/admin/screens')}>
          <div className="db-action-icon-wrapper green">
            <Monitor size={20} />
          </div>
          <div className="db-action-text-wrapper">
            <h3 className="db-action-card-title">{t('DASHBOARD.manage_screens')}</h3>
            <p className="db-action-card-desc">{t('DASHBOARD.manage_screens_desc')}</p>
          </div>
          <div className="db-action-arrow">
            <ChevronRight size={14} />
          </div>
        </div>

      </div>

      {/* ── 3. TWO-COLUMN MAIN BODY ── */}
      <div className="db-columns-layout">
        
        {/* Canva Section (Left Column) */}
        <div className="db-card db-canva-card">
          <div className="db-card-header">
            <div>
              <h2 className="db-card-title">
                <Palette size={16} className="db-primary-color" />
                {t('DASHBOARD.my_canva_designs')}
              </h2>
              <p className="db-card-desc">
                {t('DASHBOARD.my_canva_designs_desc')}
              </p>
            </div>
            <button 
              onClick={() => router.push('/admin/templates')} 
              className="db-browse-templates-link"
            >
              {t('DASHBOARD.browse_templates')} <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="db-card-body">
            {canvaLoading ? (
              <div className="db-loading-state">
                <Loader2 className="db-spin db-primary-color" size={24} />
                <span className="db-loading-text">{t('DASHBOARD.loading_designs')}</span>
              </div>
            ) : canvaConnected && canvaDesigns.length > 0 ? (
              <div className="db-canva-grid">
                {canvaDesigns.map((design) => (
                  <div 
                    key={design.id} 
                    className="db-design-item"
                    onClick={() => router.push(`/admin/templates?designId=${design.id}`)}
                  >
                    <div className="db-design-thumb-wrapper">
                      <img src={design.thumbnailUrl} alt={design.title} className="db-design-thumb" />
                    </div>
                    <p className="db-design-title">{design.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="db-empty-state-card">
                <div className="db-empty-icon-wrapper">
                  <Palette size={24} />
                </div>
                <div className="db-empty-text-wrap">
                  <p className="db-empty-title">{t('DASHBOARD.no_designs_matched')}</p>
                  <p className="db-empty-desc">
                    {t('DASHBOARD.no_designs_matched_desc')}
                  </p>
                </div>
                <div className="db-empty-actions">
                  <button 
                    onClick={connectCanva} 
                    disabled={canvaConnecting} 
                    className="db-btn-primary"
                  >
                    {canvaConnecting ? <Loader2 className="db-spin" size={14} /> : <Link2 size={14} />}
                    {t('DASHBOARD.connect_canva_account')}
                  </button>
                  <button 
                    onClick={() => router.push('/admin/templates')} 
                    className="db-btn-secondary"
                  >
                    <Sparkles size={14} />
                    {t('DASHBOARD.browse_gallery')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats (Right Column) */}
        <div className="db-card db-stats-card">
          <div className="db-card-header no-border">
            <h2 className="db-card-title">{t('DASHBOARD.quick_stats')}</h2>
          </div>

          <div className="db-card-body">
            {statsLoading ? (
              <div className="db-loading-state">
                <Loader2 className="db-spin db-primary-color" size={24} />
              </div>
            ) : (
              <div className="db-stats-list">
                
                <div className="db-stat-row" onClick={() => router.push('/admin/screens')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg green">
                      <Monitor size={15} />
                    </div>
                    <span className="db-stat-label">{t('DASHBOARD.screens_online')}</span>
                  </div>
                  <span className="db-stat-val green-text">{stats.screensOnline}</span>
                </div>

                <div className="db-stat-row" onClick={() => router.push('/admin/schedules')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg purple">
                      <Calendar size={15} />
                    </div>
                    <span className="db-stat-label">{t('DASHBOARD.scheduled_today')}</span>
                  </div>
                  <span className="db-stat-val purple-text">{stats.scheduledToday}</span>
                </div>

                <div className="db-stat-row" onClick={() => router.push('/admin/playlists')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg orange">
                      <FolderHeart size={15} />
                    </div>
                    <span className="db-stat-label">{t('DASHBOARD.playlists')}</span>
                  </div>
                  <span className="db-stat-val orange-text">{stats.playlists}</span>
                </div>

                <div className="db-stat-row" onClick={() => router.push('/admin/content')}>
                  <div className="db-stat-left">
                    <div className="db-stat-icon-bg blue">
                      <FileVideo size={15} />
                    </div>
                    <span className="db-stat-label">{t('DASHBOARD.files')}</span>
                  </div>
                  <span className="db-stat-val blue-text">{stats.files}</span>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 4. TIP BAR BANNER ── */}
      {(!currentUser?.organization?.name || currentUser.organization.name === 'My Organization') ? (
        <div className="db-tip-bar db-tip-bar--warning">
          <Building2 size={16} className="db-tip-icon--warning" />
          <span className="db-tip-text">
            {t('DASHBOARD.org_info_warning')}
          </span>
          <button
            onClick={() => router.push('/admin/my-account?tab=organization')}
            className="db-tip-action-btn"
          >
            {t('DASHBOARD.update_org_info')}
          </button>
        </div>
      ) : (
        <div className="db-tip-bar">
          <Lightbulb size={16} className="db-tip-icon" />
          <span className="db-tip-text">
            {t('DASHBOARD.tip_bar_default')}
          </span>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .db-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 0 0.5rem;
        }

        /* 1. Welcome Card */
        .db-welcome-card {
          position: relative;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.06) 100%);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
          min-height: 180px;
        }
        .db-welcome-left {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          z-index: 2;
        }
        .db-welcome-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text);
          margin: 0;
          letter-spacing: -0.02em;
        }
        .db-location-context {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .db-location-label {
          font-weight: 500;
        }
        .db-location-loading {
          color: var(--accent);
          font-weight: 600;
        }
        .db-location-dropdown-wrapper {
          position: relative;
        }
        .db-location-add-btn {
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent);
          border: 1px solid rgba(99, 102, 241, 0.2);
          padding: 0.2rem 0.65rem;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .db-location-add-btn:hover {
          background: rgba(99, 102, 241, 0.18);
        }
        .db-location-trigger-btn {
          background: none;
          border: none;
          color: var(--accent);
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
        }
        .db-location-trigger-btn:hover {
          background: rgba(99, 102, 241, 0.05);
        }
        .db-chevron {
          transition: transform 0.2s;
        }
        .db-chevron.open {
          transform: rotate(180deg);
        }
        .db-dropdown-overlay {
          position: fixed;
          inset: 0;
          z-index: 10;
        }
        .db-location-dropdown {
          position: absolute;
          left: 0;
          top: calc(100% + 6px);
          width: 220px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          z-index: 20;
          padding: 0.35rem 0;
          animation: db-dropdown-anim 0.15s ease-out;
        }
        @keyframes db-dropdown-anim {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .db-dropdown-header {
          font-size: 0.65rem;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          padding: 0.45rem 1rem;
          margin: 0;
        }
        .db-dropdown-list {
          max-height: 200px;
          overflow-y: auto;
        }
        .db-dropdown-item {
          width: 100%;
          border: none;
          background: none;
          padding: 0.5rem 1rem;
          font-size: 0.78rem;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }
        .db-dropdown-item:hover {
          background: var(--sidebar-hover);
        }
        .db-dropdown-item.active {
          color: var(--accent);
          font-weight: 700;
          background: rgba(99, 102, 241, 0.04);
        }
        .db-dropdown-icon {
          color: var(--text-muted);
          opacity: 0.7;
        }
        .db-dropdown-item.active .db-dropdown-icon {
          color: var(--accent);
          opacity: 1;
        }
        .db-dropdown-footer {
          border-top: 1px solid var(--border);
          margin-top: 0.35rem;
          padding: 0.35rem 0.5rem 0;
        }
        .db-add-loc-btn {
          width: 100%;
          background: none;
          border: none;
          color: var(--accent);
          font-weight: 600;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.5rem;
          cursor: pointer;
          border-radius: 8px;
        }
        .db-add-loc-btn:hover {
          background: var(--sidebar-hover);
        }

        .db-welcome-right {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 340px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          pointer-events: none;
          overflow: hidden;
          border-radius: 0 20px 20px 0;
        }
        .db-welcome-svg {
          width: 100%;
          height: 100%;
          color: var(--text-muted);
        }
        .db-svg-dots {
          color: var(--text-muted);
        }

        /* 2. Action Grid */
        .db-action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }
        .db-action-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .db-action-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.05);
        }
        .db-action-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .db-action-icon-wrapper.purple { background: rgba(99, 102, 241, 0.1); color: var(--accent); }
        .db-action-icon-wrapper.pink { background: rgba(236, 72, 153, 0.1); color: #ec4899; }
        .db-action-icon-wrapper.deep-purple { background: rgba(139, 92, 246, 0.1); color: var(--accent); }
        .db-action-icon-wrapper.green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        
        .db-action-text-wrapper {
          flex: 1;
          overflow: hidden;
        }
        .db-action-card-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.15rem;
        }
        .db-action-card-desc {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.3;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .db-action-arrow {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .db-action-card:hover .db-action-arrow {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
          transform: translateX(1px);
        }

        /* 3. Columns Layout */
        .db-columns-layout {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 1.5rem;
        }
        .db-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .db-card-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }
        .db-card-header.no-border {
          border-bottom: none;
        }
        .db-card-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .db-card-desc {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin: 0.25rem 0 0;
        }
        .db-browse-templates-link {
          background: none;
          border: none;
          color: var(--accent);
          font-size: 0.75rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          padding: 0;
        }
        .db-browse-templates-link:hover {
          text-decoration: underline;
        }

        .db-card-body {
          flex: 1;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }

        /* Canva Section Details */
        .db-canva-card {
          min-height: 320px;
        }
        .db-canva-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 1rem;
        }
        .db-design-item {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .db-design-thumb-wrapper {
          aspect-ratio: 16 / 10;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .db-design-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.2s;
        }
        .db-design-item:hover .db-design-thumb {
          transform: scale(1.04);
        }
        .db-design-title {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text);
          margin: 0;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        .db-empty-state-card {
          margin: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 320px;
          gap: 1rem;
          padding: 2rem 0;
        }
        .db-empty-icon-wrapper {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 1px dashed rgba(99, 102, 241, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          background: rgba(99, 102, 241, 0.04);
        }
        .db-empty-text-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .db-empty-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }
        .db-empty-desc {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }
        .db-empty-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .db-btn-primary {
          width: 100%;
          background: var(--btn-cta-bg);
          color: var(--btn-cta-text);
          border: none;
          padding: 0.55rem 1rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: all 0.2s ease;
        }
        .db-btn-primary:hover { background: var(--btn-cta-hover); }
        .db-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .db-btn-secondary {
          width: 100%;
          background: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
          border: 1px solid var(--btn-secondary-border);
          padding: 0.55rem 1rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .db-btn-secondary:hover { background: var(--btn-secondary-hover); }

        /* Stats Column Details */
        .db-stats-card {
          background: var(--card-bg);
        }
        .db-stats-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .db-stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--sidebar-bg);
          cursor: pointer;
          transition: all 0.15s;
        }
        .db-stat-row:hover {
          border-color: var(--accent);
          background: var(--card-bg);
        }
        .db-stat-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .db-stat-icon-bg {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .db-stat-icon-bg.green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .db-stat-icon-bg.purple { background: rgba(139, 92, 246, 0.1); color: var(--accent); }
        .db-stat-icon-bg.orange { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .db-stat-icon-bg.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .db-stat-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text);
        }
        .db-stat-val {
          font-size: 0.85rem;
          font-weight: 800;
        }
        .db-stat-val.green-text { color: #22c55e; }
        .db-stat-val.purple-text { color: var(--accent); }
        .db-stat-val.orange-text { color: #f59e0b; }
        .db-stat-val.blue-text { color: #3b82f6; }

        /* 4. Tip Bar */
        .db-tip-bar {
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 12px;
          padding: 0.75rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }
        .db-tip-bar--warning {
          background: rgba(245, 158, 11, 0.06);
          border-color: rgba(245, 158, 11, 0.25);
        }
        .db-tip-icon {
          color: var(--accent);
          flex-shrink: 0;
        }
        .db-tip-icon--warning {
          color: #f59e0b;
          flex-shrink: 0;
        }
        .db-tip-text {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
          line-height: 1.4;
          flex: 1;
        }
        .db-tip-action-btn {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.3rem 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .db-tip-action-btn:hover {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.5);
        }

        /* Loading / Spin */
        .db-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 180px;
          gap: 0.5rem;
          color: var(--text-muted);
        }
        .db-loading-text {
          font-size: 0.72rem;
        }
        .db-primary-color {
          color: var(--accent);
        }
        .db-spin {
          animation: db-spin-key 1s linear infinite;
        }
        @keyframes db-spin-key {
          to { transform: rotate(360deg); }
        }

        /* Responsive Layout */
        @media (max-width: 900px) {
          .db-welcome-right {
            display: none;
          }
          .db-columns-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
