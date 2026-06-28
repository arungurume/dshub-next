'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Tag, Plus, Pencil, Trash2, ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, X,
  Calendar, Layers, Film, Minus
} from 'lucide-react';
import { cmsApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

interface ScreenGroup {
  id: number;
  name: string;
  updatedDate: string;
  screenCount?: number;
  scheduleId?: number;
  contentType?: string | null;
  contentId?: string | null;
  contentName?: string | null;
}

function AssignmentBadge({ tag }: { tag: ScreenGroup }) {
  const type = tag.contentType?.toUpperCase();
  if (type === 'SCHEDULE' || (tag.scheduleId && tag.scheduleId > 0)) {
    return (
      <span className="assign-badge assign-badge-schedule">
        <Calendar size={11} />
        {tag.contentName || (tag.contentId ? `Schedule #${tag.contentId}` : `Schedule #${tag.scheduleId}`)}
      </span>
    );
  }
  if (type === 'PLAYLIST') {
    return (
      <span className="assign-badge assign-badge-playlist">
        <Layers size={11} />
        {tag.contentName || `Playlist #${tag.contentId}`}
      </span>
    );
  }
  if (type === 'MEDIA') {
    return (
      <span className="assign-badge assign-badge-media">
        <Film size={11} />
        {tag.contentName || `Media #${tag.contentId}`}
      </span>
    );
  }
  return <span className="assign-badge assign-badge-none"><Minus size={11} /> None</span>;
}

export default function ScreenTagsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [tags, setTags] = useState<ScreenGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 0, size: 10, total: 0 });

  // Dialog states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editTag, setEditTag] = useState<ScreenGroup | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [deleteModal, setDeleteModal] = useState<ScreenGroup | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch tag list
  const fetchTags = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const { data } = await cmsApi.get('/sc/screen-group', {
        params: {
          page,
          size: pagination.size,
          sortBy: 'updatedDate',
          sortOrder: 'DESC'
        }
      });
      setTags(data.content || []);
      setPagination(p => ({ ...p, page, total: data.totalElements || (data.content || []).length }));
    } catch {
      toast.error('Failed to load screen tags');
    } finally {
      setLoading(false);
    }
  }, [pagination.size]);

  useEffect(() => {
    fetchTags(0);
  }, []);

  // Create Tag
  async function handleCreate() {
    if (!newTagName.trim()) {
      toast.error(t('SCREENS.toast_tag_required'));
      return;
    }
    setActionLoading(true);
    try {
      const { data } = await cmsApi.post('/sc/screen-group', {
        name: newTagName.trim()
      });
      if (data?.id) {
        toast.success(t('SCREENS.toast_tag_created'));
        setCreateModalOpen(false);
        setNewTagName('');
        fetchTags(0);
      } else {
        toast.error(t('SCREENS.toast_tag_create_failed'));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('SCREENS.toast_tag_create_failed'));
    } finally {
      setActionLoading(false);
    }
  }

  // Rename Tag
  async function handleRename() {
    if (!editTagName.trim()) {
      toast.error(t('SCREENS.toast_tag_required'));
      return;
    }
    if (!editTag) return;
    setActionLoading(true);
    try {
      const { data } = await cmsApi.put('/sc/screen-group', {
        id: editTag.id,
        name: editTagName.trim()
      });
      if (data?.id) {
        toast.success(t('SCREENS.toast_tag_renamed'));
        setEditTag(null);
        setEditTagName('');
        fetchTags(pagination.page);
      } else {
        toast.error(t('SCREENS.toast_tag_rename_failed'));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('SCREENS.toast_tag_rename_failed'));
    } finally {
      setActionLoading(false);
    }
  }

  // Delete Tag
  async function handleDelete() {
    if (!deleteModal) return;
    setActionLoading(true);
    try {
      const { data } = await cmsApi.delete('/sc/screen-group', {
        data: { ids: [deleteModal.id] }
      });
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        if (result.deleted) {
          toast.success(result.message || t('SCREENS.toast_tag_deleted'));
          setDeleteModal(null);
          fetchTags(pagination.page);
        } else {
          toast.error(result.message || t('SCREENS.toast_tag_delete_failed'));
        }
      } else {
        toast.success(t('SCREENS.toast_tag_deleted'));
        setDeleteModal(null);
        fetchTags(pagination.page);
      }
    } catch {
      toast.error(t('SCREENS.toast_tag_delete_failed'));
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.size);

  return (
    <div className="tags-page">
      {/* Header toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="back-btn" onClick={() => router.push('/screens')} id="back-to-screens">
            <ArrowLeft size={16} />
          </button>
          <Tag size={20} className="header-icon" />
          <h1 className="page-title">{t('SCREENS.tags')}</h1>
          <span className="count-pill">{pagination.total}</span>
        </div>
        <div className="toolbar-right">
          <button
            className="btn-primary"
            onClick={() => setCreateModalOpen(true)}
            id="create-tag-btn"
          >
            <Plus size={14} /> {t('SCREENS.tags_create_btn')}
          </button>
        </div>
      </div>

      {/* Main content grid/table */}
      {loading ? (
        <div className="page-loading">
          <RefreshCw size={24} className="spin" />
          <span>{t('SCREENS.tags_loading')}</span>
        </div>
      ) : tags.length === 0 ? (
        <div className="page-empty">
          <Tag size={48} opacity={0.15} />
          <h3>{t('SCREENS.tags_empty_title')}</h3>
          <p>{t('SCREENS.tags_empty_sub')}</p>
          <button className="btn-primary" onClick={() => setCreateModalOpen(true)} id="empty-create-tag-btn">
            <Plus size={14} /> {t('SCREENS.tags_create_first')}
          </button>
        </div>
      ) : (
        <div className="table-card overflow-x-auto">
          <table className="tags-table">
            <thead>
              <tr>
                <th>{t('SCREENS.tag_name')}</th>
                <th>Assigned content</th>
                <th className="hidden sm:table-cell">{t('SCREENS.last_modified')}</th>
                <th style={{ width: 180 }}>{t('SCREENS.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tags.map(tag => (
                <tr key={tag.id} id={`tag-row-${tag.id}`}>
                  <td>
                    <div className="tag-name-cell">
                      <Tag size={14} className="tag-cell-icon" />
                      <span className="tag-name">{tag.name}</span>
                      {tag.screenCount ? (
                        <span className="screen-count-pill">{tag.screenCount} screen{tag.screenCount !== 1 ? 's' : ''}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <AssignmentBadge tag={tag} />
                  </td>
                  <td className="cell-muted hidden sm:table-cell">
                    {tag.updatedDate ? new Date(tag.updatedDate).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div className="action-row">
                      <button
                        className="btn-action-assign"
                        onClick={() => router.push(`/screens/tags/${tag.id}`)}
                        id={`manage-tag-${tag.id}`}
                      >
                        Manage
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => {
                          setEditTag(tag);
                          setEditTagName(tag.name);
                        }}
                        title={t('SCREENS.action_rename')}
                        id={`rename-tag-${tag.id}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="action-btn action-danger"
                        onClick={() => setDeleteModal(tag)}
                        title={t('SCREENS.delete')}
                        id={`delete-tag-${tag.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="table-pager">
              <span className="pager-info">{pagination.total} tags · Page {pagination.page + 1}/{totalPages}</span>
              <div className="pager-btns">
                <button className="pager-btn" disabled={pagination.page === 0}
                  onClick={() => fetchTags(pagination.page - 1)} id="tags-prev">
                  <ChevronLeft size={14} />
                </button>
                <button className="pager-btn" disabled={pagination.page >= totalPages - 1}
                  onClick={() => fetchTags(pagination.page + 1)} id="tags-next">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('SCREENS.modal_create_title')}</h3>
              <button className="close-btn" onClick={() => setCreateModalOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="field-label">{t('SCREENS.tag_name')}</label>
                <input
                  id="new-tag-name"
                  className="form-input"
                  placeholder={t('SCREENS.modal_tag_name_placeholder')}
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setCreateModalOpen(false)}>{t('SCREENS.btn_cancel')}</button>
              <button className="btn-primary" onClick={handleCreate} disabled={actionLoading} id="submit-create-tag">
                {actionLoading && <RefreshCw size={13} className="spin" />} {t('SCREENS.btn_create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Rename Modal */}
      {editTag && (
        <div className="modal-overlay" onClick={() => setEditTag(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('SCREENS.modal_rename_title')}</h3>
              <button className="close-btn" onClick={() => setEditTag(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="field-label">{t('SCREENS.new_tag_name')}</label>
                <input
                  id="rename-tag-name"
                  className="form-input"
                  placeholder={t('SCREENS.tag_name')}
                  value={editTagName}
                  onChange={e => setEditTagName(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEditTag(null)}>{t('SCREENS.btn_cancel')}</button>
              <button className="btn-primary" onClick={handleRename} disabled={actionLoading} id="submit-rename-tag">
                {actionLoading && <RefreshCw size={13} className="spin" />} {t('SCREENS.btn_save_changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('SCREENS.modal_delete_title')}</h3>
            <p>{t('SCREENS.modal_delete_msg')} "<strong>{deleteModal.name}</strong>"{t('SCREENS.modal_delete_msg_suffix')}</p>
            <div className="confirm-footer">
              <button className="btn-ghost" onClick={() => setDeleteModal(null)}>{t('SCREENS.btn_cancel')}</button>
              <button className="btn-danger" onClick={handleDelete} disabled={actionLoading} id="confirm-delete-tag">
                {actionLoading && <RefreshCw size={13} className="spin" />} {t('SCREENS.btn_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tags-page { padding: 1.5rem 2rem; }
        .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: .75rem; }
        .toolbar-left { display: flex; align-items: center; gap: .75rem; }
        .back-btn {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--sidebar-bg);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-muted);
        }
        .back-btn:hover { border-color: var(--accent); color: var(--accent); }
        .header-icon { color: var(--accent); }
        .page-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .count-pill { background: var(--accent); color: var(--btn-cta-text); font-size: .7rem; font-weight: 700; padding: .2rem .6rem; border-radius: 999px; }
        .toolbar-right { display: flex; align-items: center; gap: .75rem; }

        .page-loading, .page-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 4rem; color: var(--text-muted); text-align: center; }
        .page-empty h3 { font-size: 1.1rem; font-weight: 600; margin: 0; color: var(--text); }
        .page-empty p { margin: 0; font-size: .875rem; max-width: 400px; line-height: 1.5; }

        .table-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
        .tags-table { width: 100%; border-collapse: collapse; }
        .tags-table th { text-align: left; padding: .875rem 1rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--sidebar-bg); }
        .tags-table td { padding: .875rem 1rem; font-size: .875rem; border-bottom: 1px solid var(--border); color: var(--text); }
        .tags-table tr:last-child td { border-bottom: none; }
        .tags-table tr:hover td { background: var(--sidebar-hover); }
        .cell-muted { color: var(--text-muted); font-size: .825rem; }

        .tag-name-cell { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
        .tag-cell-icon { color: var(--accent); opacity: 0.8; flex-shrink: 0; }
        .tag-name { font-weight: 600; }
        .screen-count-pill { font-size: .65rem; color: var(--text-muted); background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 999px; padding: .1rem .45rem; font-weight: 600; }

        .assign-badge { display: inline-flex; align-items: center; gap: .35rem; font-size: .72rem; font-weight: 600; padding: .25rem .6rem; border-radius: 999px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .assign-badge-schedule { background: rgba(99,102,241,.1); color: var(--accent); border: 1px solid rgba(99,102,241,.2); }
        .assign-badge-playlist { background: rgba(16,185,129,.1); color: #059669; border: 1px solid rgba(16,185,129,.2); }
        .assign-badge-media { background: rgba(245,158,11,.1); color: #d97706; border: 1px solid rgba(245,158,11,.2); }
        .assign-badge-none { background: var(--sidebar-bg); color: var(--text-muted); border: 1px solid var(--border); }

        .action-row { display: flex; gap: .5rem; align-items: center; }
        .btn-action-assign {
          background: rgba(99, 102, 241, 0.08);
          color: var(--accent);
          border: 1px solid rgba(99, 102, 241, 0.2);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-action-assign:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

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
        .modal-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; width: 440px; max-width: 95vw; box-shadow: 0 24px 64px rgba(0,0,0,.4); display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
        .modal-header h3 { font-size: 1rem; font-weight: 700; margin: 0; }
        .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; }
        .close-btn:hover { color: var(--text); }
        .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        
        .form-group { display: flex; flex-direction: column; gap: .5rem; }
        .field-label { display: flex; align-items: center; gap: .4rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
        .form-input { background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; padding: .65rem 1rem; font-size: .9rem; color: var(--text); outline: none; transition: border-color .15s; }
        .form-input:focus { border-color: var(--accent); }

        .modal-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1.25rem 1.5rem; border-top: 1px solid var(--border); background: rgba(255,255,255,.01); }
        
        .confirm-modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; width: 380px; max-width: 95vw; box-shadow: 0 24px 64px rgba(0,0,0,.4); }
        .confirm-modal h3 { font-size: 1rem; font-weight: 700; margin: 0 0 .75rem; }
        .confirm-modal p { font-size: .875rem; color: var(--text-muted); margin: 0 0 1.5rem; line-height: 1.5; }
        .confirm-footer { display: flex; justify-content: flex-end; gap: .75rem; }

        .btn-primary { display: inline-flex; align-items: center; gap: .5rem; background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none; padding: .6rem 1.25rem; border-radius: 12px; font-size: .875rem; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease; }
        .btn-primary:hover:not(:disabled) { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); padding: .6rem 1.25rem; border-radius: 10px; font-size: .875rem; cursor: pointer; }
        .btn-ghost:hover { background: var(--sidebar-hover); }

        .btn-danger { display: inline-flex; align-items: center; gap: .4rem; background: #ef4444; color: white; border: none; padding: .6rem 1.25rem; border-radius: 10px; font-size: .875rem; font-weight: 600; cursor: pointer; }
        .btn-danger:hover { background: #dc2626; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .tags-page { padding: 1rem; }
          .toolbar { flex-direction: column; align-items: stretch; }
          .toolbar-right { width: 100%; justify-content: flex-end; }
          .action-row { flex-wrap: wrap; gap: .25rem; }
          .btn-action-assign { padding: .25rem .5rem; font-size: .7rem; }
          .table-pager { flex-direction: column; gap: .75rem; text-align: center; }
        }
      `}</style>
    </div>
  );
}
