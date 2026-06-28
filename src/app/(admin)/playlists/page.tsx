'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  FolderHeart, Plus, Trash2, Monitor, Pencil, Eye, RefreshCw,
  Search, ChevronLeft, ChevronRight, Clock, X, Check, SlidersHorizontal,
  LayoutGrid, List, ChevronDown, ChevronUp, Play, Pause
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Playlist {
  id: string;
  name: string;
  duration: number;
  totalDuration?: string;
  updatedDate: string;
  totalItems?: number;
  itemCount?: number;
  transitionType?: string;
  transitionSpeed?: string;
}

const SORT_OPTIONS = [
  { value: 'updatedDate:DESC', label: 'Latest Modified' },
  { value: 'updatedDate:ASC', label: 'Oldest Modified' },
  { value: 'name:ASC', label: 'Name A→Z' },
  { value: 'name:DESC', label: 'Name Z→A' },
  { value: 'duration:DESC', label: 'Duration ↓' },
  { value: 'duration:ASC', label: 'Duration ↑' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  if (!secs) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
  return [m, s].map(n => n.toString().padStart(2, '0')).join(':');
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Create / Rename Modal ────────────────────────────────────────────────────

function PlaylistNameModal({
  initial, onClose, onSaved
}: { initial?: Playlist; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await cmsApiV2.put('/pc/playlist', { id: initial.id, name: name.trim() });
        toast.success('Playlist renamed');
      } else {
        await cmsApiV2.post('/pc/playlist', { name: name.trim() });
        toast.success('Playlist created');
      }
      onSaved();
      onClose();
    } catch {
      toast.error(`Failed to ${initial ? 'rename' : 'create'} playlist`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <h3>{initial ? 'Rename Playlist' : 'New Playlist'}</h3>
          <button onClick={onClose} className="modal-x"><X size={16} /></button>
        </div>
        <div className="modal-bd">
          <label className="field-label">Playlist Name</label>
          <input
            ref={inputRef}
            className="field-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="e.g. Morning Lobby Loop"
            id="playlist-name-input"
          />
        </div>
        <div className="modal-ft">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={save}
            disabled={saving || !name.trim()}
            id="save-playlist-btn"
          >
            {saving ? <RefreshCw size={13} className="spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function extractYTId(url: string): string | null {
  const m = url?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return m ? m[1] : null;
}

function PreviewModal({ playlist, onClose }: { playlist: Playlist; onClose: () => void }) {
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cmsApiV2.get(`/pc/playlist/${playlist.id}?includeContents=true`)
      .then(({ data }) => setContents(Array.isArray(data.contents) ? data.contents : []))
      .catch(() => toast.error('Failed to load preview'))
      .finally(() => setLoading(false));
  }, [playlist.id]);

  const apiToUiMap: Record<string, string> = {
    SLIDE_IN_RIGHT: 'SLIDE',
    SLIDE_IN_LEFT: 'SLIDE',
    FADE_IN: 'FADE',
    ZOOM_IN: 'ZOOM',
    ROTATE_IN: 'ROTATE',
    FLIP_IN: 'FLIP'
  };
  const transitionType = (apiToUiMap[playlist.transitionType || ''] || playlist.transitionType || 'FADE').toLowerCase();
  const speedMs = playlist.transitionSpeed === 'FAST' ? 200 : playlist.transitionSpeed === 'SLOW' ? 800 : 400;

  const advanceTo = (next: number) => {
    setAnimKey(k => k + 1);
    setIdx(next);
    setProgress(0);
  };

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying || loading || contents.length === 0) return;
    const cur = contents[idx];
    const durationMs = (Number(cur?.duration) || 10) * 1000;
    const tickMs = 100;
    let elapsed = 0;

    timerRef.current && clearTimeout(timerRef.current);
    progressRef.current && clearInterval(progressRef.current);
    setProgress(0);

    progressRef.current = setInterval(() => {
      elapsed += tickMs;
      setProgress(Math.min((elapsed / durationMs) * 100, 100));
    }, tickMs);

    timerRef.current = setTimeout(() => {
      advanceTo((idx + 1) % contents.length);
    }, durationMs);

    return () => {
      timerRef.current && clearTimeout(timerRef.current);
      progressRef.current && clearInterval(progressRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, isPlaying, loading, contents.length]);

  const current = contents[idx];

  function renderContent() {
    if (!current) return null;
    const ytId = extractYTId(current.permaLink || '');
    const isYT = current.contentType === 'APP_YOUTUBE' || !!ytId;
    const isWeb = ['APP_HTML', 'APP_CANVA_PUBLIC', 'APP_GOOGLE_SHEET', 'APP_GOOGLE_SLIDE',
      'APP_OUTLOOK_CALENDAR', 'APP_MICROSOFT_EXCEL', 'APP_MICROSOFT_POWERBI'].includes(current.contentType);

    if (isYT && ytId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&rel=0`}
          style={{ width: '100%', height: '100%', minHeight: 320, border: 'none' }}
          allow="autoplay; encrypted-media"
          title={current.name}
        />
      );
    }
    if (isWeb && current.permaLink) {
      return (
        <iframe
          src={current.permaLink}
          style={{ width: '100%', height: '100%', minHeight: 320, border: 'none', background: '#fff' }}
          title={current.name}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      );
    }
    if (current.thumbLink || current.permaLink) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={current.thumbLink || current.permaLink} alt={current.name} className="preview-img" />;
    }
    return (
      <div className="preview-placeholder">
        <Play size={32} opacity={.3} />
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-hd">
          <div>
            <h3 className="preview-title">{playlist.name}</h3>
            <p className="preview-sub">{contents.length} items · {playlist.totalDuration || formatDuration(playlist.duration)} · {playlist.transitionType || 'FADE'}</p>
          </div>
          <button className="modal-x" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Progress bar */}
        {!loading && contents.length > 0 && (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.1s linear' }} />
          </div>
        )}

        <div className="preview-body">
          {loading ? (
            <div className="preview-loading"><RefreshCw size={20} className="spin" /></div>
          ) : contents.length === 0 ? (
            <div className="preview-empty">This playlist has no content items yet.</div>
          ) : (
            <>
              {/* Stage */}
              <div className="preview-stage">
                <div key={animKey} className={`pl-anim-${transitionType}`} style={{ animationDuration: `${speedMs}ms`, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderContent()}
                </div>
                {/* Counter */}
                <div className="preview-counter">{idx + 1} / {contents.length}</div>
              </div>

              {/* Sidebar list */}
              <div className="preview-sidebar">
                {/* Play/Pause + dots */}
                <div className="preview-controls">
                  <button
                    onClick={() => setIsPlaying(p => !p)}
                    className="preview-play-btn"
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <div className="preview-dots">
                    {contents.map((_: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => advanceTo(i)}
                        className={`preview-dot ${i === idx ? 'preview-dot-active' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                {/* Item list */}
                <div className="preview-list">
                  {contents.map((c: any, i: number) => (
                    <div
                      key={c.id || i}
                      className={`preview-item ${i === idx ? 'preview-item-active' : ''}`}
                      onClick={() => advanceTo(i)}
                    >
                      {c.thumbLink ? (
                        <img src={c.thumbLink} alt={c.name} className="preview-item-thumb" />
                      ) : (
                        <div className="preview-item-thumb preview-item-placeholder">{(c.contentType || 'V')[0]}</div>
                      )}
                      <div className="preview-item-info">
                        <span className="preview-item-name">{c.name || 'Untitled'}</span>
                        <span className="preview-item-dur"><Clock size={11} /> {formatDuration(c.duration)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Assign Screen Modal ──────────────────────────────────────────────────────

function AssignScreenModal({
  playlistId, playlistName, onClose
}: { playlistId: string; playlistName: string; onClose: () => void }) {
  const [screens, setScreens] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    cmsApi.get('/sc/screen', { params: { page: 0, size: 200, sortBy: 'updatedDate', sortOrder: 'DESC' } })
      .then(({ data }) => {
        const list = data.content || [];
        setScreens(list);
        // Pre-select screens already assigned to this playlist
        const preselected = new Set<string>(
          list.filter((s: any) => String(s.defaultShowAssetId) === String(playlistId)).map((s: any) => s.id)
        );
        setSelected(preselected);
        setOriginal(new Set(preselected));
      })
      .catch(() => toast.error('Failed to load screens'))
      .finally(() => setLoading(false));
  }, [playlistId]);

  const filtered = screens.filter(s => !search || (s.name || '').toLowerCase().includes(search.toLowerCase()));

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function assign() {
    setSaving(true);
    const toAdd = [...selected].filter(id => !original.has(id));
    const toRemove = [...original].filter(id => !selected.has(id));
    let successCount = 0;

    try {
      // Process additions: fetch screen details, set playlist fields, then PUT
      for (const screenId of toAdd) {
        try {
          const { data: screenDetails } = await cmsApi.get(`/sc/screen/${screenId}`);
          screenDetails.defaultShowAssetId = playlistId;
          screenDetails.defaultShowAssetType = 'PLAYLIST';
          screenDetails.defaultShowAssetName = playlistName;
          await cmsApi.put('/sc/screen', screenDetails);
          successCount++;
        } catch {
          toast.error(`Failed to assign screen`);
        }
      }

      // Process removals: fetch screen details, clear playlist fields, then PUT
      for (const screenId of toRemove) {
        try {
          const { data: screenDetails } = await cmsApi.get(`/sc/screen/${screenId}`);
          screenDetails.defaultShowAssetId = null;
          screenDetails.defaultShowAssetType = 'NONE';
          screenDetails.defaultShowAssetName = '';
          await cmsApi.put('/sc/screen', screenDetails);
        } catch {
          // Non-critical — ignore removal failures
        }
      }

      if (successCount > 0 || toRemove.length > 0) {
        toast.success(`Playlist assigned to ${selected.size} screen(s)`);
      }
      onClose();
    } catch {
      toast.error('Failed to assign playlist to screens');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="assign-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <h3>Assign to Screens</h3>
            <p className="modal-sub">"{playlistName}"</p>
          </div>
          <button className="modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="assign-search-wrap">
          <Search size={13} className="assign-search-ic" />
          <input
            className="assign-search"
            placeholder="Search screens…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="assign-screen-search"
          />
        </div>
        <div className="modal-bd">
          {loading ? (
            <div className="modal-loading"><RefreshCw size={18} className="spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="modal-empty">{screens.length === 0 ? 'No screens available. Pair a screen first.' : 'No screens match your search.'}</p>
          ) : (
            <div className="screen-list">
              {filtered.map(s => (
                <label key={s.id} className={`screen-row${selected.has(s.id) ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    id={`assign-screen-${s.id}`}
                  />
                  <Monitor size={15} />
                  <span className="screen-row-name">{s.name || 'Unnamed Screen'}</span>
                  <span className={`status-dot ${s.status === 'LIVE' ? 'dot-live' : 'dot-offline'}`} />
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="modal-ft">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={assign}
            disabled={saving}
            id="confirm-assign-btn"
          >
            {saving ? <RefreshCw size={13} className="spin" /> : <Monitor size={13} />}
            Save Assignment ({selected.size} Screen{selected.size !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ names, onConfirm, onClose, loading }: {
  names: string[]; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <h3>Delete {names.length > 1 ? `${names.length} Playlists` : 'Playlist'}</h3>
          <button className="modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-bd">
          <p className="confirm-text">
            {names.length === 1
              ? <>Are you sure you want to delete "<strong>{names[0]}</strong>"? This cannot be undone.</>
              : <>Delete <strong>{names.length} playlists</strong>? This cannot be undone.</>
            }
          </p>
        </div>
        <div className="modal-ft">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading} id="confirm-delete-playlist">
            {loading && <RefreshCw size={13} className="spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortField = 'updatedDate' | 'name' | 'duration';
type SortOrder = 'ASC' | 'DESC';

export default function PlaylistsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 0, size: 10, total: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortField>('updatedDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [renameModal, setRenameModal] = useState<Playlist | null>(null);
  const [previewModal, setPreviewModal] = useState<Playlist | null>(null);
  const [assignModal, setAssignModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; names: string[] } | null>(null);

  const fetchPlaylists = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      if (search.trim()) {
        const { data } = await cmsApiV2.get('/pc/playlist/search', {
          params: { q: search.trim() }
        });
        const list = Array.isArray(data) ? data : (data.content || []);
        setPlaylists(list);
        setPagination({ page: 0, size: pagination.size, total: list.length });
      } else {
        const { data } = await cmsApiV2.get('/pc/playlist', {
          params: { page, size: pagination.size, sortBy, sortOrder }
        });
        setPlaylists(data.content || []);
        setPagination(p => ({ ...p, page, total: data.totalElements || 0 }));
      }
    } catch {
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  }, [search, pagination.size, sortBy, sortOrder]);

  useEffect(() => { fetchPlaylists(0); setSelectedIds(new Set()); }, [search, sortBy, sortOrder]);

  async function handleDelete(ids: string[], names: string[]) {
    setActionLoading(true);
    try {
      const { data } = await cmsApiV2.delete('/pc/playlist/', { data: { playlistIds: ids } });
      let successCount = 0;
      const errorMessages: string[] = [];
      if (Array.isArray(data)) {
        data.forEach(res => {
          if (res.deleted) {
            successCount++;
          } else {
            errorMessages.push(res.message || 'Failed to delete playlist');
          }
        });
      } else {
        successCount = ids.length;
      }

      if (errorMessages.length > 0) {
        toast.error(`Deleted ${successCount} playlists. Errors: ${errorMessages.join(', ')}`);
      } else {
        toast.success(ids.length > 1 ? `${successCount} playlists deleted` : 'Playlist deleted');
      }
      setDeleteModal(null);
      setSelectedIds(new Set());
      fetchPlaylists(pagination.page);
    } catch {
      toast.error('Failed to delete');
    } finally {
      setActionLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === playlists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlists.map(p => p.id)));
    }
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.size);
  const allSelected = playlists.length > 0 && selectedIds.size === playlists.length;
  const SortIcon = ({ field }: { field: SortField }) =>
    sortBy !== field ? null : sortOrder === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;

  return (
    <div className="playlists-page">

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <FolderHeart size={20} />
          <h1 className="page-title">{t('MENUITEMS.SIDEBAR.playlists')}</h1>
          <span className="count-pill">{pagination.total}</span>
        </div>
        <div className="toolbar-right">
          <div className="search-wrap">
            <Search size={13} className="search-ic" />
            <input
              id="playlist-search"
              className="search-input"
              placeholder="Search playlists…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-foreground transition-all hover:bg-white/10 h-[32px]"
            >
              <SlidersHorizontal size={14} className="text-primary" />
              <span className="font-semibold whitespace-nowrap">
                {SORT_OPTIONS.find(o => o.value === `${sortBy}:${sortOrder}`)?.label || 'Sort by'}
              </span>
              <ChevronDown size={12} className={`transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSortMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSortMenuOpen(false)} />
                <div 
                  className="absolute right-0 mt-1.5 w-48 rounded-xl border py-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100 z-20"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
                >
                  <p className="text-[10px] uppercase font-bold text-muted-foreground/40 tracking-widest px-4 py-1.5">
                    Sort Playlists
                  </p>
                  {SORT_OPTIONS.map(opt => {
                    const isSelected = `${sortBy}:${sortOrder}` === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          const [f, o] = opt.value.split(':');
                          setSortBy(f as SortField);
                          setSortOrder(o as SortOrder);
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${
                          isSelected ? 'text-primary font-bold bg-white/[0.01]' : 'text-foreground'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <Check size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="view-toggle">
            <button className={`vt-btn ${viewMode === 'grid' ? 'vt-active' : ''}`} onClick={() => setViewMode('grid')} id="view-grid"><LayoutGrid size={14} /></button>
            <button className={`vt-btn ${viewMode === 'list' ? 'vt-active' : ''}`} onClick={() => setViewMode('list')} id="view-list"><List size={14} /></button>
          </div>

          <button className="btn-primary" onClick={() => router.push('/playlists/create')} id="create-playlist-btn">
            <Plus size={14} /> New Playlist
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-info">{selectedIds.size} selected</span>
          <button
            className="btn-danger-sm"
            onClick={() => {
              const ids = Array.from(selectedIds);
              const names = playlists.filter(p => selectedIds.has(p.id)).map(p => p.name);
              setDeleteModal({ ids, names });
            }}
            id="bulk-delete-btn"
          >
            <Trash2 size={13} /> Delete Selected
          </button>
          <button className="btn-ghost-sm" onClick={() => setSelectedIds(new Set())}>
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="page-loading"><RefreshCw size={24} className="spin" /><span>Loading playlists…</span></div>
      ) : playlists.length === 0 ? (
        <div className="page-empty">
          <FolderHeart size={52} opacity={.13} />
          <h3>No playlists yet</h3>
          <p>Create your first playlist to organize content for your screens</p>
          <button className="btn-primary" onClick={() => router.push('/playlists/create')} id="empty-create-playlist">
            <Plus size={14} /> Create First Playlist
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW ── */
        <div className="pl-grid">
          {playlists.map(pl => (
            <div
              key={pl.id}
              className={`pl-card ${selectedIds.has(pl.id) ? 'pl-card-selected' : ''}`}
              id={`playlist-${pl.id}`}
            >
              {/* Checkbox */}
              <button
                className={`pl-check ${selectedIds.has(pl.id) ? 'pl-check-on' : ''}`}
                onClick={() => toggleSelect(pl.id)}
                id={`check-${pl.id}`}
              >
                {selectedIds.has(pl.id) && <Check size={10} strokeWidth={3} />}
              </button>

              {/* Card header */}
              <div className="pl-card-top">
                <div className="pl-icon"><FolderHeart size={22} /></div>
                <div className="pl-meta">
                  <h3 className="pl-name" title={pl.name}>{pl.name}</h3>
                  <p className="pl-date">Modified {formatDate(pl.updatedDate)}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="pl-stats">
                <span className="pl-stat"><Clock size={12} /> {formatDuration(pl.duration)}</span>
                {(pl.totalItems || pl.itemCount) != null && (
                  <span className="pl-stat"><FolderHeart size={12} /> {pl.totalItems ?? pl.itemCount} items</span>
                )}
                {pl.transitionType && (
                  <span className="pl-tag">{pl.transitionType}</span>
                )}
              </div>

              {/* Actions */}
              <div className="pl-actions">
                <button className="pl-btn" onClick={() => router.push(`/playlists/${pl.id}`)} title="Edit" id={`edit-${pl.id}`}>
                  <Pencil size={13} /> Edit
                </button>
                <button className="pl-btn" onClick={() => setPreviewModal(pl)} title="Preview" id={`preview-${pl.id}`}>
                  <Eye size={13} /> Preview
                </button>
                <button className="pl-btn" onClick={() => setAssignModal({ id: pl.id, name: pl.name })} title="Assign to Screen" id={`assign-${pl.id}`}>
                  <Monitor size={13} /> Assign
                </button>
                <button className="pl-btn pl-btn-danger" onClick={() => setDeleteModal({ ids: [pl.id], names: [pl.name] })} title="Delete" id={`delete-${pl.id}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="table-card">
          <table className="pl-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <button className={`tbl-check ${allSelected ? 'tbl-check-on' : ''}`} onClick={toggleAll}>
                    {allSelected && <Check size={10} strokeWidth={3} />}
                  </button>
                </th>
                <th className="sortable" onClick={() => handleSort('name')}>
                  Name <SortIcon field="name" />
                </th>
                <th className="sortable" onClick={() => handleSort('duration')}>
                  Duration <SortIcon field="duration" />
                </th>
                <th>Items</th>
                <th className="sortable" onClick={() => handleSort('updatedDate')}>
                  Modified <SortIcon field="updatedDate" />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map(pl => (
                <tr key={pl.id} className={selectedIds.has(pl.id) ? 'row-selected' : ''} id={`pl-row-${pl.id}`}>
                  <td>
                    <button className={`tbl-check ${selectedIds.has(pl.id) ? 'tbl-check-on' : ''}`} onClick={() => toggleSelect(pl.id)}>
                      {selectedIds.has(pl.id) && <Check size={10} strokeWidth={3} />}
                    </button>
                  </td>
                  <td>
                    <div className="tbl-name-cell">
                      <div className="tbl-icon"><FolderHeart size={13} /></div>
                      <span className="tbl-name">{pl.name}</span>
                    </div>
                  </td>
                  <td className="cell-muted"><Clock size={12} className="inline-icon" /> {formatDuration(pl.duration)}</td>
                  <td className="cell-muted">{pl.totalItems ?? pl.itemCount ?? '—'}</td>
                  <td className="cell-muted">{formatDate(pl.updatedDate)}</td>
                  <td>
                    <div className="action-row">
                      <button className="action-btn" title="Preview" onClick={() => setPreviewModal(pl)} id={`tbl-preview-${pl.id}`}><Eye size={13} /></button>
                      <button className="action-btn" title="Rename" onClick={() => setRenameModal(pl)} id={`tbl-rename-${pl.id}`}><Pencil size={13} /></button>
                      <button className="action-btn" title="Assign" onClick={() => setAssignModal({ id: pl.id, name: pl.name })} id={`tbl-assign-${pl.id}`}><Monitor size={13} /></button>
                      <button className="action-btn action-danger" title="Delete" onClick={() => setDeleteModal({ ids: [pl.id], names: [pl.name] })} id={`tbl-delete-${pl.id}`}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="table-pager">
              <span className="pager-info">{pagination.total} playlists · Page {pagination.page + 1}/{totalPages}</span>
              <div className="pager-btns">
                <button className="pager-btn" disabled={pagination.page === 0} onClick={() => fetchPlaylists(pagination.page - 1)} id="pl-prev"><ChevronLeft size={14} /></button>
                <button className="pager-btn" disabled={pagination.page >= totalPages - 1} onClick={() => fetchPlaylists(pagination.page + 1)} id="pl-next"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid pagination */}
      {viewMode === 'grid' && totalPages > 1 && (
        <div className="pager">
          <span className="pager-info">{pagination.total} playlists · Page {pagination.page + 1}/{totalPages}</span>
          <div className="pager-btns">
            <button className="pager-btn" disabled={pagination.page === 0} onClick={() => fetchPlaylists(pagination.page - 1)} id="pl-prev-grid"><ChevronLeft size={14} /></button>
            <button className="pager-btn" disabled={pagination.page >= totalPages - 1} onClick={() => fetchPlaylists(pagination.page + 1)} id="pl-next-grid"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Modals */}
      {createModal && (
        <PlaylistNameModal onClose={() => setCreateModal(false)} onSaved={() => fetchPlaylists(0)} />
      )}
      {renameModal && (
        <PlaylistNameModal initial={renameModal} onClose={() => setRenameModal(null)} onSaved={() => fetchPlaylists(pagination.page)} />
      )}
      {previewModal && (
        <PreviewModal playlist={previewModal} onClose={() => setPreviewModal(null)} />
      )}
      {assignModal && (
        <AssignScreenModal playlistId={assignModal.id} playlistName={assignModal.name} onClose={() => setAssignModal(null)} />
      )}
      {deleteModal && (
        <DeleteConfirm
          names={deleteModal.names}
          onConfirm={() => handleDelete(deleteModal.ids, deleteModal.names)}
          onClose={() => setDeleteModal(null)}
          loading={actionLoading}
        />
      )}

      <style>{`
        .playlists-page { padding: 1.5rem 2rem; }

        /* ── Toolbar ── */
        .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: .75rem; }
        .toolbar-left { display: flex; align-items: center; gap: .75rem; }
        .page-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .count-pill { background: var(--accent); color: var(--btn-cta-text); font-size: .7rem; font-weight: 700; padding: .2rem .6rem; border-radius: 999px; }
        .toolbar-right { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
        .search-wrap { position: relative; }
        .search-ic { position: absolute; left: .65rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .search-input { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: .55rem 1rem .55rem 2.1rem; font-size: .875rem; color: var(--text); outline: none; width: 220px; }
        .search-input:focus { border-color: var(--accent); }
        .sort-select { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: .5rem .9rem; font-size: .82rem; color: var(--text); outline: none; cursor: pointer; }
        .sort-select:focus { border-color: var(--accent); }
        .view-toggle { display: flex; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .vt-btn { display: inline-flex; align-items: center; justify-content: center; padding: .45rem .65rem; font-size: .8rem; border: none; background: transparent; cursor: pointer; color: var(--text-muted); transition: all .15s; }
        .vt-btn:hover { color: var(--text); }
        .vt-active { background: var(--accent) !important; color: var(--btn-cta-text) !important; }

        /* ── Bulk bar ── */
        .bulk-bar { display: flex; align-items: center; gap: .75rem; padding: .65rem 1rem; background: rgba(99,102,241,.08); border: 1px solid rgba(99,102,241,.3); border-radius: 12px; margin-bottom: 1rem; }
        .bulk-info { font-size: .85rem; font-weight: 600; color: var(--accent); flex: 1; }
        .btn-danger-sm { display: inline-flex; align-items: center; gap: .35rem; background: #ef4444; color: white; border: none; padding: .4rem .9rem; border-radius: 8px; font-size: .8rem; font-weight: 600; cursor: pointer; }
        .btn-ghost-sm { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: .4rem .9rem; border-radius: 8px; font-size: .8rem; cursor: pointer; display: inline-flex; align-items: center; gap: .35rem; }

        /* ── Loading/Empty ── */
        .page-loading, .page-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 4rem; color: var(--text-muted); text-align: center; }
        .page-empty h3 { font-size: 1.1rem; font-weight: 600; margin: 0; color: var(--text); }
        .page-empty p { margin: 0; font-size: .875rem; }

        /* ── Grid ── */
        .pl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
        .pl-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; gap: .875rem; transition: box-shadow .2s, border-color .2s; position: relative; }
        .pl-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,.15); border-color: rgba(99,102,241,.3); }
        .pl-card-selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .pl-check { position: absolute; top: .75rem; right: .75rem; width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--border); background: var(--sidebar-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .pl-check:hover { border-color: var(--accent); }
        .pl-check-on { background: var(--accent); border-color: var(--accent); color: var(--btn-cta-text); }
        .pl-card-top { display: flex; align-items: flex-start; gap: 1rem; padding-right: 1.5rem; }
        .pl-icon { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; background: var(--btn-cta-bg); display: flex; align-items: center; justify-content: center; color: var(--btn-cta-text); }
        .pl-meta { flex: 1; min-width: 0; }
        .pl-name { font-size: .95rem; font-weight: 700; margin: 0 0 .2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-date { font-size: .75rem; color: var(--text-muted); margin: 0; }
        .pl-stats { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
        .pl-stat { display: flex; align-items: center; gap: .3rem; font-size: .75rem; color: var(--text-muted); }
        .pl-tag { font-size: .65rem; font-weight: 700; background: rgba(99,102,241,.12); color: var(--accent); padding: .15rem .5rem; border-radius: 999px; }
        .pl-actions { display: flex; gap: .4rem; padding-top: .75rem; border-top: 1px solid var(--border); flex-wrap: wrap; }
        .pl-btn { display: inline-flex; align-items: center; gap: .3rem; font-size: .72rem; font-weight: 600; padding: .35rem .7rem; border-radius: 7px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; transition: all .15s; }
        .pl-btn:hover { border-color: var(--accent); color: var(--accent); }
        .pl-btn-danger { margin-left: auto; }
        .pl-btn-danger:hover { border-color: #ef4444; color: #ef4444; }

        /* ── List/Table ── */
        .table-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
        .pl-table { width: 100%; border-collapse: collapse; }
        .pl-table th { text-align: left; padding: .875rem 1rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--sidebar-bg); white-space: nowrap; }
        .pl-table th.sortable { cursor: pointer; user-select: none; }
        .pl-table th.sortable:hover { color: var(--text); }
        .pl-table td { padding: .875rem 1rem; font-size: .875rem; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
        .pl-table tr:last-child td { border-bottom: none; }
        .pl-table tr:hover td { background: var(--sidebar-hover); }
        .row-selected td { background: rgba(99,102,241,.04); }
        .cell-muted { color: var(--text-muted); font-size: .825rem; }
        .inline-icon { vertical-align: middle; margin-right: .25rem; }
        .tbl-name-cell { display: flex; align-items: center; gap: .75rem; }
        .tbl-icon { width: 30px; height: 30px; border-radius: 8px; background: var(--btn-cta-bg); display: flex; align-items: center; justify-content: center; color: var(--btn-cta-text); flex-shrink: 0; }
        .tbl-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
        .tbl-check { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--border); background: var(--sidebar-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .tbl-check:hover { border-color: var(--accent); }
        .tbl-check-on { background: var(--accent); border-color: var(--accent); color: var(--btn-cta-text); }
        .action-row { display: flex; gap: .25rem; }
        .action-btn { width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .action-btn:hover { background: var(--sidebar-hover); color: var(--text); }
        .action-danger:hover { background: #fee2e2; color: #ef4444; }
        .table-pager { display: flex; align-items: center; justify-content: space-between; padding: .875rem 1rem; border-top: 1px solid var(--border); }

        /* ── Pager ── */
        .pager { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; }
        .pager-info { font-size: .8rem; color: var(--text-muted); }
        .pager-btns { display: flex; gap: .25rem; }
        .pager-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--card-bg); cursor: pointer; color: var(--text); display: flex; align-items: center; justify-content: center; }
        .pager-btn:disabled { opacity: .4; cursor: not-allowed; }
        .pager-btn:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }

        /* ── Modals ── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .small-modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; width: 420px; max-width: 95vw; box-shadow: 0 24px 64px rgba(0,0,0,.4); animation: modal-in .2s ease; }
        .assign-modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; width: 480px; max-width: 95vw; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,.4); animation: modal-in .2s ease; }
        .preview-modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; width: 680px; max-width: 96vw; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 32px 80px rgba(0,0,0,.5); animation: modal-in .2s ease; overflow: hidden; }
        @keyframes modal-in { from { opacity:0; transform: scale(.95) translateY(8px); } }
        .modal-hd { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--border); }
        .modal-hd h3 { font-size: .95rem; font-weight: 700; margin: 0 0 .15rem; }
        .modal-sub { font-size: .8rem; color: var(--text-muted); margin: 0; }
        .modal-x { border: none; background: none; cursor: pointer; color: var(--text-muted); padding: .25rem; border-radius: 6px; display: flex; }
        .modal-x:hover { color: var(--text); }
        .modal-bd { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; }
        .modal-ft { padding: .875rem 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: .75rem; }
        .field-label { display: block; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin-bottom: .4rem; }
        .field-input { width: 100%; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; padding: .7rem 1rem; font-size: .9rem; color: var(--text); outline: none; box-sizing: border-box; }
        .field-input:focus { border-color: var(--accent); }
        .confirm-text { font-size: .875rem; color: var(--text-muted); margin: 0; line-height: 1.5; }

        /* Assign modal search */
        .assign-search-wrap { position: relative; padding: .75rem 1.25rem; border-bottom: 1px solid var(--border); }
        .assign-search-ic { position: absolute; left: 2rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .assign-search { width: 100%; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 8px; padding: .5rem 1rem .5rem 2rem; font-size: .85rem; color: var(--text); outline: none; box-sizing: border-box; }
        .assign-search:focus { border-color: var(--accent); }
        .modal-loading, .modal-empty { display: flex; align-items: center; justify-content: center; padding: 2.5rem; color: var(--text-muted); font-size: .875rem; }
        .screen-list { display: flex; flex-direction: column; gap: .5rem; }
        .screen-row { display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: border-color .15s; }
        .screen-row.checked { border-color: var(--accent); background: rgba(99,102,241,.06); }
        .screen-row:hover { border-color: var(--accent); }
        .screen-row input[type=checkbox] { display: none; }
        .screen-row-name { flex: 1; font-size: .875rem; font-weight: 500; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-live { background: #22c55e; }
        .dot-offline { background: var(--text-muted); }

        /* Preview modal */
        .preview-title { font-size: .95rem; font-weight: 700; margin: 0 0 .2rem; }
        .preview-sub { font-size: .78rem; color: var(--text-muted); margin: 0; }
        .preview-body { display: flex; flex: 1; overflow: hidden; min-height: 0; }
        .preview-loading, .preview-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: .875rem; padding: 3rem; }
        .preview-stage { flex: 1; position: relative; background: #000; display: flex; align-items: center; justify-content: center; min-height: 300px; overflow: hidden; }
        .preview-img { max-width: 100%; max-height: 400px; object-fit: contain; }
        .preview-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 300px; color: rgba(255,255,255,.2); }
        .preview-sidebar { width: 200px; display: flex; flex-direction: column; border-left: 1px solid var(--border); }
        .preview-controls { padding: .6rem .75rem; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: .5rem; }
        .preview-play-btn { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; font-size: .72rem; font-weight: 600; padding: .35rem .75rem; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; width: 100%; }
        .preview-play-btn:hover { border-color: var(--accent); color: var(--accent); }
        .preview-dots { display: flex; gap: 4px; flex-wrap: wrap; }
        .preview-dot { width: 6px; height: 6px; border-radius: 3px; border: none; background: rgba(99,102,241,.25); cursor: pointer; padding: 0; transition: background .15s, width .2s; }
        .preview-dot-active { width: 14px; background: var(--accent); }
        .preview-list { flex: 1; overflow-y: auto; }
        .preview-item { display: flex; align-items: center; gap: .6rem; padding: .6rem .75rem; cursor: pointer; transition: background .1s; border-bottom: 1px solid var(--border); }
        .preview-item:hover { background: var(--sidebar-hover); }
        .preview-item-active { background: rgba(99,102,241,.08); border-left: 2px solid var(--accent); }
        .preview-item-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
        .preview-item-placeholder { display: flex; align-items: center; justify-content: center; background: var(--btn-cta-bg); color: var(--btn-cta-text); font-weight: 700; font-size: .8rem; }
        .preview-item-info { min-width: 0; flex: 1; }
        .preview-item-name { display: block; font-size: .75rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .preview-item-dur { display: flex; align-items: center; gap: .2rem; font-size: .65rem; color: var(--text-muted); margin-top: .15rem; }

        /* Transition animations */
        .pl-anim-fade { animation: plFadeIn var(--dur, 400ms) ease; }
        .pl-anim-slide { animation: plSlideIn var(--dur, 400ms) ease; }
        .pl-anim-zoom { animation: plZoomIn var(--dur, 400ms) ease; }
        .pl-anim-flip { animation: plFlipIn var(--dur, 400ms) ease; }
        .pl-anim-rotate { animation: plRotateIn var(--dur, 400ms) ease; }
        .pl-anim-none { }
        @keyframes plFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes plSlideIn { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes plZoomIn { from { transform: scale(.88); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes plFlipIn { from { transform: rotateY(60deg); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes plRotateIn { from { opacity: 0; transform: rotate(-6deg) scale(0.95); } to { opacity: 1; transform: rotate(0) scale(1); } }

        /* Buttons */
        .btn-primary { display: inline-flex; align-items: center; gap: .5rem; background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none; padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease; }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); padding: .6rem 1.25rem; border-radius: 10px; font-size: .875rem; cursor: pointer; display: inline-flex; align-items: center; gap: .4rem; }
        .btn-danger { display: inline-flex; align-items: center; gap: .4rem; background: #ef4444; color: white; border: none; padding: .6rem 1.25rem; border-radius: 10px; font-size: .875rem; font-weight: 600; cursor: pointer; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
