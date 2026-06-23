'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Monitor, ArrowLeft, Save, RefreshCw,
  LayoutPanelTop, LayoutPanelLeft, ChevronDown,
  MapPin, Tag, Calendar, Wifi, WifiOff,
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { ContentSelectPopup } from '@/components/shared/ContentSelectPopup';
import CustomSelect from '@/components/shared/CustomSelect';

export default function EditScreenPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [screen, setScreen] = useState<any>(null);
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [placedAt, setPlacedAt] = useState('');
  const [selectedTagId, setSelectedTagId] = useState(0);
  const [selectedScheduleId, setSelectedScheduleId] = useState(0);

  const [defaultShowAssetType, setDefaultShowAssetType] = useState<'NONE' | 'MEDIA' | 'PLAYLIST'>('NONE');
  const [defaultShowAssetId, setDefaultShowAssetId] = useState<string | number>('');
  const [defaultShowAssetName, setDefaultShowAssetName] = useState<string>('');
  const [showContentSelect, setShowContentSelect] = useState(false);

  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [schedules, setSchedules] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    Promise.all([
      cmsApi.get(`/sc/screen/${id}`),
      cmsApi.get('/sc/screen-group', { params: { page: 0, size: 500, sortBy: 'updatedDate', sortOrder: 'DESC' } }),
      cmsApiV2.get('/scc/schedule', { params: { page: 0, size: 500, sortBy: 'updatedDate', sortOrder: 'DESC' } }),
    ]).then(([screenRes, tagsRes, schedulesRes]) => {
      const s = screenRes.data;
      setScreen(s);
      setName(s.name || '');
      setOrientation(s.orientation || 'horizontal');
      setPlacedAt(s.placedAt || '');
      setSelectedTagId(s.screenGroupId || 0);
      setSelectedScheduleId(s.selectedScheduleId || 0);
      setDefaultShowAssetType(s.defaultShowAssetType || 'NONE');
      setDefaultShowAssetId(s.defaultShowAssetId || '');
      setDefaultShowAssetName(s.defaultShowAssetName || '');
      setTags([{ id: 0, name: 'None' }, ...(tagsRes.data.content || [])]);
      setSchedules([{ id: 0, name: 'None' }, ...(schedulesRes.data.content || [])]);
    }).catch(() => {
      toast.error('Failed to load screen details');
    }).finally(() => setLoading(false));

    // Check live status
    cmsApi.get(`/misc/ws-status/screen/${id}`)
      .then(({ data }) => setIsLive(data === true || data?.online === true))
      .catch(() => {});
  }, [id]);

  async function handleSave() {
    if (!name.trim()) { toast.error('Screen name is required'); return; }
    setSaving(true);
    try {
      const { data } = await cmsApi.put('/sc/screen', {
        id: Number(id),
        name: name.trim(),
        orientation,
        placedAt: placedAt.trim(),
        screenGroupId: selectedTagId,
        selectedScheduleId,
        defaultShowAssetType,
        defaultShowAssetId: defaultShowAssetId ? String(defaultShowAssetId) : '',
        defaultShowAssetName,
      });

      if (data?.id) {
        toast.success('Screen updated successfully');
        router.push('/admin/screens');
      } else {
        toast.error('Failed to update screen');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update screen');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="edit-loading">
        <RefreshCw size={24} className="spin" />
        <span>Loading screen details…</span>
      </div>
    );
  }

  return (
    <div className="edit-page">
      {/* Header */}
      <div className="edit-header">
        <button className="back-btn" onClick={() => router.push('/admin/screens')} id="back-to-screens">
          <ArrowLeft size={16} /> Screens
        </button>
        <div className="header-info">
          <Monitor size={20} className="header-icon" />
          <div>
            <h1>{screen?.name || 'Edit Screen'}</h1>
            <span className={`live-badge ${isLive ? 'live-on' : 'live-off'}`}>
              {isLive ? <><Wifi size={11} /> Live</> : <><WifiOff size={11} /> Offline</>}
            </span>
          </div>
        </div>
      </div>

      <div className="edit-layout">
        {/* Screen preview card */}
        <div className="preview-panel">
          <div className={`screen-preview ${orientation}`}>
            <Monitor size={48} opacity={.3} />
            <span>{screen?.name}</span>
            <span className="device-type-label">
              {['', 'Android', 'Fire TV', 'Web Player', 'Roku OS', '', '', '', '', '', '', 'Unknown'][screen?.deviceType] || 'Unknown'}
            </span>
          </div>
          <div className="preview-meta">
            {screen?.pairCode && (
              <div className="meta-row">
                <span className="meta-key">Pair Code</span>
                <code className="meta-val">{screen.pairCode}</code>
              </div>
            )}
            {screen?.entitlementType && (
              <div className="meta-row">
                <span className="meta-key">Entitlement</span>
                <span className="meta-val">{screen.entitlementType.replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Edit form */}
        <div className="form-card">
          <h3 className="form-section-title">Screen Settings</h3>

          <div className="form-group">
            <label className="field-label">
              <Monitor size={13} /> Screen Name <span className="required">*</span>
            </label>
            <input
              id="edit-screen-name"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Screen name"
            />
          </div>

          <div className="form-group">
            <label className="field-label">Orientation</label>
            <div className="orient-row">
              <button
                className={`orient-btn ${orientation === 'horizontal' ? 'orient-active' : ''}`}
                onClick={() => setOrientation('horizontal')}
                id="orient-horizontal"
              >
                <LayoutPanelTop size={17} /> Landscape
              </button>
              <button
                className={`orient-btn ${orientation === 'vertical' ? 'orient-active' : ''}`}
                onClick={() => setOrientation('vertical')}
                id="orient-vertical"
              >
                <LayoutPanelLeft size={17} /> Portrait
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="field-label"><MapPin size={13} /> Placed At</label>
            <input
              id="placed-at-input"
              className="form-input"
              value={placedAt}
              onChange={e => setPlacedAt(e.target.value)}
              placeholder="e.g. Main lobby, 2nd floor"
            />
          </div>

          <div className="form-group">
            <label className="field-label"><Tag size={13} /> Screen Tag</label>
            <CustomSelect
              id="tag-select"
              value={selectedTagId}
              onChange={e => setSelectedTagId(Number(e.target.value))}
              options={tags.map(t => ({ value: t.id, label: t.name }))}
              searchable={true}
            />
          </div>

          <div className="form-group">
            <label className="field-label"><Calendar size={13} /> Default Schedule</label>
            <CustomSelect
              id="schedule-select"
              value={selectedScheduleId}
              onChange={e => setSelectedScheduleId(Number(e.target.value))}
              options={schedules.map(s => ({ value: s.id, label: s.name }))}
              searchable={true}
            />
          </div>

          {/* Default Content Section */}
          <div className="form-group">
            <label className="field-label">Default Content</label>
            <div className={`content-btns ${defaultShowAssetType === 'NONE' ? 'none-active' : 'media-active'}`}>
              <div
                className={`radio-btn ${defaultShowAssetType === 'NONE' ? 'selected' : ''}`}
                onClick={() => {
                  setDefaultShowAssetType('NONE');
                  setDefaultShowAssetId('');
                  setDefaultShowAssetName('');
                }}
                id="content-none"
              >
                None
              </div>
              <div
                className={`radio-btn ${defaultShowAssetType !== 'NONE' ? 'selected' : ''}`}
                onClick={() => setShowContentSelect(true)}
                id="content-media"
              >
                Media/Playlist
              </div>
            </div>

            {defaultShowAssetType !== 'NONE' && defaultShowAssetName && (
              <div className="selected-asset-display">
                <div className="selected-asset-info">
                  <span className="selected-asset-label">
                    Selected {defaultShowAssetType === 'PLAYLIST' ? 'Playlist' : 'Media'}:
                  </span>
                  <span className="selected-asset-name">
                    {defaultShowAssetName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContentSelect(true)}
                  className="change-asset-btn"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <button
            id="save-screen-btn"
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><RefreshCw size={15} className="spin" /> Saving…</> : <><Save size={15} /> Save Changes</>}
          </button>
        </div>
      </div>

      <ContentSelectPopup
        isOpen={showContentSelect}
        onClose={() => setShowContentSelect(false)}
        onSelect={(selected) => {
          if (selected) {
            setDefaultShowAssetType(selected.assetType);
            setDefaultShowAssetId(selected.asset.id);
            setDefaultShowAssetName(selected.asset.name);
          }
          setShowContentSelect(false);
        }}
        initialSelectedId={defaultShowAssetId}
      />

      <style>{`
        .edit-page { padding: 1.5rem 2rem; max-width: 1000px; }
        .edit-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 5rem; color: var(--text-muted); }

        .edit-header { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; }
        .back-btn { display: inline-flex; align-items: center; gap: .4rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: .5rem 1rem; font-size: .8rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all .15s; }
        .back-btn:hover { border-color: var(--accent); color: var(--accent); }
        .header-info { display: flex; align-items: center; gap: .75rem; }
        .header-icon { color: var(--accent); }
        .header-info h1 { font-size: 1.2rem; font-weight: 700; margin: 0 0 .25rem; }
        .live-badge { display: inline-flex; align-items: center; gap: .3rem; font-size: .7rem; font-weight: 700; padding: .2rem .55rem; border-radius: 999px; }
        .live-on { background: #dcfce7; color: #16a34a; }
        .live-off { background: var(--sidebar-bg); color: var(--text-muted); }

        .edit-layout { display: grid; grid-template-columns: 260px 1fr; gap: 1.5rem; align-items: start; }

        .preview-panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .screen-preview { width: 180px; height: 110px; border: 2px dashed var(--border); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; color: var(--text-muted); font-size: .75rem; font-weight: 600; text-align: center; background: var(--sidebar-bg); transition: all .2s; }
        .screen-preview.vertical { width: 110px; height: 180px; }
        .device-type-label { font-size: .65rem; opacity: .7; }
        .preview-meta { width: 100%; display: flex; flex-direction: column; gap: .5rem; }
        .meta-row { display: flex; justify-content: space-between; align-items: center; font-size: .78rem; }
        .meta-key { color: var(--text-muted); }
        .meta-val { font-weight: 600; }
        .meta-val code { font-family: monospace; background: var(--sidebar-bg); padding: .15rem .4rem; border-radius: 5px; font-size: .85rem; color: var(--accent); letter-spacing: .1em; }

        .form-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 1.75rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .form-section-title { font-size: 1rem; font-weight: 700; margin: 0 0 .5rem; }
        .form-group { display: flex; flex-direction: column; gap: .5rem; }
        .field-label { display: flex; align-items: center; gap: .4rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
        .required { color: #ef4444; }
        .form-input { background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; padding: .65rem 1rem; font-size: .9rem; color: var(--text); outline: none; transition: border-color .15s; }
        .form-input:focus { border-color: var(--accent); }
        .orient-row { display: flex; gap: .75rem; }
        .orient-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: .5rem; padding: .65rem; border-radius: 10px; border: 1.5px solid var(--border); background: var(--sidebar-bg); color: var(--text-muted); font-size: .875rem; font-weight: 600; cursor: pointer; transition: all .15s; }
        .orient-btn:hover { border-color: var(--accent); color: var(--accent); }
        .orient-active { border-color: var(--accent) !important; background: rgba(99,102,241,.08) !important; color: var(--accent) !important; }
        .select-wrap { position: relative; }
        .form-select { width: 100%; appearance: none; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; padding: .65rem 2.5rem .65rem 1rem; font-size: .875rem; color: var(--text); outline: none; cursor: pointer; }
        .form-select:focus { border-color: var(--accent); }
        .select-arrow { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .save-btn { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: .8rem; border-radius: 12px; border: none; background: var(--btn-cta-bg); color: var(--btn-cta-text); font-size: .95rem; font-weight: 700; cursor: pointer; margin-top: .25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.12); transition: all 0.2s ease; }
        .save-btn:hover:not(:disabled) { background: var(--btn-cta-hover); }
        .save-btn:disabled { opacity: .5; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 700px) { .edit-layout { grid-template-columns: 1fr; } }

        /* Content type buttons styling */
        .content-btns { display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .radio-btn {
          flex: 1; display: flex; align-items: center; justify-content: center;
          gap: .4rem; padding: .65rem .5rem; font-size: .85rem; font-weight: 600;
          cursor: pointer; color: var(--text-muted); transition: all .15s;
          border-right: 1px solid var(--border);
          background: var(--sidebar-bg);
        }
        .radio-btn:last-child { border-right: none; }
        .radio-btn.selected {
          background: var(--accent); color: white;
        }
        .radio-btn:not(.selected):hover { background: var(--sidebar-hover); }

        .selected-asset-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: rgba(99, 102, 241, 0.06);
          border: 1px dashed rgba(99, 102, 241, 0.3);
          border-radius: 10px;
          margin-top: 0.5rem;
        }
        .selected-asset-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .selected-asset-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .selected-asset-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--accent);
          max-width: 260px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .change-asset-btn {
          background: rgba(99, 102, 241, 0.12);
          color: var(--accent);
          border: none;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .change-asset-btn:hover {
          background: rgba(99, 102, 241, 0.2);
        }
      `}</style>
    </div>
  );
}
