'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Tag, Calendar, ArrowLeft, RefreshCw, Monitor, MapPin, ChevronDown, Check, Wifi, WifiOff
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { useSocketContext } from '@/context/SocketContext';
import { useLanguage } from '@/context/LanguageContext';
import CustomSelect from '@/components/shared/CustomSelect';

interface Screen {
  id: string;
  name: string;
  placedAt?: string;
  deviceType: number;
  status: 'LIVE' | 'READY_TO_USE' | 'OFFLINE';
}

interface ScreenGroup {
  id: number;
  name: string;
  scheduleId?: number;
}

interface Schedule {
  id: number;
  name: string;
}

const DEVICE_TYPE_MAP: Record<number, string> = {
  1: 'Android', 2: 'Fire TV', 3: 'Web Player', 4: 'Roku OS', 99: 'Unknown',
};

export default function ScreenTagDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { socket } = useSocketContext();
  const { t } = useLanguage();

  const [tag, setTag] = useState<ScreenGroup | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  // Load tag, screens, and schedules
  useEffect(() => {
    setLoading(true);
    Promise.all([
      cmsApi.get(`/sc/screen-group/${id}`),
      cmsApi.get(`/sc/screen-group/${id}/screens`),
      cmsApiV2.get('/scc/schedule', {
        params: { page: 0, size: 500, sortBy: 'updatedDate', sortOrder: 'DESC' }
      })
    ]).then(([tagRes, screensRes, schedulesRes]) => {
      const tagData = tagRes.data;
      setTag(tagData);
      
      const mappedScreens = (screensRes.data || []).map((s: any) => ({
        ...s,
        status: s.liveStatus === true ? 'LIVE' : 'READY_TO_USE'
      }));
      setScreens(mappedScreens);

      const allSchedules = [{ id: 0, name: 'None' }, ...(schedulesRes.data?.content || [])];
      setSchedules(allSchedules);

      // Find currently selected schedule
      const currentSchedule = allSchedules.find(s => s.id === tagData.scheduleId) || allSchedules[0];
      setSelectedSchedule(currentSchedule);
    }).catch((err) => {
      console.error(err);
      toast.error(t('SCREENS.toast_tag_rename_failed')); // generic error or just keep it simple
    }).finally(() => {
      setLoading(false);
    });
  }, [id]);

  // Real-time socket status updates
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data: { screenId: string; online: boolean }) => {
      setScreens(prev => prev.map(s =>
        String(s.id) === String(data.screenId)
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

  // Assign schedule to the group
  async function handleAssignSchedule(schedule: Schedule) {
    setSelectedSchedule(schedule);
    setAssigning(true);
    try {
      const { data } = await cmsApi.put(
        `/sc/screen-group/${id}/assign-schedule`,
        screens,
        { params: { scheduleId: schedule.id } }
      );
      if (data) {
        toast.success(t('SCREENS.toast_schedule_assigned'));
      } else {
        toast.error(t('SCREENS.toast_schedule_assign_failed'));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('SCREENS.toast_schedule_assign_failed'));
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="detail-loading">
        <RefreshCw size={24} className="spin" />
        <span>{t('SCREENS.tags_detail_loading')}</span>
      </div>
    );
  }

  return (
    <div className="tag-detail-page">
      {/* Header toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="back-btn" onClick={() => router.push('/screens/tags')} id="back-to-tags">
            <ArrowLeft size={16} />
          </button>
          <Tag size={20} className="header-icon" />
          <h1 className="page-title">{tag?.name || t('SCREENS.tag_details')}</h1>
        </div>
      </div>

      <div className="detail-layout">
        {/* Left pane: Details and Settings */}
        <div className="settings-panel">
          <h3 className="section-title">{t('SCREENS.schedule_settings')}</h3>
          <p className="section-desc">{t('SCREENS.schedule_settings_desc')}</p>
          
          <div className="form-group">
            <label className="field-label">{t('SCREENS.active_schedule')}</label>
            <div className="select-wrap">
              <CustomSelect
                id="schedule-assign-select"
                value={selectedSchedule?.id || 0}
                onChange={e => {
                  const sched = schedules.find(s => s.id === Number(e.target.value));
                  if (sched) handleAssignSchedule(sched);
                }}
                disabled={assigning}
                options={schedules.map(s => ({ value: s.id, label: s.name }))}
                searchable={true}
              />
            </div>
          </div>
        </div>

        {/* Right pane: Screen List */}
        <div className="screens-panel">
          <div className="screens-header">
            <h3 className="section-title">{t('SCREENS.tagged_screens')}</h3>
            <span className="count-pill">{screens.length}</span>
          </div>

          {screens.length === 0 ? (
            <div className="screens-empty">
              <Monitor size={36} opacity={0.15} />
              <h4>{t('SCREENS.no_screens_tag')}</h4>
              <p>{t('SCREENS.no_screens_tag_desc')}</p>
              <button className="btn-secondary" onClick={() => router.push('/screens')} id="empty-view-screens">
                {t('SCREENS.go_to_screens')}
              </button>
            </div>
          ) : (
            <div className="screens-grid">
              {screens.map(screen => (
                <div key={screen.id} className="screen-card" id={`screen-card-${screen.id}`}>
                  <div className="screen-card-top">
                    <div className="screen-icon-wrap">
                      <Monitor size={18} className="screen-icon" />
                    </div>
                    <div className="screen-status-badge">
                      {screen.status === 'LIVE' ? (
                        <span className="status-live"><Wifi size={10} /> {t('SCREENS.status_live')}</span>
                      ) : (
                        <span className="status-offline"><WifiOff size={10} /> {t('SCREENS.status_ready')}</span>
                      )}
                    </div>
                  </div>
                  <div className="screen-card-info">
                    <h4 className="screen-name">{screen.name}</h4>
                    {screen.placedAt && (
                      <div className="screen-meta">
                        <MapPin size={11} />
                        <span>{screen.placedAt}</span>
                      </div>
                    )}
                    <span className="screen-device-badge">
                      {DEVICE_TYPE_MAP[screen.deviceType] || 'Unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tag-detail-page { padding: 1.5rem 2rem; max-width: 1200px; }
        .detail-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 5rem; color: var(--text-muted); }

        .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
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

        .detail-layout { display: grid; grid-template-columns: 320px 1fr; gap: 2rem; align-items: start; }

        .settings-panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .section-title { font-size: 0.95rem; font-weight: 700; margin: 0; }
        .section-desc { font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; margin: 0 0 0.5rem; }

        .form-group { display: flex; flex-direction: column; gap: .5rem; }
        .field-label { display: flex; align-items: center; gap: .4rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
        .select-wrap { position: relative; }
        .form-select { width: 100%; appearance: none; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; padding: .65rem 2.5rem .65rem 1rem; font-size: .875rem; color: var(--text); outline: none; cursor: pointer; }
        .form-select:focus { border-color: var(--accent); }
        .form-select:disabled { opacity: 0.6; cursor: not-allowed; }
        .select-arrow { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }

        .screens-panel { display: flex; flex-direction: column; gap: 1.25rem; }
        .screens-header { display: flex; align-items: center; gap: 0.75rem; }
        .count-pill { background: var(--accent); color: white; font-size: .7rem; font-weight: 700; padding: .15rem .5rem; border-radius: 999px; }

        .screens-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 4rem 2rem; text-align: center; color: var(--text-muted); }
        .screens-empty h4 { font-size: 0.95rem; font-weight: 600; margin: 0; color: var(--text); }
        .screens-empty p { font-size: 0.8rem; margin: 0 0 0.5rem; max-width: 320px; line-height: 1.4; }

        .screens-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
        .screen-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; transition: border-color 0.15s; }
        .screen-card:hover { border-color: var(--accent); }
        .screen-card-top { display: flex; align-items: center; justify-content: space-between; }
        
        .screen-icon-wrap { width: 32px; height: 32px; border-radius: 8px; background: rgba(99, 102, 241, 0.06); display: flex; align-items: center; justify-content: center; color: var(--accent); }
        .screen-status-badge { font-size: 0.7rem; font-weight: 700; }
        .status-live { display: inline-flex; align-items: center; gap: 0.25rem; background: #dcfce7; color: #16a34a; padding: 0.2rem 0.5rem; border-radius: 999px; }
        .status-offline { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--sidebar-bg); color: var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 999px; }

        .screen-card-info { display: flex; flex-direction: column; gap: 0.35rem; }
        .screen-name { font-size: 0.875rem; font-weight: 700; margin: 0; color: var(--text); }
        .screen-meta { display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; color: var(--text-muted); }
        .screen-device-badge { font-size: 0.65rem; color: var(--text-muted); background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 5px; padding: 0.1rem 0.4rem; align-self: flex-start; margin-top: 0.15rem; }

        .btn-secondary { display: inline-flex; align-items: center; gap: .5rem; background: var(--btn-secondary-bg); color: var(--btn-secondary-text); border: 1px solid var(--border); padding: .5rem 1rem; border-radius: 8px; font-size: .8rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .btn-secondary:hover { background: var(--btn-secondary-hover); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .detail-layout { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
