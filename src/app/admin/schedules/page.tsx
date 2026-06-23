'use client';

import { useState, useEffect, useCallback } from 'react';

import { toast } from 'sonner';
import {
  CalendarRange, Plus, Pencil, Trash2, Eye, RefreshCw,
  Search, Filter, X, ChevronLeft, ChevronRight, SlidersHorizontal,
  Calendar, Clock, Monitor, LayoutList, CalendarDays, Tag,
  Copy, ChevronDown, Film, Layers, Play, Globe
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import CustomSelect from '@/components/shared/CustomSelect';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Schedule {
  id: string;
  name: string;
  updatedDate: string;
  screenNames?: string;
}

interface ScheduleItem {
  id: number;
  name: string;
  assetType: string;
  assetId: number;
  startDateTime: Date;
  endDateTime: Date;
}

// ─── Calendar Utils (ported from Angular CalendarUtils) ──────────────────────

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SLOT_HEIGHT = 60; // px per hour
const CAL_START_HOUR = 8;
const CAL_END_HOUR = 20;

const ASSET_COLORS: Record<string, string> = {
  PLAYLIST:    '#1F2937',
  VIDEO:       '#EC4899',
  IMAGE:       '#F59E0B',
  APP_YOUTUBE: '#10B981',
  APP:         '#10B981',
  WEB:         '#3B82F6',
  WIDGET:      '#374151',
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const isToday = date.toDateString() === today.toDateString();
    return { date, dayName: DAY_NAMES[i], dayNumber: date.getDate(), monthName: MONTH_NAMES[date.getMonth()], isToday };
  });
}

function getTimeSlots() {
  return Array.from({ length: CAL_END_HOUR - CAL_START_HOUR + 1 }, (_, i) => {
    const h = CAL_START_HOUR + i;
    return { hour: h, label: `${String(h).padStart(2,'0')}:00` };
  });
}

function itemTopPx(startTime: Date): number {
  const h = startTime.getHours();
  const m = startTime.getMinutes();
  return (h - CAL_START_HOUR + m / 60) * SLOT_HEIGHT;
}

function itemHeightPx(startTime: Date, endTime: Date): number {
  return Math.max(((endTime.getTime() - startTime.getTime()) / 3600000) * SLOT_HEIGHT, 20);
}

function distributeToDay(items: ScheduleItem[], dayDate: Date): { item: ScheduleItem; top: number; height: number }[] {
  const viewStart = new Date(dayDate); viewStart.setHours(CAL_START_HOUR, 0, 0, 0);
  const viewEnd   = new Date(dayDate); viewEnd.setHours(CAL_END_HOUR,   0, 0, 0);
  const result: { item: ScheduleItem; top: number; height: number }[] = [];
  for (const item of items) {
    const s = new Date(item.startDateTime);
    const e = new Date(item.endDateTime);
    if (s < viewEnd && e > viewStart) {
      const effStart = s < viewStart ? viewStart : s;
      const effEnd   = e > viewEnd   ? viewEnd   : e;
      if (effEnd > effStart) {
        result.push({ item, top: itemTopPx(effStart), height: itemHeightPx(effStart, effEnd) });
      }
    }
  }
  return result;
}


// ─── Content Select Popup (mirrors Angular SelectContentPopupComponent) ────────

