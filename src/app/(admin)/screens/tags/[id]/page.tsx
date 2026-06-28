'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Tag, ArrowLeft, RefreshCw, Monitor, MapPin, Wifi, WifiOff,
  Calendar, Layers, Film, Image as ImageIcon, X, Search, Check, ChevronRight
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { useSocketContext } from '@/context/SocketContext';
import { useLanguage } from '@/context/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Screen {
  id: string;
  name: string;
  placedAt?: string;
  deviceType: number;
  status: 'LIVE' | 'READY_TO_USE' | 'OFFLINE';
  selectedScheduleId?: number;
  defaultShowAssetType?: string;
  defaultShowAssetId?: string;
  defaultShowAssetName?: string;
}

interface ScreenGroup {
  id: number;
  name: string;
  scheduleId?: number;
}

type ContentTab = 'SCHEDULE' | 'PLAYLIST' | 'MEDIA' | 'NONE';

interface AssetItem {
  id: string | number;
  name: string;
  thumbLink?: string;
  contentType?: string;
}

const DEVICE_TYPE_MAP: Record<number, string> = {
  1: 'Android', 2: 'Fire TV', 3: 'Web Player', 4: 'Roku OS', 99: 'Unknown',
};

const TAB_META: Record<ContentTab, { label: string; icon: React.ReactNode; desc: string }> = {
  SCHEDULE: { label: 'Schedule',  icon: <Calendar size={15} />, desc: 'Run timed content blocks — content switches automatically based on the schedule.' },
  PLAYLIST: { label: 'Playlist',  icon: <Layers size={15} />,   desc: 'Loop a playlist on all screens continuously.' },
  MEDIA:    { label: 'Image / Video', icon: <Film size={15} />, desc: 'Play a single image or video file on loop.' },
  NONE:     { label: 'None',      icon: <X size={15} />,        desc: 'Clear all content and schedule assignments from this tag\'s screens.' },
};

// Derive the active tab from what the screens are currently playing
function inferActiveTab(screens: Screen[]): ContentTab {
  if (!screens.length) return 'NONE';
  const first = screens[0];
  if (first.selectedScheduleId && first.selectedScheduleId > 0) return 'SCHEDULE';
  if (first.defaultShowAssetType === 'PLAYLIST') return 'PLAYLIST';
  if (first.defaultShowAssetType === 'MEDIA') return 'MEDIA';
  return 'NONE';
}

function inferCurrentAsset(screens: Screen[], tab: ContentTab): { id: string; name: string } | null {
  if (!screens.length) return null;
  const first = screens[0];
  if (tab === 'SCHEDULE' && first.selectedScheduleId && first.selectedScheduleId > 0) {
    return { id: String(first.selectedScheduleId), name: '' };
  }
  if ((tab === 'PLAYLIST' || tab === 'MEDIA') && first.defaultShowAssetId && first.defaultShowAssetId !== '0') {
    return { id: first.defaultShowAssetId, name: first.defaultShowAssetName || '' };
  }
  return null;
}

// ─── Asset Picker (schedule / playlist / media) ───────────────────────────────

