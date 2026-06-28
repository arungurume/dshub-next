'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Monitor, Plus, Pencil, Trash2, RefreshCw, Search,
  Wifi, WifiOff, ChevronLeft, ChevronRight, Tag, Zap,
  AlertCircle, X
} from 'lucide-react';
import { apiAuth, cmsApi, cmsApiV2 } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useSocketContext } from '@/context/SocketContext';
import UpgradeModal from '@/components/shared/UpgradeModal';
import TrialExpiredUpgradeModal, { type TrialScreenSummary } from '@/components/shared/TrialExpiredUpgradeModal';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';

// ─── Types ────────────────────────────────────────────────────────────────────

const DEVICE_TYPE_MAP: Record<number, string> = {
  1: 'Android', 2: 'Fire TV', 3: 'Web Player', 4: 'Roku OS', 99: 'Unknown',
};

interface Screen {
  id: string;
  name: string;
  placedAt?: string;
  deviceType: number | string;
  deviceTypeName: string;
  entitlementType?: string;
  status: 'LIVE' | 'READY_TO_USE' | 'OFFLINE';
  isChecked: boolean;
}

interface PlanStatus {
  planType: string;
  canCreateScreen: boolean;
  totalScreens: number;
  usedScreens: number;
  trialExpiredWithActiveScreens: boolean;
  trialScreens: TrialScreenSummary[];
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  if (status === 'LIVE') {
    return (
      <span className="status-badge status-live">
        <Wifi size={11} /> {t('SCREENS.status_live')}
      </span>
    );
  }
  return (
    <span className="status-badge status-offline">
      <WifiOff size={11} /> {t('SCREENS.status_ready')}
    </span>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onClose, loading, t }: {
  name: string; onConfirm: () => void; onClose: () => void; loading: boolean; t: (k: string) => string;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('SCREENS.delete_title')}</h3>
        <p>{t('SCREENS.delete_msg')} "<strong>{name}</strong>"?</p>
        <div className="confirm-footer">
          <button className="btn-ghost" onClick={onClose}>{t('SCREENS.cancel')}</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading} id="confirm-delete-screen">
            {loading && <RefreshCw size={13} className="spin" />} {t('SCREENS.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upgrade banner ───────────────────────────────────────────────────────────

function UpgradeBanner({
  used, total, t, trialExpired, onUpgrade,
}: {
  used: number; total: number; t: (k: string) => string;
  trialExpired?: boolean; onUpgrade?: () => void;
}) {
  if (trialExpired) {
    return (
      <div className="upgrade-banner upgrade-banner--trial">
        <AlertCircle size={16} />
        <div className="upgrade-info">
          <span className="upgrade-text">Your free trial has ended — some screens may be paused</span>
        </div>
        <button className="upgrade-link" onClick={onUpgrade} id="trial-upgrade-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          Reactivate screens →
        </button>
      </div>
    );
  }
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div className="upgrade-banner">
      <AlertCircle size={16} />
      <div className="upgrade-info">
        <span className="upgrade-text">{t('SCREENS.screen_usage')}: {used}/{total} {t('SCREENS.screens_used')} ({pct}%)</span>
        <div className="upgrade-bar"><div className="upgrade-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <a href="/billing" className="upgrade-link" id="upgrade-link">{t('SCREENS.upgrade_plan')}</a>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScreensPage() {
  const router = useRouter();
  const { socket } = useSocketContext();
  const { t } = useLanguage();

  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const { upgradeModal, openUpgrade, closeUpgrade } = useUpgradeModal();
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, size: 10, total: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Screen | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // ── Load plan status ──
  useEffect(() => {
    cmsApiV2.get('/sac/my/plan')
      .then(({ data }) => setPlan({
        planType: data.planType || '',
        canCreateScreen: data.canCreateScreen ?? true,
        totalScreens: data.allowedScreens ?? 0,
        usedScreens: data.totalScreens ?? 0,
        trialExpiredWithActiveScreens: data.trialExpiredWithActiveScreens ?? false,
        trialScreens: data.trialScreens ?? [],
      }))
      .catch(() => {});
  }, []);

  // ── Fetch screens ──
  const fetchScreens = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      if (search.trim()) {
        const { data } = await cmsApi.get('/sc/screens', {
          params: { q: search.trim() }
        });
        const mapped: Screen[] = (data || []).map((s: any) => ({
          ...s,
          deviceTypeName: DEVICE_TYPE_MAP[s.deviceType] || 'Unknown',
          status: s.status === 'LIVE' ? 'LIVE' : 'READY_TO_USE',
          isChecked: false,
        }));
        setScreens(mapped);
        setPagination({ page: 0, size: pagination.size, total: mapped.length });
      } else {
        const { data } = await cmsApi.get('/sc/screen', {
          params: {
            page,
            size: pagination.size,
            sortBy: 'updatedDate',
            sortOrder: 'DESC',
            includeLiveStatus: true,
          }
        });

        if (!data?.content?.length && page === 0) {
          router.push('/screens/no-paired');
          return;
        }

        const mapped: Screen[] = (data?.content || []).map((s: any) => ({
          ...s,
          deviceTypeName: DEVICE_TYPE_MAP[s.deviceType] || 'Unknown',
          status: s.status === 'LIVE' ? 'LIVE' : 'READY_TO_USE',
          isChecked: false,
        }));

        setScreens(mapped);
        setPagination(p => ({ ...p, page, total: data?.totalElements || mapped.length }));
      }
    } catch {
      toast.error(t('SCREENS.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [search, pagination.size]);

  useEffect(() => { fetchScreens(0); }, [search]);

  // ── Socket real-time status updates ──
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data: { screenId: string; online: boolean }) => {
      setScreens(prev => prev.map(s =>
        s.id === data.screenId
          ? { ...s, status: data.online ? 'LIVE' : 'READY_TO_USE' }
          : s
      ));
    };

    socket.on('screen_status', handleStatusUpdate);
    socket.on('client_connected', (data: any) => handleStatusUpdate({ screenId: data.screenId, online: true }));
    socket.on('client_disconnected', (data: any) => handleStatusUpdate({ screenId: data.screenId, online: false }));

    return () => {
      socket.off('screen_status', handleStatusUpdate);
      socket.off('client_connected');
      socket.off('client_disconnected');
    };
  }, [socket]);

  // ── Refresh screen ──
  async function refreshScreen(screen: Screen) {
    try {
      // Send a WS notification to refresh the player
      await cmsApi.post(`/misc/ws-notification/client/${screen.id}/type/screen`, 'refresh');
      toast.success(`${t('SCREENS.refresh_success')} ${screen.name}`);
    } catch {
      toast.error(t('SCREENS.refresh_failed'));
    }
  }

  // ── Delete screen ──
  async function deleteScreen(screen: Screen) {
    setActionLoading(true);
    try {
      const { data } = await cmsApi.delete('/sc/screen/', { data: { screenIds: [screen.id] } });
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        if (result.deleted) {
          toast.success(result.message || t('SCREENS.delete_success'));
          setDeleteModal(null);
          fetchScreens(pagination.page);
        } else {
          toast.error(result.message || t('SCREENS.delete_failed'));
        }
      } else {
        toast.success(t('SCREENS.delete_success'));
        setDeleteModal(null);
        fetchScreens(pagination.page);
      }
    } catch {
      toast.error(t('SCREENS.delete_failed'));
    } finally {
      setActionLoading(false);
    }
  }

  // ── Bulk delete ──
  function bulkDelete() {
    if (selectedIds.size === 0) return;
    setShowBulkDelete(true);
  }

  async function executeBulkDelete() {
    setActionLoading(true);
    try {
      const { data } = await cmsApi.delete('/sc/screen/', { data: { screenIds: Array.from(selectedIds) } });
      let successCount = 0;
      const errorMessages: string[] = [];
      if (Array.isArray(data)) {
        data.forEach(res => {
          if (res.deleted) {
            successCount++;
          } else {
            errorMessages.push(res.message || 'Failed to delete screen');
          }
        });
      } else {
        successCount = selectedIds.size;
      }

      if (errorMessages.length > 0) {
        toast.error(`Deleted ${successCount} screens. Errors: ${errorMessages.join(', ')}`);
      } else {
        toast.success(`${successCount} screens deleted`);
      }
      setSelectedIds(new Set());
      setShowBulkDelete(false);
      fetchScreens(pagination.page);
    } catch {
      toast.error(t('SCREENS.bulk_delete_failed'));
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

  const totalPages = Math.ceil(pagination.total / pagination.size);
  const canCreate = !plan || plan.canCreateScreen;

  return (
    <div className="screens-page">
      {/* Plan usage / trial-expired banner */}
      {plan && (plan.trialExpiredWithActiveScreens || plan.totalScreens > 0) && (
        <UpgradeBanner
          used={plan.usedScreens}
          total={plan.totalScreens}
          t={t}
          trialExpired={plan.trialExpiredWithActiveScreens}
          onUpgrade={() => setShowTrialModal(true)}
        />
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <Monitor size={20} />
          <h1 className="page-title">{t('SCREENS.title')}</h1>
          <span className="count-pill">{pagination.total}</span>
        </div>
        <div className="toolbar-right">
          <div className="search-wrap">
            <Search size={13} className="search-ic" />
            <input
              id="screens-search"
              className="search-input"
              placeholder={t('SCREENS.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn-secondary"
            onClick={() => router.push('/screens/tags')}
            id="manage-tags-btn"
          >
            <Tag size={14} /> {t('SCREENS.tags')}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {plan && plan.totalScreens > 0 && plan.totalScreens > plan.usedScreens && (
              <span className="available-slots-chip">
                {plan.totalScreens - plan.usedScreens} available
              </span>
            )}
            <button
              className="btn-primary"
              onClick={() => {
                if (!canCreate) {
                  if (plan?.trialExpiredWithActiveScreens) { setShowTrialModal(true); return; }
                  openUpgrade('screen');
                  return;
                }
                router.push('/screens/new');
              }}
              id="pair-screen-btn"
            >
              <Plus size={14} /> {t('SCREENS.pair_screen')}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span>{selectedIds.size} {t('SCREENS.selected')}</span>
          <button className="bulk-btn" onClick={() => setSelectedIds(new Set())}><X size={13} /> {t('SCREENS.deselect')}</button>
          <button className="bulk-btn bulk-danger" onClick={bulkDelete} id="bulk-delete-screens">
            <Trash2 size={13} /> {t('SCREENS.delete_selected')}
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="page-loading"><RefreshCw size={24} className="spin" /><span>{t('SCREENS.loading')}</span></div>
      ) : screens.length === 0 ? (
        <div className="page-empty">
          <Monitor size={48} opacity={.15} />
          <h3>{t('SCREENS.no_screens_title')}</h3>
          <p>{t('SCREENS.no_screens_sub')}</p>
          <button
            className="btn-primary"
            onClick={() => {
              if (plan?.trialExpiredWithActiveScreens) { setShowTrialModal(true); return; }
              if (!canCreate) { openUpgrade('screen'); return; }
              router.push('/screens/new');
            }}
            id="empty-pair-screen"
          >
            <Plus size={14} /> {t('SCREENS.pair_first')}
          </button>
        </div>
      ) : (
        <div className="table-card overflow-x-auto">
          <table className="screens-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>{t('SCREENS.col_name')}</th>
                <th className="hidden sm:table-cell">{t('SCREENS.col_location')}</th>
                <th className="hidden md:table-cell">{t('SCREENS.col_device')}</th>
                <th>{t('SCREENS.col_status')}</th>
                <th>{t('SCREENS.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {screens.map(screen => (
                <tr key={screen.id} className={selectedIds.has(screen.id) ? 'row-selected' : ''} id={`screen-row-${screen.id}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(screen.id)}
                      onChange={() => toggleSelect(screen.id)}
                      id={`check-screen-${screen.id}`}
                    />
                  </td>
                  <td>
                    <div className="screen-name-cell">
                      <div className={`screen-dot ${screen.status === 'LIVE' ? 'dot-live' : 'dot-ready'}`} />
                      <span className="screen-name">{screen.name || '—'}</span>
                    </div>
                  </td>
                  <td className="cell-muted hidden sm:table-cell">{screen.placedAt || '—'}</td>
                  <td className="hidden md:table-cell">
                    <span className="device-badge">
                      {DEVICE_TYPE_MAP[screen.deviceType as number] || screen.deviceType || 'Unknown'}
                      {screen.entitlementType && <span className="entitlement"> · {screen.entitlementType}</span>}
                    </span>
                  </td>
                  <td><StatusBadge status={screen.status} t={t} /></td>
                  <td>
                    <div className="action-row">
                      <button
                        className="action-btn"
                        onClick={() => router.push(`/screens/edit/${screen.id}`)}
                        title="Edit"
                        id={`edit-screen-${screen.id}`}
                      ><Pencil size={13} /></button>
                      <button
                        className="action-btn"
                        onClick={() => refreshScreen(screen)}
                        title="Refresh"
                        id={`refresh-screen-${screen.id}`}
                      ><RefreshCw size={13} /></button>
                      <button
                        className="action-btn action-danger"
                        onClick={() => setDeleteModal(screen)}
                        title="Delete"
                        id={`delete-screen-${screen.id}`}
                      ><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="table-pager">
              <span className="pager-info">{pagination.total} {t('SCREENS.pager_info')} {pagination.page + 1}/{totalPages}</span>
              <div className="pager-btns">
                <button className="pager-btn" disabled={pagination.page === 0}
                  onClick={() => fetchScreens(pagination.page - 1)} id="screens-prev">
                  <ChevronLeft size={14} />
                </button>
                <button className="pager-btn" disabled={pagination.page >= totalPages - 1}
                  onClick={() => fetchScreens(pagination.page + 1)} id="screens-next">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <DeleteConfirm
          name={deleteModal.name}
          onConfirm={() => deleteScreen(deleteModal)}
          onClose={() => setDeleteModal(null)}
          loading={actionLoading}
          t={t}
        />
      )}

      {/* Bulk Delete modal */}
      {showBulkDelete && (
        <div className="modal-overlay" onClick={() => setShowBulkDelete(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('SCREENS.delete_title')}</h3>
            <p>{t('SCREENS.delete_msg')} "<strong>{selectedIds.size} screens</strong>"?</p>
            <div className="confirm-footer">
              <button className="btn-ghost" onClick={() => setShowBulkDelete(false)}>{t('SCREENS.cancel')}</button>
              <button className="btn-danger" onClick={executeBulkDelete} disabled={actionLoading} id="confirm-bulk-delete-screens">
                {actionLoading && <RefreshCw size={13} className="spin" />} {t('SCREENS.delete')}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Upgrade Modal — triggered when screen limit reached */}
      {showTrialModal && plan?.trialScreens && (
        <TrialExpiredUpgradeModal
          trialScreens={plan.trialScreens}
          onClose={result => {
            setShowTrialModal(false);
            if (result?.success) {
              // Refresh plan so banner + canCreate update
              cmsApiV2.get('/sac/my/plan').then(({ data }) => {
                const allowed = data.allowedScreens ?? 0;
                const used    = data.totalScreens   ?? 0;
                const available = Math.max(0, allowed - used);
                setPlan({
                  planType: data.planType || '',
                  canCreateScreen: data.canCreateScreen ?? true,
                  totalScreens: allowed,
                  usedScreens: used,
                  trialExpiredWithActiveScreens: data.trialExpiredWithActiveScreens ?? false,
                  trialScreens: data.trialScreens ?? [],
                });
                if (available > 0) {
                  toast.success(
                    `Payment complete — ${available} screen slot${available === 1 ? '' : 's'} available. Click "Pair Screen" to add a device.`,
                    { duration: 6000 }
                  );
                } else {
                  toast.success('Payment complete. Your screens have been activated.');
                }
              }).catch(() => {});
            }
          }}
        />
      )}
      {upgradeModal && (
        <UpgradeModal mode={upgradeModal} onClose={closeUpgrade} />
      )}

      <style>{`
        .screens-page { padding: 1.5rem 2rem; }
        .upgrade-banner { display: flex; align-items: center; gap: 1rem; background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.3); border-radius: 12px; padding: .75rem 1.25rem; margin-bottom: 1.25rem; }
        .upgrade-info { flex: 1; }
        .upgrade-text { font-size: .8rem; font-weight: 600; }
        .upgrade-bar { height: 4px; background: rgba(245,158,11,.2); border-radius: 999px; margin-top: .3rem; overflow: hidden; }
        .upgrade-fill { height: 100%; background: #f59e0b; transition: width .3s; }
        .upgrade-link { font-size: .8rem; font-weight: 700; color: #f59e0b; text-decoration: none; white-space: nowrap; }
        .upgrade-link:hover { text-decoration: underline; }

        .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: .75rem; }
        .toolbar-left { display: flex; align-items: center; gap: .75rem; }
        .page-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .count-pill { background: var(--accent); color: var(--btn-cta-text); font-size: .7rem; font-weight: 700; padding: .2rem .6rem; border-radius: 999px; }
        .toolbar-right { display: flex; align-items: center; gap: .75rem; }
        .search-wrap { position: relative; }
        .search-ic { position: absolute; left: .65rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .search-input { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: .55rem 1rem .55rem 2.1rem; font-size: .875rem; color: var(--text); outline: none; width: 220px; }
        .search-input:focus { border-color: var(--accent); }

        .bulk-bar { display: flex; align-items: center; gap: .75rem; background: var(--accent); color: var(--btn-cta-text); border-radius: 10px; padding: .6rem 1rem; margin-bottom: .75rem; font-size: .875rem; font-weight: 600; }
        .bulk-btn { display: inline-flex; align-items: center; gap: .35rem; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.2); color: white; padding: .35rem .75rem; border-radius: 8px; font-size: .78rem; cursor: pointer; }
        .bulk-danger { background: rgba(239,68,68,.3); border-color: rgba(239,68,68,.4); }

        .page-loading, .page-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 4rem; color: var(--text-muted); text-align: center; }
        .page-empty h3 { font-size: 1.1rem; font-weight: 600; margin: 0; color: var(--text); }
        .page-empty p { margin: 0; font-size: .875rem; }

        .table-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
        .screens-table { width: 100%; border-collapse: collapse; }
        .screens-table th { text-align: left; padding: .875rem 1rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--sidebar-bg); }
        .screens-table td { padding: .875rem 1rem; font-size: .875rem; border-bottom: 1px solid var(--border); color: var(--text); }
        .screens-table tr:last-child td { border-bottom: none; }
        .screens-table tr:hover td { background: var(--sidebar-hover); }
        .screens-table tr.row-selected td { background: rgba(99,102,241,.06); }
        .cell-muted { color: var(--text-muted); font-size: .825rem; }

        .screen-name-cell { display: flex; align-items: center; gap: .6rem; }
        .screen-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-live { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        .dot-ready { background: var(--text-muted); }
        .screen-name { font-weight: 600; }

        .device-badge { font-size: .78rem; color: var(--text-muted); }
        .entitlement { font-size: .72rem; opacity: .7; }

        .status-badge { display: inline-flex; align-items: center; gap: .3rem; font-size: .72rem; font-weight: 700; padding: .25rem .6rem; border-radius: 999px; }
        .status-live { background: #dcfce7; color: #16a34a; }
        .status-offline { background: #f3f4f6; color: #6b7280; }

        .action-row { display: flex; gap: .25rem; }
        .action-btn { width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .action-btn:hover { background: var(--sidebar-hover); color: var(--text); }
        .action-danger:hover { background: #fee2e2; color: #ef4444; }

        .table-pager { display: flex; align-items: center; justify-content: space-between; padding: .875rem 1rem; border-top: 1px solid var(--border); }
        .pager-info { font-size: .8rem; color: var(--text-muted); }
        .pager-btns { display: flex; gap: .25rem; }
        .pager-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--card-bg); cursor: pointer; color: var(--text); display: flex; align-items: center; justify-content: center; }
        .pager-btn:disabled { opacity: .4; cursor: not-allowed; }
        .pager-btn:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .confirm-modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; width: 380px; max-width: 95vw; box-shadow: 0 24px 64px rgba(0,0,0,.4); }
        .confirm-modal h3 { font-size: 1rem; font-weight: 700; margin: 0 0 .75rem; }
        .confirm-modal p { font-size: .875rem; color: var(--text-muted); margin: 0 0 1.5rem; }
        .confirm-footer { display: flex; justify-content: flex-end; gap: .75rem; }
        .available-slots-chip { display: inline-flex; align-items: center; background: rgba(16,185,129,.12); color: #059669; border: 1px solid rgba(16,185,129,.3); border-radius: 999px; padding: .25rem .75rem; font-size: .75rem; font-weight: 600; white-space: nowrap; }
        .btn-primary { display: inline-flex; align-items: center; gap: .5rem; background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none; padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease; }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .btn-secondary { display: inline-flex; align-items: center; gap: .5rem; background: var(--btn-secondary-bg); color: var(--btn-secondary-text); border: 1px solid var(--btn-secondary-border); padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .btn-secondary:hover { background: var(--btn-secondary-hover); }
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); padding: .6rem 1.25rem; border-radius: 10px; font-size: .875rem; cursor: pointer; }
        .btn-danger { display: inline-flex; align-items: center; gap: .4rem; background: #ef4444; color: white; border: none; padding: .6rem 1.25rem; border-radius: 10px; font-size: .875rem; font-weight: 600; cursor: pointer; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .screens-page { padding: 1rem; }
          .toolbar { flex-direction: column; align-items: stretch; }
          .toolbar-right { width: 100%; justify-content: flex-end; flex-wrap: wrap; gap: .5rem; }
          .search-wrap { flex: 1; min-width: 150px; }
          .search-input { width: 100%; }
          .table-pager { flex-direction: column; gap: .75rem; text-align: center; }
        }
      `}</style>
    </div>
  );
}
