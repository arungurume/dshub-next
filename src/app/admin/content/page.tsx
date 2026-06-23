'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  FileVideo, ImageIcon, FileText, Music, Folder, FolderHeart, Upload, Search,
  LayoutGrid, List, RefreshCw, MoreVertical, Pencil, Trash2,
  FolderPlus, Eye, FolderInput, ChevronLeft, ChevronRight,
  Play, FileIcon, Clock, Star, X, Check
} from 'lucide-react';
import { cmsApi } from '@/lib/api';


// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  name: string;
  originalName: string;
  contentType: 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'FOLDER' | 'TEMPLATE' | 'APP_YOUTUBE' | string;
  thumbLink?: string;
  permaLink?: string;
  size?: number;
  format?: string;
  updatedDate?: string;
  duration?: number;
}

interface StorageInfo {
  totalFilesSizeInBytes: string;
  totalImageFilesSizeInBytes: string;
  totalVideoFilesSizeInBytes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(secs?: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ContentTypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  switch (type) {
    case 'VIDEO':
    case 'APP_YOUTUBE': return <FileVideo size={size} />;
    case 'IMAGE': return <ImageIcon size={size} />;
    case 'DOCUMENT': return <FileText size={size} />;
    case 'AUDIO': return <Music size={size} />;
    case 'FOLDER': return <Folder size={size} />;
    default: return <FileIcon size={size} />;
  }
}

function typeColor(type: string) {
  const map: Record<string, string> = {
    VIDEO: 'var(--accent)', IMAGE: '#22c55e', AUDIO: '#f59e0b',
    DOCUMENT: '#3b82f6', FOLDER: '#a78bfa', TEMPLATE: '#ec4899',
  };
  return map[type] || '#6b7280';
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { label: 'All', value: 'ALL' },
  { label: 'Videos', value: 'VIDEO' },
  { label: 'Images', value: 'IMAGE' },
  { label: 'Folders', value: 'FOLDER' },
];

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const isVideo = item.contentType === 'VIDEO' || item.contentType === 'APP_YOUTUBE';
  const isImage = item.contentType === 'IMAGE';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <div className="preview-header-left">
            <ContentTypeIcon type={item.contentType} size={16} />
            <span>{item.originalName || item.name}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="preview-body">
          {isVideo && item.permaLink ? (
            <video src={item.permaLink} controls className="preview-media" />
          ) : isImage && item.permaLink ? (
            <img src={item.permaLink} alt={item.originalName} className="preview-media" />
          ) : item.thumbLink ? (
            <img src={item.thumbLink} alt={item.originalName} className="preview-media" />
          ) : (
            <div className="preview-placeholder">
              <ContentTypeIcon type={item.contentType} size={48} />
              <p>No preview available</p>
            </div>
          )}
        </div>
        <div className="preview-footer">
          <div className="preview-meta">
            <span>{item.contentType}</span>
            {item.size && <span>{formatSize(item.size)}</span>}
            {item.duration && <span>{formatDuration(item.duration)}</span>}
            <span>{formatDate(item.updatedDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmText = 'Confirm', isDanger = false, onClose, onConfirm }: {
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="small-modal-header">
          <h3>{title}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="small-modal-body">
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
        <div className="small-modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className={isDanger ? "btn-danger-custom" : "btn-primary"}
            onClick={handleConfirm}
            disabled={loading}
            id="confirm-modal-action-btn"
          >
            {loading && <RefreshCw size={13} className="spin" style={{ marginRight: 6 }} />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rename modal ─────────────────────────────────────────────────────────────

function RenameModal({ item, onClose, onSaved }: { item: ContentItem; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(item.originalName || item.name);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      if (item.contentType === 'FOLDER') {
        await cmsApi.put('/dc/folder', { id: item.id, name: value.trim() });
      } else {
        await cmsApi.put('/cc/content', { id: item.id, name: value.trim() });
      }
      toast.success('Renamed successfully');
      onSaved();
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      console.error('Rename error:', err?.response?.data || err);
      toast.error(`Failed to rename: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="small-modal-header">
          <h3>Rename {item.contentType === 'FOLDER' ? 'Folder' : 'File'}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="small-modal-body">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="rename-input"
            id="rename-input"
          />
        </div>
        <div className="small-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving} id="confirm-rename-btn">
            {saving ? <RefreshCw size={13} className="spin" /> : <Check size={13} />}
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Folder modal ──────────────────────────────────────────────────────

function CreateFolderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await cmsApi.post('/dc/folder', { name: name.trim() });
      toast.success('Folder created');
      onCreated();
      onClose();
    } catch {
      toast.error('Failed to create folder');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="small-modal-header">
          <h3>Create Folder</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="small-modal-body">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Folder name…"
            className="rename-input"
            id="folder-name-input"
          />
        </div>
        <div className="small-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={create} disabled={saving || !name.trim()} id="create-folder-btn">
            {saving ? <RefreshCw size={13} className="spin" /> : <FolderPlus size={13} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add to Folder Modal ─────────────────────────────────────────────────────

function AddToFolderModal({ item, onClose, onSaved }: {
  item: ContentItem; onClose: () => void; onSaved: () => void;
}) {
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cmsApi.get('/dc/folder?paging=false')
      .then(({ data }) => setFolders(Array.isArray(data) ? data : (data.content || [])))
      .catch(() => toast.error('Failed to load folders'))
      .finally(() => setLoading(false));
  }, []);

  async function move() {
    if (!selectedFolderId) return;
    setSaving(true);
    try {
      await cmsApi.put(`/fcc/folder/${selectedFolderId}/content`, { contentIds: [item.id] });
      toast.success(`"${item.originalName}" moved to folder`);
      onSaved();
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      console.error('Move to folder error:', err?.response?.data || err);
      toast.error(`Failed to move: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={e => e.stopPropagation()}>
        <div className="small-modal-header">
          <h3>Add to Folder</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="small-modal-body">
          <p className="modal-desc">Move <strong>{item.originalName}</strong> into a folder:</p>
          {loading ? (
            <div className="modal-loading-sm"><RefreshCw size={16} className="spin" /> Loading folders…</div>
          ) : folders.length === 0 ? (
            <p className="modal-empty-sm">No folders found. Create a folder first.</p>
          ) : (
            <div className="folder-list">
              {folders.map((f: any) => (
                <label
                  key={f.id}
                  className={`folder-row ${selectedFolderId === f.id ? 'folder-row-selected' : ''}`}
                  id={`folder-option-${f.id}`}
                >
                  <input
                    type="radio"
                    name="folder-select"
                    value={f.id}
                    checked={selectedFolderId === f.id}
                    onChange={() => setSelectedFolderId(f.id)}
                  />
                  <Folder size={15} />
                  <span>{f.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="small-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={move}
            disabled={!selectedFolderId || saving}
            id="confirm-add-folder-btn"
          >
            {saving ? <RefreshCw size={13} className="spin" /> : <FolderInput size={13} />}
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Show Playlists Modal ─────────────────────────────────────────────────────

function ShowPlaylistsModal({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cmsApi.get(`/cc/content/${item.id}/asset-in-use`)
      .then(({ data }) => setPlaylists(Array.isArray(data) ? data : (data.playlists || [])))
      .catch(() => toast.error('Failed to load playlists'))
      .finally(() => setLoading(false));
  }, [item.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={e => e.stopPropagation()}>
        <div className="small-modal-header">
          <h3>Playlists using this</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="small-modal-body">
          <p className="modal-desc">Content: <strong>{item.originalName}</strong></p>
          {loading ? (
            <div className="modal-loading-sm"><RefreshCw size={16} className="spin" /> Checking playlists…</div>
          ) : playlists.length === 0 ? (
            <p className="modal-empty-sm">This content is not used in any playlist.</p>
          ) : (
            <div className="playlist-use-list">
              {playlists.map((pl: any, i: number) => (
                <div key={pl.id || i} className="playlist-use-row">
                  <FolderHeart size={14} />
                  <span>{pl.name || pl.playlistName || `Playlist ${pl.id}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="small-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Item context menu ────────────────────────────────────────────────────────

function ItemMenu({ item, isInsideFolder, onPreview, onRename, onAddFolder, onShowPlaylists, onDelete, onClose }: {
  item: ContentItem; isInsideFolder?: boolean; onPreview: () => void; onRename: () => void;
  onAddFolder: () => void; onShowPlaylists: () => void;
  onDelete: () => void; onClose: () => void;
}) {
  const isNotFolder = item.contentType !== 'FOLDER';
  return (
    <div className="item-menu" onClick={(e) => e.stopPropagation()}>
      {isNotFolder && (
        <button className="item-menu-btn" onClick={() => { onPreview(); onClose(); }}><Eye size={13} /> Preview</button>
      )}
      <button className="item-menu-btn" onClick={() => { onRename(); onClose(); }}><Pencil size={13} /> Rename</button>
      {isNotFolder && (
        <button className="item-menu-btn" onClick={() => { onAddFolder(); onClose(); }}><FolderInput size={13} /> Add to Folder</button>
      )}
      {isNotFolder && (
        <button className="item-menu-btn" onClick={() => { onShowPlaylists(); onClose(); }}><Star size={13} /> Show Playlists</button>
      )}
      <div className="item-menu-divider" />
      <button className="item-menu-btn item-menu-danger" onClick={() => { onDelete(); onClose(); }}>
        <Trash2 size={13} /> {isInsideFolder ? 'Remove' : 'Delete'}
      </button>
    </div>
  );
}

// ─── Upload progress area ─────────────────────────────────────────────────────

interface UploadEntry { name: string; progress: number; done: boolean; error?: boolean; }

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentManagerPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'all' | 'recent'>('all');
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 0, size: 50, total: 0 });

  // Modals
  const [previewItem, setPreviewItem]         = useState<ContentItem | null>(null);
  const [renameItem,  setRenameItem]          = useState<ContentItem | null>(null);
  const [addFolderItem, setAddFolderItem]     = useState<ContentItem | null>(null);
  const [showPlaylistsItem, setShowPlaylistsItem] = useState<ContentItem | null>(null);
  const [activeMenu, setActiveMenu]           = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [confirmState, setConfirmState]       = useState<{
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Outside click for active menu ──
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (!(e.target as Element)?.closest('.item-menu') && !(e.target as Element)?.closest('.card-menu-btn')) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // ── Fetch storage info ──
  useEffect(() => {
    cmsApi.get('/cc/content/do-space-usage')
      .then(({ data }) => setStorageInfo(data))
      .catch(() => {});
  }, []);

  // ── Fetch content ──
  // ── State ──
  const [activeFolder, setActiveFolder] = useState<{ id: string, name: string } | null>(null);

  const fetchContent = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        size: pagination.size,
        sortBy: sortMode === 'recent' ? 'lastUsedDate' : 'updatedDate',
        sortOrder: 'DESC',
        contentType: filterType,
      };
      if (search) params.search = search;

      let url = filterType === 'FOLDER' ? '/dc/folder' : '/cc/content';
      if (activeFolder) {
        url = `/fcc/folder/${activeFolder.id}/content/pagination`;
        delete params.contentType; // Folder contents endpoint doesn't filter by type
      }

      const { data } = await cmsApi.get(url, { params });
      const raw: any[] = data?.contents?.content || data.content || data.folders || data.items || [];

      const mapped: ContentItem[] = raw.map((item: any) => ({
        id: item.id || item._id,
        originalName: item.name || item.templateName || '',
        name: item.name || item.templateName || '',
        contentType: item.contentType || (filterType === 'FOLDER' ? 'FOLDER' : 'IMAGE'),
        thumbLink: item.thumbLink,
        permaLink: item.permaLink || item.perma_link,
        size: item.size,
        format: item.format,
        updatedDate: item.updatedDate,
        duration: item.duration || item.videoDuration,
      }));

      setItems(mapped);
      setPagination(p => ({ ...p, page, total: data.totalElements || mapped.length }));
    } catch {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [filterType, sortMode, search, pagination.size, activeFolder]);

  useEffect(() => {
    fetchContent(0);
  }, [filterType, sortMode, fetchContent, activeFolder]);

  // ── Upload files ──
  async function uploadFiles(files: File[]) {
    const entries: UploadEntry[] = files.map(f => ({ name: f.name, progress: 0, done: false }));
    setUploads(prev => [...prev, ...entries]);
    const startIdx = uploads.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();

      if (activeFolder) {
        formData.append('files', file);

        try {
          await cmsApi.post(`/fcc/folder/${activeFolder.id}/upload`, formData, {
            onUploadProgress: (e) => {
              const pct = Math.round((e.loaded * 100) / (e.total || 1));
              setUploads(prev => {
                const next = [...prev];
                next[startIdx + i] = { ...next[startIdx + i], progress: pct };
                return next;
              });
            },
          });
          setUploads(prev => {
            const next = [...prev];
            next[startIdx + i] = { ...next[startIdx + i], progress: 100, done: true };
            return next;
          });
        } catch {
          setUploads(prev => {
            const next = [...prev];
            next[startIdx + i] = { ...next[startIdx + i], error: true, done: true };
            return next;
          });
          toast.error(`Failed to upload ${file.name}`);
        }
      } else {
        const uuid = Math.random().toString(36).substr(2) + Date.now().toString(36);
        formData.append('file', file);
        formData.append('folderId', '0');
        formData.append('fileName', file.name);
        formData.append('fileType', file.type || 'application/octet-stream');
        formData.append('filesize', file.size.toString());
        formData.append('chunkindex', '0');
        formData.append('totalChunks', '1');
        formData.append('uuid', uuid);
        formData.append('cancelUpload', 'false');

        try {
          await cmsApi.post('/cc/content/chunk', formData, {
            onUploadProgress: (e) => {
              const pct = Math.round((e.loaded * 100) / (e.total || 1));
              setUploads(prev => {
                const next = [...prev];
                next[startIdx + i] = { ...next[startIdx + i], progress: pct };
                return next;
              });
            },
          });
          setUploads(prev => {
            const next = [...prev];
            next[startIdx + i] = { ...next[startIdx + i], progress: 100, done: true };
            return next;
          });
        } catch {
          setUploads(prev => {
            const next = [...prev];
            next[startIdx + i] = { ...next[startIdx + i], error: true, done: true };
            return next;
          });
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    }

    setTimeout(() => {
      setUploads([]);
      fetchContent(0);
    }, 2000);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  }

  // ── Delete (works for ALL content types) ──
  function deleteItem(item: ContentItem) {
    setConfirmState({
      title: item.contentType === 'FOLDER' ? 'Delete Folder' : 'Delete File',
      message: `Are you sure you want to delete "${item.originalName || item.name}"?`,
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: async () => {
        try {
          if (item.contentType === 'FOLDER') {
            const { data } = await cmsApi.delete('/dc/folder', { data: { folderIds: [item.id] } });
            if (Array.isArray(data) && data.length > 0) {
              const res = data[0];
              if (res.deleted) {
                toast.success('Folder deleted');
              } else {
                toast.error(res.message || 'Failed to delete folder');
                return;
              }
            }
          } else {
            await cmsApi.delete('/cc/content/', { data: { contentIds: [item.id] } });
            toast.success('Deleted');
          }
          fetchContent(pagination.page);
        } catch (err: any) {
          const errMsg = err?.response?.data?.message || err?.message || 'Unknown error';
          console.error('Delete error:', err?.response?.data || err);
          toast.error(`Failed to delete: ${errMsg}`);
        } finally {
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      }
    });
  }

  // ── Bulk delete ──
  function bulkDelete() {
    if (!selectedIds.size) return;
    setConfirmState({
      title: 'Delete Selected Items',
      message: `Are you sure you want to delete ${selectedIds.size} selected items?`,
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: async () => {
        try {
          const itemsToDelete = items.filter(i => selectedIds.has(i.id));
          const folderIds = itemsToDelete.filter(i => i.contentType === 'FOLDER').map(i => i.id);
          const contentIds = itemsToDelete.filter(i => i.contentType !== 'FOLDER').map(i => i.id);

          let successCount = 0;
          let errorMessages: string[] = [];

          if (folderIds.length > 0) {
            const { data } = await cmsApi.delete('/dc/folder', { data: { folderIds } });
            if (Array.isArray(data)) {
              data.forEach(res => {
                if (res.deleted) successCount++;
                else errorMessages.push(res.message || 'Failed to delete folder');
              });
            }
          }
          if (contentIds.length > 0) {
            await cmsApi.delete('/cc/content/', { data: { contentIds } });
            successCount += contentIds.length;
          }
          
          if (errorMessages.length > 0) {
            toast.error(`Deleted ${successCount}. Errors: ${errorMessages[0]}`);
          } else {
            toast.success(`${successCount} items deleted`);
          }
          
          fetchContent(pagination.page);
        } catch {
          toast.error('Bulk delete failed');
        } finally {
          setSelectedIds(new Set());
        }
      }
    });
  }

  // ── Remove content from folder ──
  function removeItemFromFolder(item: ContentItem) {
    if (!activeFolder) return;
    setConfirmState({
      title: 'Remove from Folder',
      message: `Are you sure you want to remove "${item.originalName || item.name}" from this folder?`,
      confirmText: 'Remove',
      isDanger: true,
      onConfirm: async () => {
        try {
          await cmsApi.delete(`/fcc/folder/${activeFolder.id}/content`, { data: { contentIds: [item.id] } });
          toast.success('Removed from folder');
          fetchContent(pagination.page);
        } catch (err: any) {
          const errMsg = err?.response?.data?.message || err?.message || 'Unknown error';
          console.error('Remove error:', err?.response?.data || err);
          toast.error(`Failed to remove item from folder: ${errMsg}`);
        } finally {
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      }
    });
  }

  // ── Bulk remove content from folder ──
  function bulkRemoveFromFolder() {
    if (!activeFolder || !selectedIds.size) return;
    setConfirmState({
      title: 'Remove Selected from Folder',
      message: `Are you sure you want to remove ${selectedIds.size} items from this folder?`,
      confirmText: 'Remove',
      isDanger: true,
      onConfirm: async () => {
        try {
          const contentIds = Array.from(selectedIds);
          await cmsApi.delete(`/fcc/folder/${activeFolder.id}/content`, { data: { contentIds } });
          toast.success(`${selectedIds.size} items removed from folder`);
          fetchContent(pagination.page);
        } catch {
          toast.error('Failed to remove items from folder');
        } finally {
          setSelectedIds(new Set());
        }
      }
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalPages = Math.ceil(pagination.total / pagination.size);

  // ── Filtered items by search ──
  const displayed = search
    ? items.filter(i => i.originalName.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div
      className={`content-page${isDragging ? ' drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* ── Storage banner ── */}
      {storageInfo && (
        <div className="storage-bar">
          <div className="storage-stat">
            <ImageIcon size={14} />
            <span>Images: {formatSize(Number(storageInfo.totalImageFilesSizeInBytes))}</span>
          </div>
          <div className="storage-divider" />
          <div className="storage-stat">
            <FileVideo size={14} />
            <span>Videos: {formatSize(Number(storageInfo.totalVideoFilesSizeInBytes))}</span>
          </div>
          <div className="storage-divider" />
          <div className="storage-stat">
            <FileIcon size={14} />
            <span>Total: {formatSize(Number(storageInfo.totalFilesSizeInBytes))}</span>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="content-toolbar">
        <div className="toolbar-left">
          {activeFolder ? (
            <div className="active-folder-nav">
              <button className="btn-secondary" onClick={() => setActiveFolder(null)} title="Back to Root">
                <ChevronLeft size={16} /> Back
              </button>
              <h2 className="folder-title"><Folder size={18} fill="currentColor" color="#fbbf24" /> {activeFolder.name}</h2>
            </div>
          ) : (
            <div className="sort-toggle">
              <button
                id="filter-all"
                className={`sort-btn${sortMode === 'all' ? ' active' : ''}`}
                onClick={() => setSortMode('all')}
              >All</button>
              <button
                id="filter-recent"
                className={`sort-btn${sortMode === 'recent' ? ' active' : ''}`}
                onClick={() => setSortMode('recent')}
              >
                <Clock size={12} />Recent
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-center">
          {/* Type filter tabs (hidden if inside a folder since folders contain mixed content) */}
          {!activeFolder && (
            <div className="type-tabs">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.value}
                  id={`type-tab-${tab.value.toLowerCase()}`}
                  className={`type-tab${filterType === tab.value ? ' active' : ''}`}
                  onClick={() => setFilterType(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-right">
          {/* Search */}
          <div className="search-wrap-sm">
            <Search size={13} className="search-ic" />
            <input
              id="content-search"
              className="search-sm"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* View toggle */}
          <div className="view-toggle">
            <button
              id="view-grid"
              className={`view-btn${viewType === 'grid' ? ' active' : ''}`}
              onClick={() => setViewType('grid')}
              title="Grid view"
            ><LayoutGrid size={14} /></button>
            <button
              id="view-list"
              className={`view-btn${viewType === 'list' ? ' active' : ''}`}
              onClick={() => setViewType('list')}
              title="List view"
            ><List size={14} /></button>
          </div>

          {/* Actions */}
          <button className="btn-secondary" onClick={() => setShowCreateFolder(true)} id="new-folder-btn">
            <FolderPlus size={14} />
            New Folder
          </button>
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()} id="upload-btn">
            <Upload size={14} />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
            accept="video/*,image/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx"
            id="file-upload-input"
          />
        </div>
      </div>

      {/* ── Bulk actions ── */}
      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button className="bulk-btn" onClick={() => setSelectedIds(new Set())}><X size={13} /> Deselect</button>
          {activeFolder ? (
            <button className="bulk-btn bulk-danger" onClick={bulkRemoveFromFolder} id="bulk-remove-btn">
              <Trash2 size={13} /> Remove selected
            </button>
          ) : (
            <button className="bulk-btn bulk-danger" onClick={bulkDelete} id="bulk-delete-btn">
              <Trash2 size={13} /> Delete selected
            </button>
          )}
        </div>
      )}

      {/* ── Upload progress ── */}
      {uploads.length > 0 && (
        <div className="upload-progress-list">
          {uploads.map((u, i) => (
            <div key={i} className="upload-entry">
              <span className="upload-name">{u.name}</span>
              <div className="upload-bar">
                <div
                  className={`upload-fill${u.error ? ' upload-error' : u.done ? ' upload-done' : ''}`}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
              <span className="upload-pct">{u.error ? 'Error' : u.done ? '✓' : `${u.progress}%`}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Drag overlay ── */}
      {isDragging && (
        <div className="drop-overlay">
          <Upload size={40} />
          <p>Drop files to upload</p>
        </div>
      )}

      {/* ── Content area ── */}
      {loading ? (
        <div className="content-loading">
          <RefreshCw size={24} className="spin" />
          <span>Loading content…</span>
        </div>
      ) : displayed.length === 0 ? (
        <div className="content-empty">
          <FileVideo size={48} opacity={.15} />
          <h3>{activeFolder ? 'This folder is empty' : `No ${filterType === 'ALL' ? 'content' : filterType.toLowerCase() + 's'} found`}</h3>
          <p>{activeFolder ? 'Upload files to add them to this folder' : 'Upload files or create a folder to get started'}</p>
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()} id="empty-upload-btn">
            <Upload size={14} /> Upload Files
          </button>
        </div>
      ) : viewType === 'grid' ? (
        <div className="content-grid">
          {displayed.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`content-card${isSelected ? ' selected' : ''}${item.contentType === 'FOLDER' ? ' folder-card' : ''}`}
                onClick={() => setActiveMenu(null)}
                id={`content-item-${item.id}`}
              >
                {/* Thumbnail */}
                <div className="card-thumb" 
                     onClick={() => { if (item.contentType !== 'FOLDER') setPreviewItem(item); }}
                     onDoubleClick={() => { if (item.contentType === 'FOLDER') setActiveFolder({ id: item.id, name: item.originalName }); }}>
                  {item.thumbLink ? (
                    <img src={item.thumbLink} alt={item.originalName} className="thumb-img" />
                  ) : (
                    <div className="thumb-placeholder" style={{ color: typeColor(item.contentType) }}>
                      <ContentTypeIcon type={item.contentType} size={item.contentType === 'FOLDER' ? 44 : 32} />
                    </div>
                  )}
                  {item.duration && (
                    <span className="duration-badge">{formatDuration(item.duration)}</span>
                  )}
                  {(item.contentType === 'VIDEO' || item.contentType === 'APP_YOUTUBE') && (
                    <div className="play-overlay"><Play size={20} fill="white" /></div>
                  )}
                </div>

                {/* Footer */}
                <div className="card-footer">
                  <input
                    type="checkbox"
                    className="card-checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    id={`select-${item.id}`}
                  />
                  <div className="card-name" title={item.originalName}>{item.originalName}</div>

                  <div className="card-menu-wrap">
                    <button
                      className="card-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === item.id ? null : item.id);
                      }}
                      id={`menu-${item.id}`}
                    ><MoreVertical size={14} /></button>
                    {activeMenu === item.id && (
                      <ItemMenu
                        item={item}
                        isInsideFolder={!!activeFolder}
                        onPreview={() => setPreviewItem(item)}
                        onRename={() => setRenameItem(item)}
                        onAddFolder={() => setAddFolderItem(item)}
                        onShowPlaylists={() => setShowPlaylistsItem(item)}
                        onDelete={() => {
                          if (activeFolder) {
                            removeItemFromFolder(item);
                          } else {
                            deleteItem(item);
                          }
                        }}
                        onClose={() => setActiveMenu(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="content-table-wrap">
          <table className="content-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Name</th>
                <th>Type</th>
                <th>Modified</th>
                <th>Size</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr key={item.id} className={isSelected ? 'row-selected' : ''} id={`row-${item.id}`} onDoubleClick={() => { if (item.contentType === 'FOLDER') setActiveFolder({ id: item.id, name: item.originalName }); }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        id={`check-${item.id}`}
                      />
                    </td>
                    <td>
                      <div className="list-name-cell">
                        <div className="list-thumb">
                          {item.thumbLink
                            ? <img src={item.thumbLink} alt="" className="list-thumb-img" />
                            : <div className={item.contentType === 'FOLDER' ? 'folder-icon-list' : ''} style={{ color: typeColor(item.contentType) }}>
                                <ContentTypeIcon type={item.contentType} size={18} />
                              </div>
                          }
                        </div>
                        <span className="list-name">{item.originalName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="type-pill" style={{ background: typeColor(item.contentType) + '22', color: typeColor(item.contentType) }}>
                        {item.contentType}
                      </span>
                    </td>
                    <td className="list-meta">{formatDate(item.updatedDate)}</td>
                    <td className="list-meta">{formatSize(item.size)}</td>
                    <td>
                      <div className="list-actions">
                        {item.contentType !== 'FOLDER' && (
                          <button className="action-icon-btn" onClick={() => setPreviewItem(item)} title="Preview" id={`preview-${item.id}`}><Eye size={13} /></button>
                        )}
                        <button className="action-icon-btn" onClick={() => setRenameItem(item)} title="Rename" id={`rename-${item.id}`}><Pencil size={13} /></button>
                        {item.contentType !== 'FOLDER' && (
                          <button className="action-icon-btn" onClick={() => setAddFolderItem(item)} title="Add to Folder" id={`folder-${item.id}`}><FolderInput size={13} /></button>
                        )}
                        {item.contentType !== 'FOLDER' && (
                          <button className="action-icon-btn" onClick={() => setShowPlaylistsItem(item)} title="Show Playlists" id={`playlists-${item.id}`}><Star size={13} /></button>
                        )}
                        <button
                          className="action-icon-btn action-danger-icon"
                          onClick={() => {
                            if (activeFolder) {
                              removeItemFromFolder(item);
                            } else {
                              deleteItem(item);
                            }
                          }}
                          title={activeFolder ? "Remove from Folder" : "Delete"}
                          id={`delete-${item.id}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="content-pagination">
          <span className="page-info">{pagination.total} items · Page {pagination.page + 1}/{totalPages}</span>
          <div className="page-btns">
            <button
              className="page-btn"
              disabled={pagination.page === 0}
              onClick={() => fetchContent(pagination.page - 1)}
              id="content-prev-page"
            ><ChevronLeft size={14} /></button>
            <button
              className="page-btn"
              disabled={pagination.page >= totalPages - 1}
              onClick={() => fetchContent(pagination.page + 1)}
              id="content-next-page"
            ><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Modals */}
      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
      {renameItem && (
        <RenameModal item={renameItem} onClose={() => setRenameItem(null)} onSaved={() => fetchContent(pagination.page)} />
      )}
      {showCreateFolder && (
        <CreateFolderModal onClose={() => setShowCreateFolder(false)} onCreated={() => fetchContent(0)} />
      )}
      {addFolderItem && (
        <AddToFolderModal item={addFolderItem} onClose={() => setAddFolderItem(null)} onSaved={() => fetchContent(pagination.page)} />
      )}
      {showPlaylistsItem && (
        <ShowPlaylistsModal item={showPlaylistsItem} onClose={() => setShowPlaylistsItem(null)} />
      )}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          isDanger={confirmState.isDanger}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}

      <style>{`
        .content-page { padding: 1.25rem 2rem; position: relative; min-height: 60vh; }
        .content-page.drag-over { outline: 2px dashed var(--accent); outline-offset: -4px; }

        /* Add-to-folder / Show-playlists modal extras */
        .modal-desc { font-size: .85rem; color: var(--text-muted); margin: 0 0 .75rem; }
        .modal-loading-sm { display: flex; align-items: center; gap: .5rem; font-size: .85rem; color: var(--text-muted); padding: 1rem 0; }
        .modal-empty-sm { font-size: .85rem; color: var(--text-muted); margin: 0; }
        .folder-list { display: flex; flex-direction: column; gap: .4rem; max-height: 220px; overflow-y: auto; }
        .folder-row { display: flex; align-items: center; gap: .65rem; padding: .6rem .75rem; border: 1px solid var(--border); border-radius: 9px; cursor: pointer; font-size: .85rem; transition: border-color .15s; }
        .folder-row input[type=radio] { display: none; }
        .folder-row:hover { border-color: var(--accent); }
        .folder-row-selected { border-color: var(--accent); background: rgba(99,102,241,.07); font-weight: 600; }
        .playlist-use-list { display: flex; flex-direction: column; gap: .4rem; max-height: 220px; overflow-y: auto; }
        .playlist-use-row { display: flex; align-items: center; gap: .65rem; padding: .6rem .75rem; border: 1px solid var(--border); border-radius: 9px; font-size: .85rem; }

        /* Storage bar */
        .storage-bar {
          display: flex; align-items: center; gap: 1rem;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 12px; padding: .6rem 1.25rem; margin-bottom: 1rem;
          font-size: .78rem; color: var(--text-muted);
        }
        .storage-stat { display: flex; align-items: center; gap: .4rem; }
        .storage-divider { width: 1px; height: 16px; background: var(--border); }

        /* Toolbar */
        .content-toolbar {
          display: flex; align-items: center; gap: .75rem;
          margin-bottom: 1rem; flex-wrap: wrap;
        }
        .toolbar-left { display: flex; align-items: center; gap: 1rem; }
        .toolbar-left h2 { font-size: 1.15rem; font-weight: 600; color: var(--text); margin: 0; }
        .active-folder-nav { display: flex; align-items: center; gap: 1rem; }
        .folder-title { display: flex; align-items: center; gap: .5rem; font-size: 1.15rem; font-weight: 600; color: var(--text); margin: 0; }
        .usage-indicator { display: flex; align-items: center; gap: .5rem; margin-left: auto; }
        .toolbar-center { flex: 1; display: flex; justify-content: center; }
        .toolbar-right { display: flex; align-items: center; gap: .5rem; margin-left: auto; }

        /* Sort toggle */
        .sort-toggle {
          display: flex; background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; overflow: hidden;
        }
        .sort-btn {
          display: flex; align-items: center; gap: .3rem;
          padding: .45rem .85rem; font-size: .78rem; font-weight: 600;
          border: none; background: transparent; cursor: pointer; color: var(--text-muted);
          transition: all .15s;
        }
        .sort-btn.active { background: var(--accent); color: white; }

        /* Type tabs */
        .type-tabs {
          display: flex; gap: .25rem;
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .25rem;
        }
        .type-tab {
          padding: .35rem .85rem; font-size: .78rem; font-weight: 600;
          border: none; background: transparent; cursor: pointer;
          color: var(--text-muted); border-radius: 8px; transition: all .15s;
        }
        .type-tab.active { background: var(--card-bg); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.2); }
        .type-tab:hover:not(.active) { color: var(--text); }

        /* Search */
        .search-wrap-sm { position: relative; }
        .search-ic { position: absolute; left: .6rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .search-sm {
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .45rem .85rem .45rem 2rem;
          font-size: .8rem; color: var(--text); outline: none; width: 180px;
        }
        .search-sm:focus { border-color: var(--accent); }

        /* View toggle */
        .view-toggle {
          display: flex; background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; overflow: hidden;
        }
        .view-btn {
          padding: .45rem .65rem; border: none; background: transparent;
          cursor: pointer; color: var(--text-muted); transition: all .15s;
        }
        .view-btn.active { background: var(--card-bg); color: var(--text); }

        /* Buttons */
        .btn-primary {
          display: inline-flex; align-items: center; gap: .4rem;
          background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none;
          padding: .5rem 1rem; border-radius: 12px; font-size: .8rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease; white-space: nowrap;
        }
        .btn-primary:hover { background: var(--btn-cta-hover); }
        .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
        .btn-danger-custom {
          display: inline-flex; align-items: center; gap: .4rem;
          background: #ef4444; color: white; border: none;
          padding: .5rem 1rem; border-radius: 12px; font-size: .8rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.08); transition: all 0.2s ease; white-space: nowrap;
        }
        .btn-danger-custom:hover { background: #dc2626; }
        .btn-danger-custom:disabled { opacity: .55; cursor: not-allowed; }
        .btn-secondary {
          display: inline-flex; align-items: center; gap: .4rem;
          background: var(--btn-secondary-bg); color: var(--btn-secondary-text);
          border: 1px solid var(--btn-secondary-border);
          padding: .5rem 1rem; border-radius: 12px; font-size: .8rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
        }
        .btn-secondary:hover { background: var(--btn-secondary-hover); }
        .btn-ghost {
          background: transparent; border: 1px solid var(--border);
          color: var(--text); padding: .5rem 1rem; border-radius: 10px;
          font-size: .875rem; cursor: pointer;
        }

        /* Bulk bar */
        .bulk-bar {
          display: flex; align-items: center; gap: .75rem;
          background: var(--accent); color: white;
          border-radius: 10px; padding: .6rem 1rem; margin-bottom: .75rem;
          font-size: .875rem; font-weight: 600;
        }
        .bulk-btn {
          display: inline-flex; align-items: center; gap: .35rem;
          background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.2);
          color: white; padding: .35rem .75rem; border-radius: 8px;
          font-size: .78rem; cursor: pointer;
        }
        .bulk-danger { background: rgba(239,68,68,.3); border-color: rgba(239,68,68,.4); }

        /* Upload progress */
        .upload-progress-list {
          display: flex; flex-direction: column; gap: .5rem;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 12px; padding: .75rem 1rem; margin-bottom: .75rem;
        }
        .upload-entry { display: flex; align-items: center; gap: .75rem; }
        .upload-name { font-size: .78rem; flex: 0 0 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .upload-bar { flex: 1; height: 4px; background: var(--border); border-radius: 999px; overflow: hidden; }
        .upload-fill { height: 100%; background: var(--accent); transition: width .1s; }
        .upload-done { background: #22c55e; }
        .upload-error { background: #ef4444; }
        .upload-pct { font-size: .75rem; color: var(--text-muted); flex: 0 0 36px; text-align: right; }

        /* Drop overlay */
        .drop-overlay {
          position: fixed; inset: 0; background: rgba(99,102,241,.15);
          border: 3px dashed var(--accent); display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 1rem; z-index: 200;
          color: var(--accent); font-size: 1.1rem; font-weight: 600; pointer-events: none;
        }

        /* Loading / empty */
        .content-loading, .content-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 1rem; padding: 4rem 2rem; color: var(--text-muted); text-align: center;
        }
        .content-empty h3 { font-size: 1.1rem; font-weight: 600; margin: 0; color: var(--text); }
        .content-empty p { margin: 0; font-size: .875rem; }

        /* Grid */
        .content-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 1rem;
        }
        .folder-card .thumb-placeholder {
          color: #000000 !important;
        }
        html.dark .folder-card .thumb-placeholder {
          color: #ffffff !important;
        }
        .folder-icon-list {
          color: #000000 !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        html.dark .folder-icon-list {
          color: #ffffff !important;
        }

        /* Card */
        .content-card {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 14px; transition: box-shadow .2s, border-color .2s;
          cursor: pointer;
        }
        .content-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.2); border-color: rgba(99,102,241,.3); }
        .content-card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }

        /* Thumb */
        .card-thumb {
          position: relative; aspect-ratio: 16/9; overflow: hidden;
          background: var(--sidebar-bg);
          border-radius: 13px 13px 0 0;
        }
        .thumb-img { width: 100%; height: 100%; object-fit: cover; }
        .thumb-placeholder {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        }
        .duration-badge {
          position: absolute; bottom: 4px; right: 4px;
          background: rgba(0,0,0,.7); color: white; font-size: .65rem; font-weight: 600;
          padding: .1rem .4rem; border-radius: 4px;
        }
        .play-overlay {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,.3); opacity: 0; transition: opacity .15s;
        }
        .card-thumb:hover .play-overlay { opacity: 1; }

        /* Card footer */
        .card-footer {
          display: flex; align-items: center; gap: .4rem;
          padding: .6rem .75rem;
        }
        .card-checkbox { flex-shrink: 0; cursor: pointer; accent-color: var(--accent); }
        .card-name {
          flex: 1; font-size: .75rem; font-weight: 500; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        .card-menu-wrap { position: relative; }
        .card-menu-btn {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); padding: .2rem; border-radius: 6px;
          display: flex;
        }
        .card-menu-btn:hover { background: var(--sidebar-hover); }

        /* Context menu */
        .item-menu {
          position: absolute; right: 0; top: 100%; z-index: 100;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .35rem; box-shadow: 0 8px 30px rgba(0,0,0,.3);
          min-width: 150px;
        }
        .item-menu-btn {
          display: flex; align-items: center; gap: .5rem;
          width: 100%; padding: .5rem .75rem; font-size: .8rem;
          border: none; background: transparent; cursor: pointer;
          color: var(--text-muted); border-radius: 7px; text-align: left;
          transition: background .1s;
        }
        .item-menu-btn:hover { background: var(--sidebar-hover); color: var(--text); }
        .item-menu-danger:hover { background: #fee2e2; color: #ef4444; }
        .item-menu-divider { height: 1px; background: var(--border); margin: .25rem 0; }

        /* List view */
        .content-table-wrap {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; overflow: hidden;
        }
        .content-table { width: 100%; border-collapse: collapse; }
        .content-table th {
          text-align: left; padding: .75rem 1rem;
          font-size: .72rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; color: var(--text-muted);
          border-bottom: 1px solid var(--border); background: var(--sidebar-bg);
        }
        .content-table td {
          padding: .75rem 1rem; border-bottom: 1px solid var(--border);
          font-size: .85rem; color: var(--text);
        }
        .content-table tr:last-child td { border-bottom: none; }
        .content-table tr.row-selected td { background: rgba(99,102,241,.06); }
        .content-table tr:hover td { background: var(--sidebar-hover); }
        .list-name-cell { display: flex; align-items: center; gap: .75rem; }
        .list-thumb {
          width: 36px; height: 36px; border-radius: 8px; overflow: hidden;
          background: var(--sidebar-bg); display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .list-thumb-img { width: 100%; height: 100%; object-fit: cover; }
        .list-name { font-weight: 500; }
        .list-meta { color: var(--text-muted); font-size: .8rem; }
        .type-pill {
          font-size: .65rem; font-weight: 700; padding: .2rem .6rem;
          border-radius: 999px; letter-spacing: .04em;
        }
        .list-actions { display: flex; gap: .25rem; }
        .action-icon-btn {
          width: 28px; height: 28px; border-radius: 7px; border: none;
          background: transparent; cursor: pointer; color: var(--text-muted);
          display: flex; align-items: center; justify-content: center; transition: all .15s;
        }
        .action-icon-btn:hover { background: var(--sidebar-hover); color: var(--text); }
        .action-danger-icon:hover { background: #fee2e2; color: #ef4444; }

        /* Pagination */
        .content-pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 0; margin-top: .5rem;
        }
        .page-info { font-size: .8rem; color: var(--text-muted); }
        .page-btns { display: flex; gap: .25rem; }
        .page-btn {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--card-bg);
          cursor: pointer; color: var(--text);
          display: flex; align-items: center; justify-content: center;
        }
        .page-btn:disabled { opacity: .4; cursor: not-allowed; }
        .page-btn:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }

        /* Preview modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.7);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(6px);
        }
        .preview-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 18px; width: 800px; max-width: 95vw; max-height: 90vh;
          display: flex; flex-direction: column; box-shadow: 0 32px 80px rgba(0,0,0,.5);
          animation: modal-in .2s ease;
        }
        @keyframes modal-in { from { opacity:0; transform: scale(.95) translateY(10px); } }
        .preview-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
        }
        .preview-header-left { display: flex; align-items: center; gap: .5rem; font-size: .9rem; font-weight: 600; }
        .modal-close-btn { border: none; background: none; cursor: pointer; color: var(--text-muted); }
        .preview-body {
          flex: 1; overflow: hidden; display: flex; align-items: center;
          justify-content: center; background: #000; border-radius: 0;
          max-height: 500px;
        }
        .preview-media { max-width: 100%; max-height: 500px; object-fit: contain; }
        .preview-placeholder {
          display: flex; flex-direction: column; align-items: center; gap: 1rem;
          color: var(--text-muted); padding: 3rem;
        }
        .preview-footer { padding: .75rem 1.5rem; border-top: 1px solid var(--border); }
        .preview-meta {
          display: flex; align-items: center; gap: 1rem;
          font-size: .78rem; color: var(--text-muted);
        }

        /* Small modals */
        .small-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 18px; width: 400px; max-width: 95vw;
          box-shadow: 0 24px 64px rgba(0,0,0,.4); animation: modal-in .2s ease;
        }
        .small-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--border);
        }
        .small-modal-header h3 { font-size: .95rem; font-weight: 700; margin: 0; }
        .small-modal-header button { border: none; background: none; cursor: pointer; color: var(--text-muted); }
        .small-modal-body { padding: 1.25rem 1.5rem; }
        .rename-input {
          width: 100%; background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: .7rem 1rem; font-size: .9rem; color: var(--text);
          outline: none; box-sizing: border-box;
        }
        .rename-input:focus { border-color: var(--accent); }
        .small-modal-footer {
          padding: .875rem 1.5rem; border-top: 1px solid var(--border);
          display: flex; justify-content: flex-end; gap: .75rem;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .content-toolbar { gap: .5rem; }
          .toolbar-center { order: 3; width: 100%; }
          .type-tabs { overflow-x: auto; }
          .content-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
        }
      `}</style>
    </div>
  );
}