function AssetPicker({
  tab,
  currentId,
  onPick,
  disabled,
}: {
  tab: ContentTab;
  currentId?: string;
  onPick: (id: string, name: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (tab === 'NONE') { setItems([]); return; }
    setLoading(true);
    try {
      if (tab === 'SCHEDULE') {
        const { data } = await cmsApiV2.get('/scc/schedule', { params: { page: 0, size: 200, sortBy: 'updatedDate', sortOrder: 'DESC' } });
        const list = (data?.content || []).map((s: any) => ({ id: s.id, name: s.name }));
        setItems(list);
      } else if (tab === 'PLAYLIST') {
        const params: any = { page: 0, size: 200, sortBy: 'updatedDate', sortOrder: 'DESC' };
        if (search.trim()) params.q = search.trim();
        const { data } = await cmsApiV2.get('/pc/playlist', { params });
        setItems((data?.content || []).map((p: any) => ({ id: p.id, name: p.name, thumbLink: p.thumbLink })));
      } else if (tab === 'MEDIA') {
        const params: any = { page: 0, size: 100, sortBy: 'updatedDate', sortOrder: 'DESC' };
        if (search.trim()) params.keyword = search.trim();
        const { data } = await cmsApi.get('/cc/content', { params });
        const all = (data?.content || []).filter((c: any) => ['IMAGE', 'VIDEO', 'FILE'].includes(c.contentType));
        setItems(all.map((c: any) => ({ id: c.id, name: c.name, thumbLink: c.thumbLink, contentType: c.contentType })));
      }
    } catch {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  if (tab === 'NONE') return null;

  return (
    <div className="picker-wrap">
      <div className="picker-search-row">
        <Search size={13} className="picker-search-ic" />
        <input
          className="picker-search"
          placeholder={`Search ${TAB_META[tab].label.toLowerCase()}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={disabled}
        />
        {loading && <RefreshCw size={13} className="spin" style={{ flexShrink: 0 }} />}
      </div>
      <div className="picker-list">
        {!loading && items.length === 0 && (
          <p className="picker-empty">No {TAB_META[tab].label.toLowerCase()} found</p>
        )}
        {items.map(item => {
          const active = String(item.id) === String(currentId);
          return (
            <div
              key={item.id}
              className={`picker-row ${active ? 'picker-row-active' : ''} ${disabled ? 'picker-row-disabled' : ''}`}
              onClick={() => !disabled && onPick(String(item.id), item.name)}
            >
              {item.thumbLink ? (
                <img src={item.thumbLink} alt={item.name} className="picker-thumb" />
              ) : (
                <div className="picker-thumb-ph">
                  {tab === 'SCHEDULE' ? <Calendar size={14} /> : tab === 'PLAYLIST' ? <Layers size={14} /> : <Film size={14} />}
                </div>
              )}
              <div className="picker-item-info">
                <span className="picker-item-name">{item.name}</span>
                {item.contentType && (
                  <span className="picker-item-type">{item.contentType}</span>
                )}
              </div>
              {active && <Check size={15} className="picker-check" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScreenTagDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { socket } = useSocketContext();
  const { t } = useLanguage();

  const [tag, setTag] = useState<ScreenGroup | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const [activeTab, setActiveTab] = useState<ContentTab>('NONE');
  const [selectedId, setSelectedId] = useState('');
  const [selectedName, setSelectedName] = useState('');

  // Load tag + screens
  useEffect(() => {
    setLoading(true);
    Promise.all([
      cmsApi.get(`/sc/screen-group/${id}`),
      cmsApi.get(`/sc/screen-group/${id}/screens`),
    ]).then(([tagRes, screensRes]) => {
      setTag(tagRes.data);
      const mapped: Screen[] = (screensRes.data || []).map((s: any) => ({
        ...s,
        status: s.status === 'LIVE' ? 'LIVE' : 'READY_TO_USE',
      }));
      setScreens(mapped);

      // Infer current assignment from screens
      const tab = inferActiveTab(mapped);
      setActiveTab(tab);
      const current = inferCurrentAsset(mapped, tab);
      if (current) {
        setSelectedId(current.id);
        setSelectedName(current.name);
      }
    }).catch(() => {
      toast.error('Failed to load tag details');
    }).finally(() => setLoading(false));
  }, [id]);

  // Real-time socket status
  useEffect(() => {
    if (!socket) return;
    const handleStatus = (data: { screenId: string; online: boolean }) => {
      setScreens(prev => prev.map(s =>
        String(s.id) === String(data.screenId)
          ? { ...s, status: data.online ? 'LIVE' : 'READY_TO_USE' }
          : s
      ));
    };
    socket.on('screen_status', handleStatus);
    socket.on('client_connected', (d: any) => handleStatus({ screenId: d.screenId, online: true }));
    socket.on('client_disconnected', (d: any) => handleStatus({ screenId: d.screenId, online: false }));
    return () => {
      socket.off('screen_status', handleStatus);
      socket.off('client_connected');
      socket.off('client_disconnected');
    };
  }, [socket]);

  function handleTabChange(tab: ContentTab) {
    setActiveTab(tab);
    setSelectedId('');
    setSelectedName('');
  }

  async function handleAssign(assetId: string, assetName: string) {
    setSelectedId(assetId);
    setSelectedName(assetName);
    setAssigning(true);
    try {
      await cmsApi.put(`/sc/screen-group/${id}/assign-content`, null, {
        params: {
          assetType: activeTab,
          assetId,
          assetName,
        },
      });
      toast.success(`${TAB_META[activeTab].label} assigned to all screens in this tag`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to assign content');
      setSelectedId('');
      setSelectedName('');
    } finally {
      setAssigning(false);
    }
  }

  async function handleClear() {
    setAssigning(true);
    try {
      await cmsApi.put(`/sc/screen-group/${id}/assign-content`, null, {
        params: { assetType: 'NONE', assetId: '0', assetName: '' },
      });
      setActiveTab('NONE');
      setSelectedId('');
      setSelectedName('');
      toast.success('Content cleared from all screens in this tag');
    } catch {
      toast.error('Failed to clear content');
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="detail-loading">
        <RefreshCw size={24} className="spin" />
        <span>Loading tag…</span>
      </div>
    );
  }

  const currentAssetLabel =
    activeTab !== 'NONE' && selectedName
      ? selectedName
      : activeTab !== 'NONE' && selectedId
      ? `ID: ${selectedId}`
      : null;

  return (
    <div className="tag-detail-page">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="back-btn" onClick={() => router.push('/screens/tags')} id="back-to-tags">
            <ArrowLeft size={16} />
          </button>
          <div className="tag-icon-wrap"><Tag size={18} /></div>
          <div>
            <h1 className="page-title">{tag?.name || 'Tag Details'}</h1>
            <p className="page-sub">{screens.length} screen{screens.length !== 1 ? 's' : ''} in this tag</p>
          </div>
        </div>
        {activeTab !== 'NONE' && selectedId && (
          <button className="btn-ghost-sm" onClick={handleClear} disabled={assigning} id="clear-tag-content">
            <X size={13} /> Clear assignment
          </button>
        )}
      </div>

      <div className="detail-layout">
        {/* ── Left: Content Assignment Panel ────────────────── */}
        <div className="settings-panel">
          <div className="panel-hd">
            <h3 className="section-title">What to play</h3>
            <p className="section-desc">
              Select what all screens in this tag should display.
              Your choice is pushed to every screen instantly.
            </p>
          </div>

          {/* Current assignment badge */}
          {currentAssetLabel && (
            <div className="current-badge">
              {TAB_META[activeTab].icon}
              <span className="current-badge-label">Currently: <strong>{currentAssetLabel}</strong></span>
              {assigning && <RefreshCw size={11} className="spin" style={{ marginLeft: 'auto' }} />}
            </div>
          )}

          {/* Content type tabs */}
          <div className="content-tabs">
            {(Object.keys(TAB_META) as ContentTab[]).map(tab => (
              <button
                key={tab}
                className={`ct-tab ${activeTab === tab ? 'ct-tab-active' : ''}`}
                onClick={() => handleTabChange(tab)}
                disabled={assigning}
                id={`tab-${tab.toLowerCase()}`}
              >
                {TAB_META[tab].icon}
                <span>{TAB_META[tab].label}</span>
                {activeTab === tab && selectedId && <span className="ct-dot" />}
              </button>
            ))}
          </div>

          {/* Tab description */}
          <p className="tab-desc">{TAB_META[activeTab].desc}</p>

          {/* None confirmation */}
          {activeTab === 'NONE' && (
            <div className="none-confirm">
              <p>This will remove any schedule, playlist, or media assignment from all screens in this tag.</p>
              <button
                className="btn-danger-sm"
                onClick={handleClear}
                disabled={assigning}
                id="confirm-clear-tag"
              >
                {assigning ? <RefreshCw size={13} className="spin" /> : <X size={13} />}
                Clear all screens
              </button>
            </div>
          )}

          {/* Asset picker */}
          {activeTab !== 'NONE' && (
            <AssetPicker
              tab={activeTab}
              currentId={selectedId}
              onPick={handleAssign}
              disabled={assigning}
            />
          )}
        </div>

        {/* ── Right: Screens grid ───────────────────────────── */}
        <div className="screens-panel">
          <div className="screens-header">
            <h3 className="section-title">Screens in this tag</h3>
            <span className="count-pill">{screens.length}</span>
          </div>

          {screens.length === 0 ? (
            <div className="screens-empty">
              <Monitor size={36} opacity={0.15} />
              <h4>No screens tagged yet</h4>
              <p>Go to a screen's settings and assign it to this tag to see it here.</p>
              <button className="btn-secondary" onClick={() => router.push('/screens')} id="empty-view-screens">
                View screens <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div className="screens-grid">
              {screens.map(screen => (
                <div key={screen.id} className="screen-card" id={`screen-card-${screen.id}`}>
                  <div className="screen-card-top">
                    <div className="screen-icon-wrap"><Monitor size={18} /></div>
                    <div className="screen-status-badge">
                      {screen.status === 'LIVE' ? (
                        <span className="status-live"><Wifi size={10} /> Live</span>
                      ) : (
                        <span className="status-offline"><WifiOff size={10} /> Ready</span>
                      )}
                    </div>
                  </div>
                  <div className="screen-card-info">
                    <h4 className="screen-name">{screen.name}</h4>
                    {screen.placedAt && (
                      <div className="screen-meta"><MapPin size={11} /><span>{screen.placedAt}</span></div>
                    )}
                    <span className="screen-device-badge">{DEVICE_TYPE_MAP[screen.deviceType] || 'Unknown'}</span>
                    {/* Mini current-playing indicator per screen */}
                    {(screen.selectedScheduleId || screen.defaultShowAssetType) && (
                      <div className="screen-playing">
                        {screen.selectedScheduleId && screen.selectedScheduleId > 0
                          ? <><Calendar size={10} /> Schedule #{screen.selectedScheduleId}</>
                          : screen.defaultShowAssetType === 'PLAYLIST'
                          ? <><Layers size={10} /> {screen.defaultShowAssetName || `Playlist #${screen.defaultShowAssetId}`}</>
                          : screen.defaultShowAssetType === 'MEDIA'
                          ? <><Film size={10} /> {screen.defaultShowAssetName || `Media #${screen.defaultShowAssetId}`}</>
                          : null
                        }
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tag-detail-page { padding: 1.5rem 2rem; max-width: 1300px; }
        .detail-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; padding:5rem; color:var(--text-muted); }

        /* ── Toolbar ── */
        .toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.75rem; gap:1rem; flex-wrap:wrap; }
        .toolbar-left { display:flex; align-items:center; gap:.75rem; }
        .back-btn { width:34px; height:34px; border-radius:8px; border:1px solid var(--border); background:var(--sidebar-bg); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted); transition:all .15s; }
        .back-btn:hover { border-color:var(--accent); color:var(--accent); }
        .tag-icon-wrap { width:40px; height:40px; border-radius:12px; background:var(--btn-cta-bg); display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 4px 12px rgba(31,41,55,.25); flex-shrink:0; }
        .page-title { font-size:1.2rem; font-weight:700; margin:0 0 .1rem; }
        .page-sub { font-size:.75rem; color:var(--text-muted); margin:0; }

        .btn-ghost-sm { display:inline-flex; align-items:center; gap:.35rem; background:transparent; border:1px solid var(--border); color:var(--text-muted); padding:.45rem .9rem; border-radius:9px; font-size:.8rem; font-weight:600; cursor:pointer; transition:all .15s; }
        .btn-ghost-sm:hover { border-color:#ef4444; color:#ef4444; }
        .btn-ghost-sm:disabled { opacity:.5; cursor:not-allowed; }

        /* ── Layout ── */
        .detail-layout { display:grid; grid-template-columns:340px 1fr; gap:1.5rem; align-items:start; }

        /* ── Settings panel ── */
        .settings-panel { background:var(--card-bg); border:1px solid var(--border); border-radius:18px; padding:1.25rem; display:flex; flex-direction:column; gap:1rem; box-shadow:0 4px 16px rgba(15,23,42,.05); }
        .panel-hd { display:flex; flex-direction:column; gap:.35rem; }
        .section-title { font-size:.9rem; font-weight:700; margin:0; color:var(--text); }
        .section-desc { font-size:.75rem; color:var(--text-muted); line-height:1.5; margin:0; }

        /* Current badge */
        .current-badge { display:flex; align-items:center; gap:.5rem; background:rgba(31,41,55,.04); border:1px solid var(--border); border-radius:10px; padding:.6rem .875rem; font-size:.78rem; color:var(--text); }
        .current-badge-label { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        /* Content type tabs */
        .content-tabs { display:grid; grid-template-columns:1fr 1fr; gap:.4rem; }
        .ct-tab { display:flex; align-items:center; gap:.4rem; padding:.55rem .7rem; border:1px solid var(--border); border-radius:10px; background:var(--sidebar-bg); cursor:pointer; font-size:.78rem; font-weight:600; color:var(--text-muted); transition:all .15s; position:relative; }
        .ct-tab:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); background:rgba(31,41,55,.04); }
        .ct-tab-active { border-color:var(--accent) !important; color:var(--accent) !important; background:rgba(31,41,55,.06) !important; }
        .ct-tab:disabled { opacity:.5; cursor:not-allowed; }
        .ct-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); margin-left:auto; flex-shrink:0; }

        .tab-desc { font-size:.73rem; color:var(--text-muted); line-height:1.5; margin:0; padding:.5rem .75rem; background:var(--sidebar-bg); border-radius:8px; }

        /* None confirm */
        .none-confirm { border:1.5px dashed var(--border); border-radius:12px; padding:1rem; display:flex; flex-direction:column; gap:.75rem; }
        .none-confirm p { font-size:.78rem; color:var(--text-muted); margin:0; line-height:1.5; }
        .btn-danger-sm { display:inline-flex; align-items:center; gap:.4rem; background:#ef4444; color:white; border:none; padding:.5rem 1rem; border-radius:9px; font-size:.8rem; font-weight:600; cursor:pointer; align-self:flex-start; transition:all .15s; }
        .btn-danger-sm:hover { background:#dc2626; }
        .btn-danger-sm:disabled { opacity:.5; cursor:not-allowed; }

        /* Asset picker */
        .picker-wrap { display:flex; flex-direction:column; gap:.5rem; }
        .picker-search-row { display:flex; align-items:center; gap:.5rem; background:var(--sidebar-bg); border:1px solid var(--border); border-radius:10px; padding:.45rem .7rem; }
        .picker-search-ic { color:var(--text-muted); flex-shrink:0; }
        .picker-search { flex:1; background:transparent; border:none; outline:none; font-size:.83rem; color:var(--text); }
        .picker-list { max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:.25rem; border:1px solid var(--border); border-radius:10px; padding:.35rem; background:var(--card-bg); }
        .picker-empty { text-align:center; color:var(--text-muted); font-size:.8rem; padding:1.5rem; margin:0; }
        .picker-row { display:flex; align-items:center; gap:.6rem; padding:.5rem .6rem; border-radius:8px; cursor:pointer; transition:background .1s; }
        .picker-row:hover { background:var(--sidebar-bg); }
        .picker-row-active { background:rgba(31,41,55,.07) !important; }
        .picker-row-disabled { opacity:.5; cursor:not-allowed; }
        .picker-thumb { width:36px; height:36px; border-radius:7px; object-fit:cover; flex-shrink:0; border:1px solid var(--border); }
        .picker-thumb-ph { width:36px; height:36px; border-radius:7px; background:var(--btn-cta-bg); display:flex; align-items:center; justify-content:center; color:white; flex-shrink:0; }
        .picker-item-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:.1rem; }
        .picker-item-name { font-size:.8rem; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .picker-item-type { font-size:.62rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; }
        .picker-check { color:var(--accent); flex-shrink:0; }
        .picker-list::-webkit-scrollbar { width:4px; }
        .picker-list::-webkit-scrollbar-thumb { background:var(--border); border-radius:999px; }

        /* ── Screens panel ── */
        .screens-panel { display:flex; flex-direction:column; gap:1.1rem; }
        .screens-header { display:flex; align-items:center; gap:.6rem; }
        .count-pill { background:var(--btn-cta-bg); color:white; font-size:.7rem; font-weight:700; padding:.2rem .55rem; border-radius:999px; }

        .screens-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.75rem; background:var(--card-bg); border:1px solid var(--border); border-radius:18px; padding:4rem 2rem; text-align:center; color:var(--text-muted); }
        .screens-empty h4 { font-size:.95rem; font-weight:600; margin:0; color:var(--text); }
        .screens-empty p { font-size:.8rem; margin:0; max-width:300px; line-height:1.4; }

        .screens-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:1rem; }
        .screen-card { background:var(--card-bg); border:1px solid var(--border); border-radius:14px; padding:1rem; display:flex; flex-direction:column; gap:.875rem; transition:border-color .15s; }
        .screen-card:hover { border-color:var(--accent); }
        .screen-card-top { display:flex; align-items:center; justify-content:space-between; }
        .screen-icon-wrap { width:32px; height:32px; border-radius:8px; background:rgba(99,102,241,.06); display:flex; align-items:center; justify-content:center; color:var(--accent); }
        .status-live { display:inline-flex; align-items:center; gap:.25rem; background:#dcfce7; color:#16a34a; padding:.18rem .5rem; border-radius:999px; font-size:.68rem; font-weight:700; }
        .status-offline { display:inline-flex; align-items:center; gap:.25rem; background:var(--sidebar-bg); color:var(--text-muted); padding:.18rem .5rem; border-radius:999px; font-size:.68rem; font-weight:700; }
        .screen-card-info { display:flex; flex-direction:column; gap:.3rem; }
        .screen-name { font-size:.875rem; font-weight:700; margin:0; color:var(--text); }
        .screen-meta { display:flex; align-items:center; gap:.3rem; font-size:.72rem; color:var(--text-muted); }
        .screen-device-badge { font-size:.62rem; color:var(--text-muted); background:var(--sidebar-bg); border:1px solid var(--border); border-radius:5px; padding:.1rem .4rem; align-self:flex-start; }
        .screen-playing { display:flex; align-items:center; gap:.3rem; font-size:.68rem; color:var(--accent); font-weight:600; margin-top:.1rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        /* ── Shared ── */
        .btn-secondary { display:inline-flex; align-items:center; gap:.4rem; background:var(--card-bg); color:var(--text); border:1px solid var(--border); padding:.5rem 1rem; border-radius:8px; font-size:.8rem; font-weight:600; cursor:pointer; transition:all .15s; }
        .btn-secondary:hover { border-color:var(--accent); color:var(--accent); }
        .spin { animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }

        @media (max-width:900px) {
          .detail-layout { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}