function ContentSelectPopup({
  scheduleId,
  startDT,
  endDT,
  initialItem,
  onClose,
  onSaved,
}: {
  scheduleId: string;
  startDT: string;
  endDT: string;
  initialItem?: ScheduleItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<'RECENT' | 'ALL' | 'PLAYLIST' | 'IMAGE' | 'VIDEO'>('RECENT');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [startTime, setStartTime] = useState(startDT);
  const [endTime, setEndTime] = useState(endDT);
  const [saving, setSaving] = useState(false);

  // Load content/playlists with backend search
  useEffect(() => {
    const q = search.trim();
    cmsApi.get('/cc/content', {
      params: {
        page: 0,
        size: 50,
        sortBy: 'updatedDate',
        sortOrder: 'DESC',
        keyword: q || undefined
      }
    })
    .then(({ data }) => setAssets(data.content || []))
    .catch(() => {});

    if (q) {
      cmsApiV2.get('/pc/playlist/search', { params: { q } })
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : (data.content || []);
          setPlaylists(list);
        })
        .catch(() => {});
    } else {
      cmsApiV2.get('/pc/playlist', { params: { page: 0, size: 50, sortBy: 'updatedDate', sortOrder: 'DESC' } })
        .then(({ data }) => setPlaylists(data.content || []))
        .catch(() => {});
    }
  }, [search]);

  // Pre-select initial item for editing
  useEffect(() => {
    if (initialItem) {
      setSelected({
        id: initialItem.assetId,
        name: initialItem.name,
        _type: initialItem.assetType
      });
      if (initialItem.assetType === 'PLAYLIST') {
        setTab('PLAYLIST');
      } else if (initialItem.assetType === 'IMAGE') {
        setTab('IMAGE');
      } else if (initialItem.assetType === 'VIDEO') {
        setTab('VIDEO');
      } else {
        setTab('ALL');
      }
    }
  }, [initialItem]);

  const allItems: any[] = [
    ...playlists.map((p: any) => ({ ...p, _type: 'PLAYLIST' })),
    ...assets.map((a: any) => ({ ...a, _type: a.contentType || 'IMAGE' })),
  ];

  const filtered = allItems.filter(item => {
    const matchTab =
      tab === 'RECENT' ? true :
      tab === 'ALL' ? true :
      tab === 'PLAYLIST' ? item._type === 'PLAYLIST' :
      item._type === tab;
    const matchSearch = !search.trim() || (item.name || '').toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  }).slice(0, 50);

  const titleLabel = startTime && endTime
    ? `${new Date(startTime).toLocaleString()} → ${new Date(endTime).toLocaleString()}`
    : '';

  async function handleSave() {
    if (!selected || !startTime || !endTime) return;
    setSaving(true);
    try {
      const payload = {
        id: initialItem ? initialItem.id : 0,
        assetId: selected.id,
        assetType: selected._type,
        scheduleId: Number(scheduleId),
        startDateTime: startTime.length === 16 ? startTime + ':00' : startTime,
        endDateTime:   endTime.length   === 16 ? endTime   + ':00' : endTime,
      };
      await cmsApiV2.post('/scc/schedule-asset', payload);
      toast.success(initialItem ? 'Event updated!' : 'Event added to schedule!');
      onSaved();
      onClose();
    } catch {
      toast.error(initialItem ? 'Failed to update schedule event' : 'Failed to save schedule event');
    } finally {
      setSaving(false);
    }
  }

  const TABS = ['RECENT','ALL','PLAYLIST','IMAGE','VIDEO'] as const;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="content-popup" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cp-header">
          <div>
            <h3 className="cp-title">Select Assets / Playlists</h3>
            {titleLabel && <p className="cp-time">{titleLabel}</p>}
          </div>
          <div className="cp-header-btns">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              disabled={!selected || saving}
              onClick={handleSave}
              id="cp-save-btn"
            >
              {saving ? <RefreshCw size={13} className="spin" /> : <Plus size={13} />}
              Save
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="cp-tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`cp-tab ${tab === t ? 'cp-tab-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="cp-search-wrap">
          <Search size={13} className="cp-search-ic" />
          <input
            className="cp-search"
            placeholder="Search assets or playlists…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="cp-search-input"
          />
        </div>

        {/* Asset list */}
        <div className="cp-list">
          {filtered.length === 0 && (
            <p className="cp-empty">No items found</p>
          )}
          {filtered.map(item => (
            <div
              key={`${item._type}-${item.id}`}
              className={`cp-row ${selected?.id === item.id && selected?._type === item._type ? 'cp-row-selected' : ''}`}
              onClick={() => setSelected(item)}
              id={`cp-asset-${item.id}`}
            >
              <div className="cp-radio">
                <input
                  type="radio"
                  readOnly
                  checked={selected?.id === item.id && selected?._type === item._type}
                />
              </div>
              {item.thumbLink ? (
                <img src={item.thumbLink} alt={item.name} className="cp-thumb" />
              ) : (
                <div className="cp-thumb-placeholder">{item._type[0]}</div>
              )}
              <div className="cp-item-info">
                <span className="cp-item-name">{item.name}</span>
                <span
                  className="cp-item-badge"
                  style={{ background: ASSET_COLORS[item._type] || '#6B7280' }}
                >
                  {item._type}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Time inputs */}
        <div className="cp-time-row">
          <div className="cp-time-group">
            <label className="cp-time-lbl">START</label>
            <input
              type="datetime-local"
              className="cp-time-input"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              id="cp-start-time"
            />
          </div>
          <div className="cp-time-group">
            <label className="cp-time-lbl">END</label>
            <input
              type="datetime-local"
              className="cp-time-input"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              id="cp-end-time"
            />
          </div>
        </div>

        {/* Preview */}
        {selected && selected._type === 'IMAGE' && selected.permaLink && (
          <div className="cp-preview">
            <p className="cp-preview-lbl">Preview:</p>
            <img src={selected.permaLink || selected.thumbLink} alt="Preview" className="cp-preview-img" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Week Calendar Component (with drag-to-select) ────────────────────────────

function WeekCalendar({
  items,
  loading,
  scheduleId,
  hoveredItemId,
  onItemSaved,
}: {
  items: ScheduleItem[];
  loading: boolean;
  scheduleId: string;
  hoveredItemId?: number | null;
  onItemSaved: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDays  = getWeekDays(weekStart);
  const timeSlots = getTimeSlots();

  // ── 2D drag state: tracks start + end (day, slot) independently ──────────────
  const [dragStartDay,  setDragStartDay]  = useState<number | null>(null);
  const [dragStartSlot, setDragStartSlot] = useState<number | null>(null);
  const [dragEndDay,    setDragEndDay]    = useState<number | null>(null);
  const [dragEndSlot,   setDragEndSlot]   = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Popup
  const [popup, setPopup] = useState<{ startDT: string; endDT: string; initialItem?: ScheduleItem } | null>(null);

  const rangeLabel = `${weekDays[0].dayNumber} ${weekDays[0].monthName} — ${weekDays[6].dayNumber} ${weekDays[6].monthName} ${weekDays[6].date.getFullYear()}`;

  function toLocalDT(date: Date, hour: number): string {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  }

  function onMouseDown(dayIdx: number, slotIdx: number, e: React.MouseEvent) {
    e.preventDefault();
    setDragStartDay(dayIdx);
    setDragStartSlot(slotIdx);
    setDragEndDay(dayIdx);
    setDragEndSlot(slotIdx);
    setIsDragging(true);
  }

  // Drag enters ANY cell — update end coords freely (no column lock)
  function onMouseEnter(dayIdx: number, slotIdx: number) {
    if (!isDragging) return;
    setDragEndDay(dayIdx);
    setDragEndSlot(slotIdx);
  }

  function onMouseUp() {
    if (
      isDragging &&
      dragStartDay !== null && dragStartSlot !== null &&
      dragEndDay   !== null && dragEndSlot   !== null
    ) {
      const minDay  = Math.min(dragStartDay,  dragEndDay);
      const maxDay  = Math.max(dragStartDay,  dragEndDay);
      const minSlot = Math.min(dragStartSlot, dragEndSlot);
      const maxSlot = Math.max(dragStartSlot, dragEndSlot);

      const startHour = CAL_START_HOUR + minSlot;
      const endHour   = CAL_START_HOUR + maxSlot + 1;

      setPopup({
        startDT: toLocalDT(weekDays[minDay].date, startHour),
        endDT:   toLocalDT(weekDays[maxDay].date, endHour),
      });
    }
    setIsDragging(false);
    setDragStartDay(null); setDragStartSlot(null);
    setDragEndDay(null);   setDragEndSlot(null);
  }

  // A cell (dayIdx, slotIdx) is highlighted if it falls inside the selection rectangle
  function isSlotSelected(dayIdx: number, slotIdx: number): boolean {
    if (
      !isDragging ||
      dragStartDay === null || dragStartSlot === null ||
      dragEndDay   === null || dragEndSlot   === null
    ) return false;
    const minDay  = Math.min(dragStartDay,  dragEndDay);
    const maxDay  = Math.max(dragStartDay,  dragEndDay);
    const minSlot = Math.min(dragStartSlot, dragEndSlot);
    const maxSlot = Math.max(dragStartSlot, dragEndSlot);
    return dayIdx >= minDay && dayIdx <= maxDay && slotIdx >= minSlot && slotIdx <= maxSlot;
  }

  function onEditItem(item: ScheduleItem) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toInputDT = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    
    setPopup({
      startDT: toInputDT(item.startDateTime),
      endDT: toInputDT(item.endDateTime),
      initialItem: item
    });
  }

  async function onDeleteItem(item: ScheduleItem) {
    if (!window.confirm(`Are you sure you want to delete "${item.name}" from this schedule?`)) return;
    try {
      const { data } = await cmsApiV2.delete(`/scc/schedule-asset/${item.id}`);
      if (data && typeof data === 'object') {
        if (data.deleted) {
          toast.success('Event deleted');
          onItemSaved();
        } else {
          toast.error(data.message || 'Failed to delete event');
        }
      } else {
        toast.success('Event deleted');
        onItemSaved();
      }
    } catch {
      toast.error('Failed to delete event');
    }
  }

  return (
    <div className="cal-wrap" onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      {/* Week navigation */}
      <div className="cal-nav">
        <button className="nav-btn" onClick={() => setWeekStart(d => { const p = new Date(d); p.setDate(p.getDate()-7); return p; })} id="cal-prev">
          <ChevronLeft size={14} />
        </button>
        <span className="cal-range">{rangeLabel}</span>
        <button className="nav-btn" onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate()+7); return n; })} id="cal-next">
          <ChevronRight size={14} />
        </button>
        <button className="nav-btn-text" onClick={() => setWeekStart(getWeekStart(new Date()))} id="cal-today">Today</button>
        <span className="cal-hint">
          <span className="cal-hint-kbd">drag</span> on grid to add event
        </span>
      </div>

      {loading ? (
        <div className="cal-loading"><RefreshCw size={20} className="spin" /> Loading schedule items…</div>
      ) : (
        <div className="cal-grid-wrap">
          {/* Day headers */}
          <div className="cal-header-row">
            <div className="cal-time-gutter" />
            {weekDays.map((d, i) => (
              <div key={i} className={`cal-day-hd ${d.isToday ? 'cal-day-today' : ''}`}>
                <span className="cal-day-name">{d.dayName}</span>
                <span className={`cal-day-num ${d.isToday ? 'cal-day-num-today' : ''}`}>{d.dayNumber}</span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="cal-body">
            {/* Time gutter */}
            <div className="cal-time-col">
              {timeSlots.map(slot => (
                <div key={slot.hour} className="cal-slot-label">{slot.label}</div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((d, di) => {
              const dayItems = distributeToDay(items, d.date);
              return (
                <div
                  key={di}
                  className={`cal-day-col ${d.isToday ? 'cal-day-col-today' : ''}`}
                  style={{ userSelect: 'none' }}
                >
                  {/* Hour slot cells — draggable */}
                  {timeSlots.map((slot, si) => (
                    <div
                      key={slot.hour}
                      className={`cal-slot-cell ${isSlotSelected(di, si) ? 'cal-slot-selected' : ''}`}
                      style={{ top: si * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      onMouseDown={e => onMouseDown(di, si, e)}
                      onMouseEnter={() => onMouseEnter(di, si)}
                    />
                  ))}

                  {/* Hour lines */}
                  {timeSlots.map(slot => (
                    <div key={slot.hour} className="cal-hour-line" style={{ top: (slot.hour - CAL_START_HOUR) * SLOT_HEIGHT }} />
                  ))}

                  {/* Schedule items */}
                  {dayItems.map(({ item, top, height }) => {
                    const isHovered = hoveredItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`cal-item${isHovered ? ' cal-item-hovered' : ''}`}
                        style={{
                          top,
                          height: Math.max(height, 22),
                          background: `linear-gradient(135deg, ${ASSET_COLORS[item.assetType] || '#6B7280'}, ${ASSET_COLORS[item.assetType] || '#6B7280'}cc)`,
                        }}
                        title={`${item.name} (${item.assetType})`}
                      >
                        <div className="cal-item-content">
                          <span className="cal-item-name">{item.name}</span>
                          {height > 30 && <span className="cal-item-type">{item.assetType}</span>}
                        </div>
                        <div className="cal-item-actions">
                          <button
                            className="cal-item-btn"
                            onClick={(e) => { e.stopPropagation(); onEditItem(item); }}
                            title="Edit"
                          >
                            <Pencil size={10} />
                          </button>
                          <button
                            className="cal-item-btn"
                            onClick={(e) => { e.stopPropagation(); onDeleteItem(item); }}
                            title="Delete"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content selection popup */}
      {popup && (
        <ContentSelectPopup
          scheduleId={scheduleId}
          startDT={popup.startDT}
          endDT={popup.endDT}
          initialItem={popup.initialItem}
          onClose={() => setPopup(null)}
          onSaved={onItemSaved}
        />
      )}
    </div>
  );
}


// ─── Create / Rename modal ────────────────────────────────────────────────────

function ScheduleNameModal({
  initial, title, onClose, onSaved
}: { initial?: Schedule; title: string; onClose: () => void; onSaved: (newId?: string) => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await cmsApiV2.put('/scc/schedule-name', { id: initial.id, name: name.trim() });
        toast.success('Schedule renamed');
        onSaved();
      } else {
        const { data } = await cmsApiV2.post('/scc/schedule-name', { name: name.trim() });
        toast.success('Schedule created');
        onSaved(data?.id ? String(data.id) : undefined);
      }
      onClose();
    } catch {
      toast.error(`Failed to ${initial ? 'rename' : 'create'} schedule`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <h3>{title}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-bd">
          <label className="field-label">Schedule Name</label>
          <input
            autoFocus
            className="field-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="e.g. Morning Lobby Content"
            id="schedule-name-input"
          />
        </div>
        <div className="modal-ft">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !name.trim()} id="save-schedule-btn">
            {saving ? <RefreshCw size={13} className="spin" /> : null}
            {initial ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Usage Modal ──────────────────────────────────────────────────────────────

function UsageModal({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cmsApiV2.get(`/scc/schedule/${schedule.id}/asset-in-use`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Failed to load usage'))
      .finally(() => setLoading(false));
  }, [schedule.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="usage-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <h3>Schedule Usage</h3>
            <p className="modal-sub">{schedule.name}</p>
          </div>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-bd">
          {loading ? (
            <div className="usage-loading"><RefreshCw size={18} className="spin" /></div>
          ) : !data ? (
            <p className="usage-empty">No usage data available.</p>
          ) : (
            <div className="usage-content">
              {(Array.isArray(data.screens) && data.screens.length > 0) || (Array.isArray(data.tags) && data.tags.length > 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {Array.isArray(data.screens) && data.screens.length > 0 && (
                    <div>
                      <p className="usage-label">Assigned to {data.screens.length} screen(s):</p>
                      <div className="usage-screen-list">
                        {data.screens.map((s: any) => (
                          <div key={s.id} className="usage-screen-row">
                            <Monitor size={14} />
                            <span>{s.name || s.screenName || s.id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(data.tags) && data.tags.length > 0 && (
                    <div>
                      <p className="usage-label">Assigned to {data.tags.length} tag(s):</p>
                      <div className="usage-screen-list">
                        {data.tags.map((t: any) => (
                          <div key={t.id} className="usage-screen-row">
                            <Tag size={14} />
                            <span>{t.name || t.id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="usage-empty">This schedule is not assigned to any screens or tags yet.</p>
              )}
            </div>
          )}
        </div>
        <div className="modal-ft">
          <button className="btn-primary" onClick={onClose} id="close-usage-modal">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onClose, loading }: {
  name: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="small-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <h3>Delete Schedule</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-bd">
          <p className="confirm-text">Are you sure you want to delete "<strong>{name}</strong>"? This cannot be undone.</p>
        </div>
        <div className="modal-ft">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading} id="confirm-delete-sched">
            {loading && <RefreshCw size={13} className="spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const { t } = useLanguage();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterScreen, setFilterScreen] = useState('');
  const [filterPlaylist, setFilterPlaylist] = useState('');
  const [screens, setScreens] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 0, size: 10, total: 0 });
  const [actionLoading, setActionLoading] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calScheduleId, setCalScheduleId] = useState<string>('');
  const [calItems, setCalItems] = useState<ScheduleItem[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  // New States for Cal Sidebar, Usage & Hover
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [calScheduleName, setCalScheduleName] = useState('');
  const [calScreens, setCalScreens] = useState<any[]>([]);
  const [calTags, setCalTags] = useState<any[]>([]);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);


  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [renameModal, setRenameModal] = useState<Schedule | null>(null);
  const [usageModal, setUsageModal] = useState<Schedule | null>(null);
  const [deleteModal, setDeleteModal] = useState<Schedule | null>(null);

  // Load dropdowns
  useEffect(() => {
    cmsApi.get('/sc/screen', { params: { page: 0, size: 200, sortBy: 'updatedDate', sortOrder: 'DESC' } })
      .then(({ data }) => setScreens(data.content || [])).catch(() => {});
    cmsApiV2.get('/pc/playlist', { params: { page: 0, size: 200, sortBy: 'updatedDate', sortOrder: 'DESC' } })
      .then(({ data }) => setPlaylists(data.content || [])).catch(() => {});
  }, []);

  // Fetch schedules
  const fetchSchedules = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const { data } = await cmsApiV2.get('/scc/schedule', {
        params: {
          page,
          size: pagination.size,
          sortBy: 'updatedDate',
          sortOrder: 'DESC',
          fromDate: fromDate || '',
          toDate: toDate || '',
          selectedScreenId: filterScreen || '',
          selectedPlaylistId: filterPlaylist || '',
        }
      });
      const mapped = (data.content || []).map((s: any) => ({
        ...s,
        updatedDate: s.updatedDate ? new Date(s.updatedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
      }));
      setSchedules(mapped);
      setPagination(p => ({ ...p, page, total: data.totalElements || 0 }));
    } catch {
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [search, fromDate, toDate, filterScreen, filterPlaylist, pagination.size]);

  useEffect(() => { fetchSchedules(0); }, [search]);

  // Load calendar items when schedule selection changes
  const loadCalItems = useCallback(() => {
    if (!calScheduleId) {
      setCalItems([]);
      setCalScheduleName('');
      setCalScreens([]);
      setCalTags([]);
      return;
    }
    setCalLoading(true);
    
    // Fetch schedule details
    cmsApiV2.get(`/scc/schedule/${calScheduleId}`)
      .then(({ data }) => {
        setCalScheduleName(data.name || 'Unnamed Schedule');
        // Backend field is 'schedulAssets' (single 'e' — backend typo kept as-is)
        const raw = data.schedulAssets || data.scheduleAssets || data.items || data.scheduleItems || [];
        setCalItems(raw.map((a: any) => {
          // Mirror Angular's getAssetName() resolution order
          const name =
            a.playlist?.name ||
            a.content?.name ||
            a.app?.name ||
            a.web?.url ||
            a.widget?.name ||
            a.name ||
            a.assetName ||
            `Item ${a.id}`;
          return {
            id: a.id,
            name,
            assetType: a.assetType || 'PLAYLIST',
            assetId: a.assetId || 0,
            startDateTime: new Date(a.startDateTime),
            endDateTime:   new Date(a.endDateTime),
          };
        }));
      })
      .catch(() => toast.error('Failed to load schedule items'))
      .finally(() => setCalLoading(false));

    // Fetch schedule usage
    cmsApiV2.get(`/scc/schedule/${calScheduleId}/asset-in-use`)
      .then(({ data }) => {
        setCalScreens(data.screens || []);
        setCalTags(data.tags || []);
      })
      .catch(() => {
        setCalScreens([]);
        setCalTags([]);
      });
  }, [calScheduleId]);

  useEffect(() => {
    loadCalItems();
  }, [loadCalItems]);

  function applyFilters() { fetchSchedules(0); }
  function clearFilters() {
    setFromDate(''); setToDate(''); setFilterScreen(''); setFilterPlaylist('');
    setShowFilters(false);
    fetchSchedules(0);
  }

  async function handleDelete(sched: Schedule) {
    setActionLoading(true);
    try {
      const { data } = await cmsApiV2.delete('/scc/schedule/', { data: { ids: [sched.id] } });
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        if (result.deleted) {
          toast.success(result.message || 'Schedule deleted');
          setDeleteModal(null);
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(sched.id);
            return next;
          });
          fetchSchedules(pagination.page);
        } else {
          toast.error(result.message || 'Failed to delete schedule');
        }
      } else {
        toast.success('Schedule deleted');
        setDeleteModal(null);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(sched.id);
          return next;
        });
        fetchSchedules(pagination.page);
      }
    } catch {
      toast.error('Failed to delete schedule');
    } finally {
      setActionLoading(false);
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.size} selected schedules? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      const { data } = await cmsApiV2.delete('/scc/schedule/', { data: { ids: Array.from(selectedIds) } });
      let successCount = 0;
      const errorMessages: string[] = [];
      if (Array.isArray(data)) {
        data.forEach(res => {
          if (res.deleted) {
            successCount++;
          } else {
            errorMessages.push(res.message || 'Failed to delete schedule');
          }
        });
      } else {
        successCount = selectedIds.size;
      }

      if (errorMessages.length > 0) {
        toast.error(`Deleted ${successCount} schedules. Errors: ${errorMessages.join(', ')}`);
      } else {
        toast.success(`${successCount} schedules deleted`);
      }
      setSelectedIds(new Set());
      fetchSchedules(0);
    } catch {
      toast.error('Failed to delete selected schedules');
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

  function toggleSelectAll() {
    if (selectedIds.size === schedules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(schedules.map(s => s.id)));
    }
  }

  // Sidebar Helpers
  const getDisplayedItems = useCallback(() => {
    const now = new Date();
    const activeItems = calItems.filter(item => new Date(item.endDateTime) >= now);
    const pastItems = calItems.filter(item => new Date(item.endDateTime) < now);

    const sortedActive = [...activeItems].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    const sortedPast = [...pastItems].sort((a, b) => b.endDateTime.getTime() - a.endDateTime.getTime());

    const itemsToShow = sortedActive.length > 0 ? sortedActive : sortedPast;
    return itemsToShow.slice(0, 7);
  }, [calItems]);

  function formatItemTime(item: ScheduleItem): string {
    const start = new Date(item.startDateTime);
    const end = new Date(item.endDateTime);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const startDay = dayNames[start.getDay()];
    const startMonth = monthNames[start.getMonth()];
    const startDate = start.getDate();

    const formatTime = (date: Date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    return `${startDay}, ${startMonth} ${startDate} · ${formatTime(start)} – ${formatTime(end)}`;
  }

  function formatAssetType(assetType: string): string {
    const typeMap: Record<string, string> = {
      'PLAYLIST': 'Playlist',
      'VIDEO': 'Video',
      'IMAGE': 'Image',
      'APP_YOUTUBE': 'YouTube',
      'APP': 'App',
      'WEB': 'Web',
      'WIDGET': 'Widget'
    };
    return typeMap[assetType] || assetType;
  }

  const totalPages = Math.ceil(pagination.total / pagination.size);

  // Count active items in calendar
  const activeCalItems = calItems.filter(item => new Date(item.endDateTime) >= new Date()).length;

  return (
    <div className="schedules-page">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-icon-wrap">
            <CalendarRange size={18} />
          </div>
          <div>
            <h1 className="page-title">{t('MENUITEMS.SIDEBAR.scheduling')}</h1>
            <p className="page-sub">Manage when and where content plays on your screens</p>
          </div>
          <span className="count-pill">{pagination.total}</span>
        </div>
        <div className="toolbar-right">
          {/* View toggle */}
          <div className="view-toggle">
            <button
              className={`vt-btn ${viewMode === 'list' ? 'vt-active' : ''}`}
              onClick={() => setViewMode('list')}
              id="view-list-btn"
            >
              <LayoutList size={14} /> List
            </button>
            <button
              className={`vt-btn ${viewMode === 'calendar' ? 'vt-active' : ''}`}
              onClick={() => setViewMode('calendar')}
              id="view-cal-btn"
            >
              <CalendarDays size={14} /> Calendar
            </button>
          </div>

          {viewMode === 'list' && (
            <>
              <div className="search-wrap">
                <Search size={13} className="search-ic" />
                <input
                  id="schedules-search"
                  className="search-input"
                  placeholder="Search schedules…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                className={`btn-secondary${showFilters ? ' active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
                id="toggle-filters-btn"
              >
                <SlidersHorizontal size={14} /> Filters
              </button>
            </>
          )}

          {viewMode === 'calendar' && schedules.length > 0 && (
            <CustomSelect
              className="cal-sched-select"
              wrapperClassName="cal-sched-select-wrapper"
              value={calScheduleId}
              onChange={e => setCalScheduleId(e.target.value)}
              id="cal-schedule-select"
              placeholder="— Select a schedule —"
              options={schedules.map(s => ({ value: s.id, label: s.name }))}
            />
          )}

          <button
            className="btn-primary"
            onClick={() => setCreateModal(true)}
            id="create-schedule-btn"
          >
            <Plus size={14} /> New Schedule
          </button>
        </div>
      </div>

      {/* ── Filter panel ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">From Date</label>
              <div className="filter-input-wrap">
                <Calendar size={13} className="filter-icon" />
                <input
                  type="date"
                  className="filter-input"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  id="filter-from-date"
                />
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label">To Date</label>
              <div className="filter-input-wrap">
                <Calendar size={13} className="filter-icon" />
                <input
                  type="date"
                  className="filter-input"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  id="filter-to-date"
                />
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label">Screen</label>
              <CustomSelect
                className="filter-input"
                value={filterScreen}
                onChange={e => setFilterScreen(e.target.value)}
                id="filter-screen"
                placeholder="All Screens"
                options={screens.map(s => ({ value: s.id, label: s.name }))}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Playlist</label>
              <CustomSelect
                className="filter-input"
                value={filterPlaylist}
                onChange={e => setFilterPlaylist(e.target.value)}
                id="filter-playlist"
                placeholder="All Playlists"
                options={playlists.map(p => ({ value: p.id, label: p.name }))}
              />
            </div>
          </div>
          <div className="filter-actions">
            <button className="btn-ghost btn-sm" onClick={clearFilters} id="clear-filters-btn">
              <X size={13} /> Clear
            </button>
            <button className="btn-primary btn-sm" onClick={applyFilters} id="apply-filters-btn">
              <Filter size={13} /> Apply
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk bar ─────────────────────────────────────────────────────── */}
      {viewMode === 'list' && selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-info">{selectedIds.size} selected</span>
          <button className="bulk-btn" onClick={() => setSelectedIds(new Set())}><X size={13} /> Deselect</button>
          <button className="bulk-btn bulk-danger" onClick={bulkDelete} id="bulk-delete-schedules">
            <Trash2 size={13} /> Delete selected
          </button>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="page-loading">
          <RefreshCw size={28} className="spin" />
          <span>Loading schedules…</span>
        </div>
      ) : schedules.length === 0 ? (
        <div className="page-empty">
          <div className="empty-illo">
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="20" width="80" height="64" rx="10" fill="currentColor" opacity="0.06"/>
              <rect x="8" y="20" width="80" height="64" rx="10" stroke="currentColor" strokeWidth="2" opacity="0.15"/>
              <rect x="20" y="8" width="56" height="6" rx="3" fill="currentColor" opacity="0.1"/>
              <line x1="8" y1="36" x2="88" y2="36" stroke="currentColor" strokeWidth="1.5" opacity="0.12"/>
              <rect x="22" y="44" width="16" height="10" rx="3" fill="currentColor" opacity="0.18"/>
              <rect x="44" y="44" width="16" height="10" rx="3" fill="currentColor" opacity="0.1"/>
              <rect x="66" y="44" width="10" height="10" rx="3" fill="currentColor" opacity="0.1"/>
              <rect x="22" y="60" width="10" height="10" rx="3" fill="currentColor" opacity="0.1"/>
              <rect x="38" y="60" width="22" height="10" rx="3" fill="currentColor" opacity="0.18"/>
            </svg>
          </div>
          <h3>No schedules yet</h3>
          <p>Create your first schedule to control when and where content plays on your screens</p>
          <button className="btn-primary" onClick={() => setCreateModal(true)} id="empty-create-schedule">
            <Plus size={14} /> Create First Schedule
          </button>
        </div>
      ) : viewMode === 'calendar' ? (
        <>
          {!calScheduleId ? (
            <div className="page-empty">
              <div className="empty-illo">
                <svg width="88" height="88" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="16" width="76" height="60" rx="10" fill="currentColor" opacity="0.06"/>
                  <rect x="6" y="16" width="76" height="60" rx="10" stroke="currentColor" strokeWidth="2" opacity="0.12"/>
                  <line x1="6" y1="32" x2="82" y2="32" stroke="currentColor" strokeWidth="1.5" opacity="0.12"/>
                  <circle cx="44" cy="54" r="12" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.15"/>
                  <path d="M44 48v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                </svg>
              </div>
              <h3>Select a schedule to edit</h3>
              <p>Choose a schedule from the dropdown above to view and edit its events on the calendar</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                {schedules.slice(0, 3).map(s => (
                  <button
                    key={s.id}
                    className="btn-secondary btn-sm"
                    onClick={() => setCalScheduleId(s.id)}
                  >
                    <CalendarRange size={13} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="cal-outer">
              {/* ── Left Sidebar: Schedule Overview ─────────────────────── */}
              <div className="cal-sidebar-new">
                {/* Overview card header */}
                <div className="overview-header">
                  <button
                    className="cs-back-btn"
                    onClick={() => setCalScheduleId('')}
                    title="Back to schedules list"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <div className="overview-title-area">
                    <span className="overview-label">Schedule</span>
                    <div className="overview-name-row">
                      <h2 className="overview-name" title={calScheduleName}>{calScheduleName}</h2>
                      <button
                        className="cs-edit-btn"
                        onClick={() => {
                          const sched = schedules.find(s => s.id === calScheduleId);
                          if (sched) setRenameModal(sched);
                        }}
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                  <span className="overview-status-badge">Active</span>
                </div>

                {/* Stats row */}
                <div className="overview-stats">
                  <div className="stat-card">
                    <span className="stat-value">{calItems.length}</span>
                    <span className="stat-label">Events</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{calScreens.length}</span>
                    <span className="stat-label">Screens</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{calTags.length}</span>
                    <span className="stat-label">Tags</span>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="quick-actions-grid">
                  <button
                    className="qa-btn"
                    onClick={() => {
                      const sched = schedules.find(s => s.id === calScheduleId);
                      if (sched) setUsageModal(sched);
                    }}
                    id="qa-view-usage"
                  >
                    <Monitor size={14} />
                    <span>Screens &amp; Tags</span>
                  </button>
                  <button
                    className="qa-btn"
                    onClick={() => {
                      const sched = schedules.find(s => s.id === calScheduleId);
                      if (sched) setRenameModal(sched);
                    }}
                    id="qa-rename"
                  >
                    <Pencil size={14} />
                    <span>Rename</span>
                  </button>
                  <button
                    className="qa-btn"
                    onClick={() => {
                      const sched = schedules.find(s => s.id === calScheduleId);
                      if (sched) setUsageModal(sched);
                    }}
                    id="qa-usage"
                  >
                    <Eye size={14} />
                    <span>View Usage</span>
                  </button>
                  <button
                    className="qa-btn qa-btn-danger"
                    onClick={() => {
                      const sched = schedules.find(s => s.id === calScheduleId);
                      if (sched) setDeleteModal(sched);
                    }}
                    id="qa-delete"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="sidebar-divider" />

                {/* Assigned section */}
                {(calScreens.length > 0 || calTags.length > 0) && (
                  <>
                    <div className="sidebar-section">
                      <h3 className="sidebar-section-title">Assigned To</h3>
                      <div className="cs-assignments">
                        {calTags.map(tag => (
                          <div key={tag.id} className="cs-assigned-item tag-badge" title={`Tag: ${tag.name}`}>
                            <Tag size={11} />
                            <span>{tag.name}</span>
                          </div>
                        ))}
                        {calScreens.map(screen => (
                          <div key={screen.id} className="cs-assigned-item screen-badge" title={`Screen: ${screen.name || screen.screenName}`}>
                            <Monitor size={11} />
                            <span>{screen.name || screen.screenName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="sidebar-divider" />
                  </>
                )}

                {/* Schedule items section */}
                <div className="sidebar-section" style={{ flex: 1, minHeight: 0 }}>
                  <div className="sidebar-section-hd">
                    <h3 className="sidebar-section-title">Schedule Events</h3>
                    <span className="items-count-pill">{calItems.length}</span>
                  </div>
                  <p className="sidebar-section-sub">Active &amp; upcoming items</p>

                  <div className="cs-items-list">
                    {calItems.length === 0 ? (
                      <div className="cs-empty-items">
                        <CalendarDays size={28} opacity={0.25} />
                        <p>Drag on the calendar to add your first event</p>
                      </div>
                    ) : (
                      getDisplayedItems().map(item => {
                        const isExpired = new Date(item.endDateTime) < new Date();
                        const isUpcoming = new Date(item.startDateTime) > new Date();
                        return (
                          <div
                            key={item.id}
                            className={`cs-item-card ${isExpired ? 'expired' : ''} ${hoveredItemId === item.id ? 'highlighted' : ''}`}
                            onMouseEnter={() => setHoveredItemId(item.id)}
                            onMouseLeave={() => setHoveredItemId(null)}
                          >
                            <div className="cs-item-color-bar" style={{ background: ASSET_COLORS[item.assetType] || '#6B7280' }} />
                            <div className="cs-item-body">
                              <div className="cs-item-header">
                                <span className="cs-item-name" title={item.name}>{item.name}</span>
                                <span
                                  className="cs-item-badge"
                                  style={{ background: ASSET_COLORS[item.assetType] || '#6B7280' }}
                                >
                                  {formatAssetType(item.assetType)}
                                </span>
                              </div>
                              <div className="cs-item-time">
                                <Clock size={10} />
                                {formatItemTime(item)}
                              </div>
                              <div className="cs-item-status-row">
                                {isExpired && <span className="status-pill expired">Expired</span>}
                                {isUpcoming && <span className="status-pill upcoming">Upcoming</span>}
                                {!isExpired && !isUpcoming && <span className="status-pill active">Active Now</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* ── Calendar Center ──────────────────────────────────────── */}
              <div className="cal-main-new">
                <WeekCalendar
                  items={calItems}
                  loading={calLoading}
                  scheduleId={calScheduleId}
                  hoveredItemId={hoveredItemId}
                  onItemSaved={loadCalItems}
                />
              </div>


            </div>
          )}
        </>
      ) : (
        /* ── List View ──────────────────────────────────────────────────── */
        <div className="table-card">
          <table className="schedules-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={schedules.length > 0 && selectedIds.size === schedules.length}
                    onChange={toggleSelectAll}
                    id="select-all-schedules"
                  />
                </th>
                <th>Name</th>
                <th>Screens</th>
                <th>Last Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(sched => (
                <tr key={sched.id} className={selectedIds.has(sched.id) ? 'row-selected' : ''} id={`sched-row-${sched.id}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(sched.id)}
                      onChange={() => toggleSelect(sched.id)}
                      id={`check-sched-${sched.id}`}
                    />
                  </td>
                  <td>
                    <div
                      className="sched-name-cell"
                      onClick={() => {
                        setViewMode('calendar');
                        setCalScheduleId(sched.id);
                      }}
                      title="Open in Calendar"
                      id={`open-sched-cal-${sched.id}`}
                    >
                      <div className="sched-icon"><CalendarRange size={14} /></div>
                      <span className="sched-name">{sched.name}</span>
                      <ChevronRight size={13} className="sched-arrow" />
                    </div>
                  </td>
                  <td className="cell-muted">
                    {sched.screenNames ? (
                      <span className="screen-badge-inline">
                        <Monitor size={11} /> {sched.screenNames}
                      </span>
                    ) : (
                      <span className="no-screen">—</span>
                    )}
                  </td>
                  <td className="cell-muted">
                    <div className="date-cell">
                      <Clock size={12} />
                      {sched.updatedDate}
                    </div>
                  </td>
                  <td>
                    <div className="action-row">
                      <button
                        className="action-btn action-primary"
                        onClick={() => {
                          setViewMode('calendar');
                          setCalScheduleId(sched.id);
                        }}
                        title="Edit Events"
                        id={`edit-cal-${sched.id}`}
                      ><Calendar size={13} /></button>
                      <button
                        className="action-btn"
                        onClick={() => setRenameModal(sched)}
                        title="Rename"
                        id={`rename-sched-${sched.id}`}
                      ><Pencil size={13} /></button>
                      <button
                        className="action-btn"
                        onClick={() => setUsageModal(sched)}
                        title="View usage"
                        id={`usage-sched-${sched.id}`}
                      ><Eye size={13} /></button>
                      <button
                        className="action-btn action-danger"
                        onClick={() => setDeleteModal(sched)}
                        title="Delete"
                        id={`delete-sched-${sched.id}`}
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
              <span className="pager-info">{pagination.total} schedules · Page {pagination.page + 1}/{totalPages}</span>
              <div className="pager-btns">
                <button className="pager-btn" disabled={pagination.page === 0}
                  onClick={() => fetchSchedules(pagination.page - 1)} id="sched-prev">
                  <ChevronLeft size={14} />
                </button>
                <button className="pager-btn" disabled={pagination.page >= totalPages - 1}
                  onClick={() => fetchSchedules(pagination.page + 1)} id="sched-next">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {createModal && (
        <ScheduleNameModal
          title="Create Schedule"
          onClose={() => setCreateModal(false)}
          onSaved={(newId) => {
            fetchSchedules(0);
            if (newId) {
              setViewMode('calendar');
              setCalScheduleId(newId);
            }
          }}
        />
      )}
      {renameModal && (
        <ScheduleNameModal
          title="Rename Schedule"
          initial={renameModal}
          onClose={() => setRenameModal(null)}
          onSaved={() => fetchSchedules(pagination.page)}
        />
      )}
      {usageModal && (
        <UsageModal schedule={usageModal} onClose={() => setUsageModal(null)} />
      )}
      {deleteModal && (
        <DeleteConfirm
          name={deleteModal.name}
          onConfirm={() => handleDelete(deleteModal)}
          onClose={() => setDeleteModal(null)}
          loading={actionLoading}
        />
      )}

      <style>{`
        /* ── Page shell ──────────────────────────────────────────────────── */
        .schedules-page {
          padding: 1.5rem 2rem;
          min-height: 100vh;
          background: var(--sidebar-bg, #f8fafc);
        }

        /* ── Toolbar ─────────────────────────────────────────────────────── */
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .toolbar-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: var(--btn-cta-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(31,41,55,0.25);
        }
        .page-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0 0 0.1rem;
          color: var(--text, #1f2937);
        }
        .page-sub {
          font-size: 0.75rem;
          color: var(--text-muted, #6b7280);
          margin: 0;
        }
        .count-pill {
          background: var(--btn-cta-bg);
          color: white;
          font-size: .7rem;
          font-weight: 700;
          padding: .25rem .65rem;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(31,41,55,0.2);
        }
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: .75rem;
          flex-wrap: wrap;
        }

        /* ── View Toggle ─────────────────────────────────────────────────── */
        .view-toggle {
          display: flex;
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .vt-btn {
          display: inline-flex;
          align-items: center;
          gap: .35rem;
          padding: .5rem 1rem;
          font-size: .8rem;
          font-weight: 600;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          transition: all .15s;
        }
        .vt-btn:hover { color: var(--text, #1f2937); }
        .vt-active {
          background: var(--accent) !important;
          color: white !important;
        }

        /* ── Search ──────────────────────────────────────────────────────── */
        .search-wrap { position: relative; }
        .search-ic {
          position: absolute;
          left: .7rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted, #9ca3af);
        }
        .search-input {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          padding: .55rem 1rem .55rem 2.2rem;
          font-size: .875rem;
          color: var(--text, #1f2937);
          outline: none;
          width: 220px;
          transition: border-color .15s;
        }
        .search-input:focus { border-color: var(--accent); }

        .cal-sched-select-wrapper {
          width: auto;
          min-width: 220px;
        }
        .cal-sched-select {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          padding: .55rem 1.1rem;
          font-size: .875rem;
          color: var(--text, #1f2937);
          outline: none;
          cursor: pointer;
          min-width: 220px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .cal-sched-select:focus { border-color: var(--accent); }

        /* ── Filter panel ────────────────────────────────────────────────── */
        .filter-panel {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.25rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        }
        .filter-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .filter-group { display: flex; flex-direction: column; gap: .3rem; }
        .filter-label {
          font-size: .7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: var(--text-muted, #6b7280);
        }
        .filter-input-wrap { position: relative; }
        .filter-icon {
          position: absolute;
          left: .7rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted, #9ca3af);
        }
        .filter-input {
          background: var(--sidebar-bg, #f8fafc);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          padding: .55rem 1rem .55rem 2.1rem;
          font-size: .85rem;
          color: var(--text, #1f2937);
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        select.filter-input { padding-left: 1rem; }
        .filter-input:focus { border-color: var(--accent); }
        .filter-actions { display: flex; justify-content: flex-end; gap: .75rem; }
        .btn-sm { padding: .42rem .9rem !important; font-size: .8rem !important; }

        /* ── Bulk bar ────────────────────────────────────────────────────── */
        .bulk-bar {
          display: flex;
          align-items: center;
          gap: .75rem;
          background: var(--btn-cta-bg);
          color: white;
          border-radius: 14px;
          padding: .7rem 1.25rem;
          margin-bottom: 1rem;
          font-size: .875rem;
          font-weight: 600;
          box-shadow: 0 6px 20px rgba(31,41,55,0.22);
        }
        .bulk-info { flex: 1; }
        .bulk-btn {
          display: inline-flex;
          align-items: center;
          gap: .35rem;
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.2);
          color: white;
          padding: .4rem .85rem;
          border-radius: 9px;
          font-size: .78rem;
          cursor: pointer;
          transition: background .15s;
          font-weight: 600;
        }
        .bulk-btn:hover { background: rgba(255,255,255,.25); }
        .bulk-danger { background: rgba(239,68,68,.3); border-color: rgba(239,68,68,.4); }
        .bulk-danger:hover { background: rgba(239,68,68,.45); }

        /* ── Empty / loading states ──────────────────────────────────────── */
        .page-loading, .page-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.1rem;
          padding: 5rem 2rem;
          color: var(--text-muted, #6b7280);
          text-align: center;
        }
        .empty-illo {
          color: var(--text-muted, #9ca3af);
          opacity: 0.7;
          margin-bottom: .25rem;
        }
        .page-empty h3 {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0;
          color: var(--text, #1f2937);
        }
        .page-empty p {
          margin: 0;
          font-size: .875rem;
          max-width: 380px;
          line-height: 1.5;
        }

        /* ── Calendar 3-col layout ───────────────────────────────────────── */
        .cal-outer {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          min-height: 0;
        }

        /* ── Left Sidebar ────────────────────────────────────────────────── */
        .cal-sidebar-new {
          width: 280px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15,23,42,0.06);
          max-height: calc(100vh - 180px);
          overflow-y: auto;
        }

        /* Overview header with gradient */
        .overview-header {
          background: var(--btn-cta-bg);
          padding: 1.25rem 1.1rem 1rem;
          display: flex;
          flex-direction: column;
          gap: .6rem;
          position: relative;
        }
        .overview-header .cs-back-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.12);
          cursor: pointer;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .15s;
          align-self: flex-start;
        }
        .overview-header .cs-back-btn:hover {
          background: rgba(255,255,255,0.22);
          border-color: rgba(255,255,255,0.4);
        }
        .overview-title-area { display: flex; flex-direction: column; gap: .2rem; }
        .overview-label {
          font-size: .65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .1em;
          color: rgba(255,255,255,0.65);
        }
        .overview-name-row {
          display: flex;
          align-items: center;
          gap: .5rem;
          min-width: 0;
        }
        .overview-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: white;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .overview-header .cs-edit-btn {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          cursor: pointer;
          color: rgba(255,255,255,0.8);
          padding: .25rem .35rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .overview-header .cs-edit-btn:hover {
          background: rgba(255,255,255,0.22);
          color: white;
        }
        .overview-status-badge {
          display: inline-flex;
          align-items: center;
          gap: .3rem;
          background: rgba(16,185,129,0.25);
          border: 1px solid rgba(16,185,129,0.4);
          color: #6ee7b7;
          font-size: .65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .07em;
          padding: .2rem .6rem;
          border-radius: 999px;
          align-self: flex-start;
        }
        .overview-status-badge::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10B981;
          display: inline-block;
        }

        /* Stats row */
        .overview-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: .9rem .5rem;
          border-right: 1px solid var(--border, #e5e7eb);
          gap: .15rem;
        }
        .stat-card:last-child { border-right: none; }
        .stat-value {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--text, #1f2937);
          line-height: 1;
        }
        .stat-label {
          font-size: .65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: var(--text-muted, #6b7280);
        }

        /* Quick actions */
        .quick-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: .5rem;
          padding: .75rem;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .qa-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: .35rem;
          padding: .6rem .5rem;
          border-radius: 10px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--sidebar-bg, #f8fafc);
          cursor: pointer;
          color: var(--text, #374151);
          font-size: .7rem;
          font-weight: 600;
          transition: all .15s;
          text-align: center;
        }
        .qa-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(31,41,55,0.04);
        }
        .qa-btn-danger:hover {
          border-color: #ef4444;
          color: #ef4444;
          background: rgba(239,68,68,0.04);
        }

        /* Sidebar internals */
        .sidebar-divider {
          height: 1px;
          background: var(--border, #e5e7eb);
        }
        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: .5rem;
          padding: .875rem .875rem;
        }
        .sidebar-section-hd {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sidebar-section-title {
          font-size: .68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .07em;
          color: var(--text-muted, #6b7280);
          margin: 0;
        }
        .sidebar-section-sub {
          font-size: .72rem;
          color: var(--text-muted, #9ca3af);
          margin: 0;
        }
        .items-count-pill {
          font-size: .65rem;
          font-weight: 700;
          background: var(--sidebar-bg, #f8fafc);
          border: 1px solid var(--border, #e5e7eb);
          padding: .1rem .5rem;
          border-radius: 999px;
          color: var(--text, #374151);
        }

        /* Assignments */
        .cs-assignments { display: flex; flex-wrap: wrap; gap: .4rem; }
        .cs-assigned-item {
          display: inline-flex;
          align-items: center;
          gap: .3rem;
          padding: .3rem .6rem;
          border-radius: 8px;
          font-size: .72rem;
          font-weight: 600;
          max-width: 100%;
        }
        .cs-assigned-item span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tag-badge { background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.2); color: #10B981; }
        .screen-badge { background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.2); color: #3B82F6; }

        /* Schedule items list */
        .cs-items-list {
          display: flex;
          flex-direction: column;
          gap: .5rem;
          max-height: 360px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .cs-empty-items {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: .6rem;
          padding: 1.75rem 1rem;
          color: var(--text-muted, #9ca3af);
          border: 1.5px dashed var(--border, #e5e7eb);
          border-radius: 12px;
        }
        .cs-empty-items p {
          font-size: .75rem;
          margin: 0;
          line-height: 1.4;
        }

        .cs-item-card {
          display: flex;
          gap: 0;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all .15s ease-in-out;
          background: var(--card-bg, #fff);
        }
        .cs-item-card:hover {
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(31,41,55,0.1);
          transform: translateY(-1px);
        }
        .cs-item-card.highlighted {
          border-color: var(--accent);
          box-shadow: 0 4px 14px rgba(31,41,55,0.12);
        }
        .cs-item-card.expired { opacity: 0.55; }

        .cs-item-color-bar {
          width: 4px;
          flex-shrink: 0;
        }
        .cs-item-body {
          flex: 1;
          padding: .6rem .7rem;
          display: flex;
          flex-direction: column;
          gap: .25rem;
          min-width: 0;
        }
        .cs-item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: .4rem;
        }
        .cs-item-name {
          font-size: .78rem;
          font-weight: 600;
          color: var(--text, #1f2937);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          flex: 1;
        }
        .cs-item-badge {
          font-size: .55rem;
          font-weight: 700;
          color: white;
          padding: .15rem .4rem;
          border-radius: 6px;
          flex-shrink: 0;
          text-transform: uppercase;
        }
        .cs-item-time {
          display: flex;
          align-items: center;
          gap: .3rem;
          font-size: .68rem;
          color: var(--text-muted, #6b7280);
        }
        .cs-item-status-row {
          display: flex;
          align-items: center;
          gap: .35rem;
        }
        .status-pill {
          font-size: .58rem;
          font-weight: 700;
          padding: .12rem .42rem;
          border-radius: 5px;
          text-transform: uppercase;
          letter-spacing: .03em;
        }
        .status-pill.active { background: rgba(16,185,129,.1); color: #059669; }
        .status-pill.upcoming { background: rgba(245,158,11,.1); color: #D97706; }
        .status-pill.expired { background: rgba(239,68,68,.1); color: #DC2626; }

        /* ── Calendar center ─────────────────────────────────────────────── */
        .cal-main-new { flex: 1; min-width: 0; }


        /* ── Calendar Grid ───────────────────────────────────────────────── */
        .cal-wrap {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15,23,42,0.06);
        }
        .cal-nav {
          display: flex;
          align-items: center;
          gap: .75rem;
          padding: .875rem 1.25rem;
          border-bottom: 1px solid var(--border, #e5e7eb);
          background: var(--card-bg, #fff);
        }
        .cal-range {
          font-size: .9rem;
          font-weight: 700;
          flex: 1;
          text-align: center;
          color: var(--text, #1f2937);
        }
        .nav-btn {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          border: 1px solid var(--border, #e5e7eb);
          background: transparent;
          cursor: pointer;
          color: var(--text, #374151);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .15s;
        }
        .nav-btn:hover { border-color: var(--accent); color: var(--accent); }
        .nav-btn-text {
          background: transparent;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 9px;
          padding: .3rem .8rem;
          font-size: .78rem;
          font-weight: 600;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          transition: all .15s;
        }
        .nav-btn-text:hover { border-color: var(--accent); color: var(--accent); }
        .cal-hint {
          font-size: .7rem;
          color: var(--text-muted, #9ca3af);
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: .35rem;
        }
        .cal-hint-kbd {
          background: var(--sidebar-bg, #f3f4f6);
          border: 1px solid var(--border, #d1d5db);
          border-radius: 5px;
          padding: .1rem .4rem;
          font-size: .65rem;
          font-weight: 700;
          color: var(--text, #374151);
          font-family: monospace;
        }
        .cal-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .75rem;
          padding: 4rem;
          color: var(--text-muted, #9ca3af);
        }
        .cal-grid-wrap { overflow-x: auto; }

        .cal-header-row {
          display: grid;
          grid-template-columns: 56px repeat(7, 1fr);
          border-bottom: 1px solid var(--border, #e5e7eb);
          background: var(--sidebar-bg, #f8fafc);
        }
        .cal-time-gutter { border-right: 1px solid var(--border, #e5e7eb); }
        .cal-day-hd {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: .7rem .4rem;
          border-right: 1px solid var(--border, #e5e7eb);
        }
        .cal-day-hd:last-child { border-right: none; }
        .cal-day-today { background: rgba(31,41,55,.05); }
        .cal-day-name {
          font-size: .62rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .09em;
          color: var(--text-muted, #6b7280);
        }
        .cal-day-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: .875rem;
          font-weight: 700;
          margin-top: .25rem;
          color: var(--text, #1f2937);
        }
        .cal-day-num-today {
          background: var(--btn-cta-bg);
          color: white !important;
          box-shadow: 0 2px 8px rgba(31,41,55,0.35);
        }

        .cal-body { display: grid; grid-template-columns: 56px repeat(7, 1fr); }
        .cal-time-col { border-right: 1px solid var(--border, #e5e7eb); }
        .cal-slot-label {
          height: 60px;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding: .3rem .55rem 0 0;
          font-size: .6rem;
          color: var(--text-muted, #9ca3af);
          border-bottom: 1px solid var(--border, #f3f4f6);
        }
        .cal-day-col {
          position: relative;
          border-right: 1px solid var(--border, #e5e7eb);
          min-height: 780px;
        }
        .cal-day-col:last-child { border-right: none; }
        .cal-day-col-today { background: rgba(31,41,55,.025); }
        .cal-hour-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border, #f3f4f6);
          pointer-events: none;
        }
        .cal-item {
          position: absolute;
          left: 3px;
          right: 3px;
          border-radius: 7px;
          padding: 4px 6px;
          overflow: hidden;
          cursor: pointer;
          opacity: .93;
          transition: opacity .15s, box-shadow .15s, transform .1s;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .cal-item:hover { opacity: 1; z-index: 10; box-shadow: 0 4px 14px rgba(0,0,0,0.22); }
        .cal-item-content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .cal-item-actions { display: none; align-items: center; gap: 3px; margin-left: 3px; flex-shrink: 0; }
        .cal-item:hover .cal-item-actions { display: flex; }
        .cal-item-btn {
          background: rgba(255,255,255,0.18);
          border: none;
          border-radius: 4px;
          color: white;
          padding: 2px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .1s;
        }
        .cal-item-btn:hover { background: rgba(255,255,255,0.32); }
        .cal-item-name {
          display: block;
          font-size: .68rem;
          font-weight: 700;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cal-item-type { display: block; font-size: .58rem; color: rgba(255,255,255,.72); }

        /* Calendar hover highlight sync */
        .cal-item { transition: opacity .15s, transform .15s, box-shadow .15s; }
        .cal-item-hovered {
          transform: scale(1.02);
          box-shadow: 0 6px 18px rgba(0,0,0,0.28);
          z-index: 100 !important;
          opacity: 1 !important;
          outline: 2px solid rgba(255,255,255,0.7);
          outline-offset: -1px;
        }

        .cal-slot-cell {
          position: absolute;
          left: 0;
          right: 0;
          cursor: crosshair;
          z-index: 1;
        }
        .cal-slot-cell:hover { background: rgba(31,41,55,.06); }
        .cal-slot-selected { background: rgba(31,41,55,.18) !important; }

        /* ── List Table ──────────────────────────────────────────────────── */
        .table-card {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15,23,42,0.06);
        }
        .schedules-table { width: 100%; border-collapse: collapse; }
        .schedules-table th {
          text-align: left;
          padding: .875rem 1.1rem;
          font-size: .68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: var(--text-muted, #6b7280);
          border-bottom: 1px solid var(--border, #e5e7eb);
          background: var(--sidebar-bg, #f8fafc);
        }
        .schedules-table td {
          padding: .875rem 1.1rem;
          font-size: .875rem;
          border-bottom: 1px solid var(--border, #f3f4f6);
          color: var(--text, #1f2937);
          vertical-align: middle;
        }
        .schedules-table tr:last-child td { border-bottom: none; }
        .schedules-table tr:hover td { background: var(--sidebar-bg, #f8fafc); }
        .row-selected td { background: rgba(31,41,55,0.03) !important; }
        .schedules-table input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: var(--accent);
          cursor: pointer;
        }
        .cell-muted { color: var(--text-muted, #6b7280); font-size: .825rem; }

        .sched-name-cell {
          display: flex;
          align-items: center;
          gap: .75rem;
          cursor: pointer;
        }
        .sched-name-cell:hover .sched-name { color: var(--accent); }
        .sched-name-cell:hover .sched-arrow { opacity: 1; transform: translateX(2px); }
        .sched-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: var(--btn-cta-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(31,41,55,0.2);
        }
        .sched-name { font-weight: 600; transition: color .15s; flex: 1; }
        .sched-arrow {
          color: var(--text-muted, #9ca3af);
          opacity: 0;
          transition: all .15s;
        }

        .screen-badge-inline {
          display: inline-flex;
          align-items: center;
          gap: .35rem;
          background: rgba(59,130,246,.06);
          border: 1px solid rgba(59,130,246,.15);
          color: #3B82F6;
          padding: .25rem .65rem;
          border-radius: 8px;
          font-size: .78rem;
          font-weight: 600;
        }
        .no-screen { color: var(--text-muted, #d1d5db); }

        .date-cell { display: flex; align-items: center; gap: .4rem; }

        .action-row { display: flex; gap: .25rem; }
        .action-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .15s;
        }
        .action-btn:hover { background: var(--sidebar-bg, #f3f4f6); border-color: var(--border, #e5e7eb); color: var(--text, #374151); }
        .action-primary:hover { background: rgba(31,41,55,.08); border-color: rgba(31,41,55,.2); color: var(--accent); }
        .action-danger:hover { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.2); color: #ef4444; }

        .table-pager {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: .875rem 1.1rem;
          border-top: 1px solid var(--border, #e5e7eb);
          background: var(--sidebar-bg, #f8fafc);
        }
        .pager-info { font-size: .8rem; color: var(--text-muted, #6b7280); }
        .pager-btns { display: flex; gap: .35rem; }
        .pager-btn {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--card-bg, #fff);
          cursor: pointer;
          color: var(--text, #374151);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .15s;
        }
        .pager-btn:disabled { opacity: .4; cursor: not-allowed; }
        .pager-btn:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }

        /* ── Modals ──────────────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(6px);
        }
        .small-modal {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 20px;
          width: 420px;
          max-width: 95vw;
          box-shadow: 0 24px 64px rgba(0,0,0,.35);
          animation: modal-in .2s ease;
        }
        .usage-modal {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 20px;
          width: 460px;
          max-width: 95vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 64px rgba(0,0,0,.35);
          animation: modal-in .2s ease;
        }
        @keyframes modal-in {
          from { opacity:0; transform: scale(.95) translateY(10px); }
          to { opacity:1; transform: scale(1) translateY(0); }
        }
        .modal-hd {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.1rem 1.5rem;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .modal-hd h3 { font-size: .95rem; font-weight: 700; margin: 0 0 .1rem; }
        .modal-sub { font-size: .8rem; color: var(--text-muted, #6b7280); margin: 0; }
        .modal-hd button { border: none; background: none; cursor: pointer; color: var(--text-muted, #6b7280); padding: .2rem; }
        .modal-bd { padding: 1.25rem 1.5rem; flex: 1; overflow-y: auto; }
        .modal-ft {
          padding: .875rem 1.5rem;
          border-top: 1px solid var(--border, #e5e7eb);
          display: flex;
          justify-content: flex-end;
          gap: .75rem;
        }

        .field-label {
          display: block;
          font-size: .72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: var(--text-muted, #6b7280);
          margin-bottom: .45rem;
        }
        .field-input {
          width: 100%;
          background: var(--sidebar-bg, #f8fafc);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          padding: .75rem 1rem;
          font-size: .9rem;
          color: var(--text, #1f2937);
          outline: none;
          box-sizing: border-box;
          transition: border-color .15s;
        }
        .field-input:focus { border-color: var(--accent); }
        .confirm-text { font-size: .875rem; color: var(--text-muted, #6b7280); margin: 0; line-height: 1.5; }

        .usage-loading, .usage-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem;
          color: var(--text-muted, #9ca3af);
        }
        .usage-label { font-size: .875rem; font-weight: 600; margin: 0 0 .75rem; color: var(--text, #1f2937); }
        .usage-screen-list { display: flex; flex-direction: column; gap: .5rem; }
        .usage-screen-row {
          display: flex;
          align-items: center;
          gap: .6rem;
          font-size: .875rem;
          padding: .55rem .875rem;
          background: var(--sidebar-bg, #f8fafc);
          border-radius: 10px;
          border: 1px solid var(--border, #e5e7eb);
        }

        /* Content popup */
        .content-popup {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 20px;
          width: 540px;
          max-width: 96vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 32px 80px rgba(0,0,0,.35);
          animation: modal-in .2s ease;
          overflow: hidden;
        }
        .cp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.1rem 1.25rem;
          border-bottom: 1px solid var(--border, #e5e7eb);
          background: var(--card-bg, #fff);
        }
        .cp-title { font-size: .95rem; font-weight: 700; margin: 0 0 .1rem; }
        .cp-time { font-size: .75rem; color: var(--text-muted, #6b7280); margin: 0; }
        .cp-header-btns { display: flex; gap: .5rem; align-items: center; }

        .cp-tabs { display: flex; border-bottom: 1px solid var(--border, #e5e7eb); padding: 0 1rem; }
        .cp-tab {
          border: none;
          background: transparent;
          padding: .65rem .9rem;
          font-size: .8rem;
          font-weight: 600;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          border-bottom: 2px solid transparent;
          transition: all .15s;
        }
        .cp-tab:hover { color: var(--text, #374151); }
        .cp-tab-active { color: var(--accent); border-bottom-color: var(--accent); }

        .cp-search-wrap { position: relative; padding: .75rem 1rem; border-bottom: 1px solid var(--border, #e5e7eb); }
        .cp-search-ic { position: absolute; left: 1.65rem; top: 50%; transform: translateY(-50%); color: var(--text-muted, #9ca3af); }
        .cp-search {
          width: 100%;
          background: var(--sidebar-bg, #f8fafc);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          padding: .5rem 1rem .5rem 2.1rem;
          font-size: .875rem;
          color: var(--text, #1f2937);
          outline: none;
          box-sizing: border-box;
        }
        .cp-search:focus { border-color: var(--accent); }

        .cp-list { flex: 1; overflow-y: auto; max-height: 280px; }
        .cp-empty { text-align: center; color: var(--text-muted, #9ca3af); font-size: .875rem; padding: 2.5rem; }
        .cp-row { display: flex; align-items: center; gap: .75rem; padding: .65rem 1rem; cursor: pointer; transition: background .1s; }
        .cp-row:hover { background: var(--sidebar-bg, #f8fafc); }
        .cp-row-selected { background: rgba(31,41,55,.07); }
        .cp-radio input { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }
        .cp-thumb { width: 44px; height: 44px; border-radius: 9px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border, #e5e7eb); }
        .cp-thumb-placeholder {
          width: 44px;
          height: 44px;
          border-radius: 9px;
          background: var(--btn-cta-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: .875rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .cp-item-info { display: flex; flex-direction: column; gap: .2rem; flex: 1; min-width: 0; }
        .cp-item-name { font-size: .875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cp-item-badge { font-size: .6rem; font-weight: 700; color: white; padding: .15rem .45rem; border-radius: 999px; align-self: flex-start; }

        .cp-time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: .875rem 1rem; border-top: 1px solid var(--border, #e5e7eb); }
        .cp-time-group { display: flex; flex-direction: column; gap: .3rem; }
        .cp-time-lbl { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted, #6b7280); }
        .cp-time-input {
          background: var(--sidebar-bg, #f8fafc);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 9px;
          padding: .55rem .85rem;
          font-size: .82rem;
          color: var(--text, #1f2937);
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        .cp-time-input:focus { border-color: var(--accent); }
        .cp-preview { padding: .75rem 1rem; border-top: 1px solid var(--border, #e5e7eb); }
        .cp-preview-lbl { font-size: .72rem; color: var(--text-muted, #6b7280); margin: 0 0 .4rem; }
        .cp-preview-img { max-height: 120px; border-radius: 9px; object-fit: cover; }

        /* ── Buttons ─────────────────────────────────────────────────────── */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: .5rem;
          background: var(--btn-cta-bg);
          color: white;
          border: none;
          padding: .6rem 1.25rem;
          border-radius: 12px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(31,41,55,0.22);
          transition: all 0.2s ease;
        }
        .btn-primary:hover { opacity: .9; transform: translateY(-1px); box-shadow: 0 5px 16px rgba(31,41,55,0.28); }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: .5rem;
          background: var(--card-bg, #fff);
          color: var(--text, #374151);
          border: 1px solid var(--border, #e5e7eb);
          padding: .6rem 1.25rem;
          border-radius: 12px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
        .btn-secondary.active { border-color: var(--accent); color: var(--accent); background: rgba(31,41,55,0.04); }

        .btn-ghost {
          background: transparent;
          border: 1px solid var(--border, #e5e7eb);
          color: var(--text, #374151);
          padding: .6rem 1.25rem;
          border-radius: 12px;
          font-size: .875rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: .4rem;
          transition: all .15s;
        }
        .btn-ghost:hover { background: var(--sidebar-bg, #f8fafc); }

        .btn-danger {
          display: inline-flex;
          align-items: center;
          gap: .4rem;
          background: #ef4444;
          color: white;
          border: none;
          padding: .6rem 1.25rem;
          border-radius: 12px;
          font-size: .875rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(239,68,68,0.2);
          transition: all 0.2s ease;
        }
        .btn-danger:hover { background: #dc2626; transform: translateY(-1px); }
        .btn-danger:disabled { opacity: .5; cursor: not-allowed; transform: none; }

        /* ── Utility ─────────────────────────────────────────────────────── */
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Scrollbar styling */
        .cs-items-list::-webkit-scrollbar,
        .cal-sidebar-new::-webkit-scrollbar { width: 4px; }
        .cs-items-list::-webkit-scrollbar-track,
        .cal-sidebar-new::-webkit-scrollbar-track { background: transparent; }
        .cs-items-list::-webkit-scrollbar-thumb,
        .cal-sidebar-new::-webkit-scrollbar-thumb {
          background: var(--border, #e5e7eb);
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}
