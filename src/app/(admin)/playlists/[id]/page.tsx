'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Eye, Settings2, Play, Pause, Pencil,
  Check, X, Plus, Minus, Trash2, Upload, Search,
  GripVertical, Clock, Image as ImageIcon,
  Globe, Megaphone, FileSpreadsheet,
  BarChart3, BookImage, Cloud, LayoutGrid, Calendar, Monitor, Smartphone, Tv
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { TransitionPopup } from '@/components/shared/TransitionPopup';
import { PlaylistItem, TransitionSettings, ContentAsset } from '@/types/playlist';
import { WeatherAppModal } from '@/components/playlist-apps/WeatherAppModal';
import { AnnouncementAppModal } from '@/components/playlist-apps/AnnouncementAppModal';
import { YoutubeAppModal } from '@/components/playlist-apps/YoutubeAppModal';
import { ZonesEditorModal } from '@/components/playlist-apps/ZonesEditorModal';
import { InstagramAppModal } from '@/components/playlist-apps/InstagramAppModal';
import { GoogleSheetAppModal } from '@/components/playlist-apps/GoogleSheetAppModal';
import { CanvaPublicAppModal } from '@/components/playlist-apps/CanvaPublicAppModal';
import {
  GoogleSlideAppModal, MicrosoftExcelAppModal, MicrosoftPowerBiAppModal,
  OutlookCalendarAppModal, PosterMyWallAppModal, WebsiteAppModal, GoogleCalendarAppModal
} from '@/components/playlist-apps/GenericIframeAppModals';

// Custom Instagram Icon to bypass missing member in old lucide-react version
const Instagram = ({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);



// ─── Helpers ──────────────────────────────────────────────────────────────────

function secsToHHMMSS(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return [h, m, ss].map(n => n.toString().padStart(2, '0')).join(':');
  return [m, ss].map(n => n.toString().padStart(2, '0')).join(':');
}

function totalDurSecs(items: PlaylistItem[]): number {
  return items.reduce((acc, i) => acc + (Number(i.duration) || 0), 0);
}

function getThumbnail(item: { thumbLink?: string; contentType?: string }): string {
  return item.thumbLink || '';
}

function DurationInput({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  const [local, setLocal] = useState(secsToHHMMSS(value));

  useEffect(() => {
    setLocal(secsToHHMMSS(value));
  }, [value]);

  function handleBlur() {
    const parts = local.split(':').reverse();
    let secs = 0;
    if (parts[0]) secs += parseInt(parts[0], 10) || 0;
    if (parts[1]) secs += (parseInt(parts[1], 10) || 0) * 60;
    if (parts[2]) secs += (parseInt(parts[2], 10) || 0) * 3600;
    secs = Math.max(1, secs); // minimum 1 second
    setLocal(secsToHHMMSS(secs));
    onChange(secs);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <input
      className="ple-dur-input"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      title="Duration (HH:MM:SS)"
      style={{ width: '60px', textAlign: 'center' }}
    />
  );
}

// ─── App item definitions (right sidebar) ────────────────────────────────────

const APP_ITEMS = [
  { label: 'YouTube',            sub: 'Media',           contentType: 'APP_YOUTUBE',            icon: <Play size={22} color="#FF0000" fill="#FF0000" /> },
  { label: 'Announcement',       sub: 'Text',            contentType: 'APP_ANNOUNCEMENT',        icon: <Megaphone size={22} color="#E1306C" /> },
  { label: 'Website',            sub: 'Media',           contentType: 'APP_HTML',                icon: <Globe size={22} color="#E44D26" /> },
  { label: 'Weather',            sub: 'Live Data',       contentType: 'APP_WEATHER',             icon: <Cloud size={22} color="#4FC3F7" /> },
  { label: 'Instagram',          sub: 'Social',          contentType: 'APP_INSTAGRAM',           icon: <Instagram size={22} color="#E1306C" /> },
  { label: 'Google Calendar',    sub: 'Calendar',        contentType: 'APP_GOOGLE_CALENDAR',     icon: <Calendar size={22} color="#4285F4" /> },
  { label: 'Canva Public',       sub: 'Design',          contentType: 'APP_CANVA_PUBLIC',        icon: <BookImage size={22} color="#00C4CC" /> },
  { label: 'Google Sheet',       sub: 'Spreadsheet',     contentType: 'APP_GOOGLE_SHEET',        icon: <FileSpreadsheet size={22} color="#34A853" /> },
  { label: 'Google Slide',       sub: 'Presentation',    contentType: 'APP_GOOGLE_SLIDE',        icon: <FileSpreadsheet size={22} color="#FBBC04" /> },
  { label: 'Outlook Calendar',   sub: 'Calendar',        contentType: 'APP_OUTLOOK_CALENDAR',    icon: <BookImage size={22} color="#0078D4" /> },
  { label: 'Microsoft Excel',    sub: 'Spreadsheet',     contentType: 'APP_MICROSOFT_EXCEL',     icon: <FileSpreadsheet size={22} color="#217346" /> },
  { label: 'Power BI',           sub: 'Analytics',       contentType: 'APP_MICROSOFT_POWERBI',   icon: <BarChart3 size={22} color="#F2C811" /> },
  { label: 'PosterMyWall',       sub: 'Design',          contentType: 'APP_POSTER_MY_WALL',      icon: <BookImage size={22} color="#E85D04" /> },
];



// ─── Preview Modal ────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const match = url?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

function PreviewModal({ items, initialIndex = 0, name, transition, onClose }: { items: PlaylistItem[]; initialIndex?: number; name: string; transition: TransitionSettings; onClose: () => void }) {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [idx, setIdx] = useState(initialIndex);
  const [animKey, setAnimKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cur = items[idx];

  const speedMs = transition.speed === 'FAST' ? 200 : transition.speed === 'SLOW' ? 800 : 400;

  const advanceTo = (next: number) => {
    setAnimKey(k => k + 1);
    setIdx(next);
    setProgress(0);
  };

  const goNext = () => advanceTo((idx + 1) % items.length);
  const goPrev = () => advanceTo((idx - 1 + items.length) % items.length);

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying || !cur) return;
    const durationMs = (Number(cur.duration) || 10) * 1000;
    const tickMs = 100;
    let elapsed = 0;

    timerRef.current && clearInterval(timerRef.current);
    progressRef.current && clearInterval(progressRef.current);
    setProgress(0);

    progressRef.current = setInterval(() => {
      elapsed += tickMs;
      setProgress(Math.min((elapsed / durationMs) * 100, 100));
    }, tickMs);

    timerRef.current = setTimeout(() => {
      advanceTo((idx + 1) % items.length);
    }, durationMs);

    return () => {
      timerRef.current && clearTimeout(timerRef.current);
      progressRef.current && clearInterval(progressRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, isPlaying]);

  // Render the current content
  function renderContent() {
    if (!cur) return null;
    const ytId = extractYouTubeId(cur.permaLink || '');
    const isYT = cur.contentType === 'APP_YOUTUBE' || !!ytId;
    const isWeb = cur.contentType === 'APP_HTML' || cur.contentType === 'APP_CANVA_PUBLIC'
      || cur.contentType === 'APP_GOOGLE_SHEET' || cur.contentType === 'APP_GOOGLE_SLIDE'
      || cur.contentType === 'APP_OUTLOOK_CALENDAR' || cur.contentType === 'APP_MICROSOFT_EXCEL'
      || cur.contentType === 'APP_MICROSOFT_POWERBI';

    if (cur.contentType === 'APP_ANNOUNCEMENT') {
      const meta = cur.metadata || {};
      const align = meta.textAlign || 'center';
      const vAlign = meta.verticalAlign || 'middle';
      const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
      const alignItems = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center';
      
      let finalFontSize = 2.5;
      if (meta.fontSize) {
        const parsed = parseFloat(meta.fontSize);
        if (!isNaN(parsed)) {
          // If the font size is very large (e.g., old angular app used pixels like 50px), convert it to rem
          finalFontSize = parsed > 10 ? parsed / 16 : parsed;
        }
      }
      const fontSizeStr = `${finalFontSize}rem`;
      const fontFamily = meta.font || 'Inter';
      
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems, justifyContent: justify, backgroundColor: meta.backgroundColor || '#000', color: meta.fontColor || '#fff', fontSize: fontSizeStr, fontFamily, fontWeight: 600, padding: '40px', textAlign: align, overflow: 'hidden', wordBreak: 'break-word' }}>
          {meta.text || cur.name}
        </div>
      );
    }

    if (cur.contentType === 'APP_INSTAGRAM') {
      const meta = cur.metadata || {};
      const accountName = meta.accountName || cur.permaLink || 'Instagram';
      const bgColor = meta.backgroundColor || '#920a75';
      const color = meta.fontColor || '#ffffff';
      const font = meta.font || 'Poppins';
      const template = meta.template || 'Image with text on left';
      const showCaption = meta.showCaption !== false;

      return (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ 
            width: '100%', maxWidth: '400px', backgroundColor: bgColor, color: color, fontFamily: font, 
            borderRadius: '12px', overflow: 'hidden', display: 'flex',
            flexDirection: template === 'Image with text on left' ? 'row-reverse' : template === 'Image with text on right' ? 'row' : 'column'
          }}>
            {template !== 'Image only' && (
              <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{accountName}</span>
                </div>
                {showCaption && (
                  <p style={{ fontSize: '1rem', lineHeight: 1.5, opacity: 0.9 }}>
                    (Mocked Instagram Post Content from {accountName})
                  </p>
                )}
              </div>
            )}
            <div style={{ 
              flex: template === 'Image only' ? '1 1 100%' : '1 1 50%',
              aspectRatio: template === 'Image only' || template === 'Image with text overlay' ? '1 / 1' : '4 / 5',
              background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
            }}>
              <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Image Area</span>
              {template === 'Image with text overlay' && (
                 <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '20px', color: '#fff' }}>
                    <p style={{ fontSize: '0.9rem' }}>{showCaption ? `Overlay caption for ${accountName}` : ''}</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (isYT && ytId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&rel=0`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; encrypted-media"
          title={cur.name}
        />
      );
    }
    if (isWeb && cur.permaLink) {
      return (
        <iframe
          src={cur.permaLink}
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
          title={cur.name}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      );
    }
    if (cur.thumbLink || cur.permaLink) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={cur.thumbLink || cur.permaLink} alt={cur.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    }
    return (
      <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
        <Play size={40} />
        <p style={{ marginTop: 8, fontSize: '0.75rem' }}>{cur.name}</p>
      </div>
    );
  }

  const isLandscape = orientation === 'landscape';

  return (
    <div className="pl-overlay" onClick={onClose} style={{ padding: '20px', overflowY: 'auto', display: 'flex', alignItems: 'center' }}>
      <div 
        className="pl-modal" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '100%', 
          maxWidth: isLandscape ? 1024 : 450, 
          background: '#0a0a0a',
          transition: 'max-width 0.4s ease-in-out',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div className="pl-modal-hd" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <h3 style={{ color: '#fff' }}>{name}</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', margin: '2px 0 0' }}>
              {idx + 1} / {items.length} · {transition.type} · {transition.speed}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}>
              <button 
                onClick={() => setOrientation('landscape')} 
                style={{ background: isLandscape ? 'var(--accent)' : 'transparent', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
              >
                <Monitor size={14} /> Landscape
              </button>
              <button 
                onClick={() => setOrientation('portrait')} 
                style={{ background: !isLandscape ? 'var(--accent)' : 'transparent', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
              >
                <Smartphone size={14} /> Portrait
              </button>
            </div>
            <button className="pl-modal-x" onClick={onClose} style={{ color: '#fff' }}><X size={16} /></button>
          </div>
        </div>

        {/* Progress bar moved inside bezel */}

        {/* Content Stage (Bezel) */}
        <div style={{ 
          background: '#000', 
          width: '100%',
          aspectRatio: isLandscape ? '16/9' : '9/16',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          overflow: 'hidden', 
          position: 'relative',
          transition: 'aspect-ratio 0.4s ease-in-out',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)',
          borderBottom: '8px solid #111',
          borderTop: '8px solid #111',
          borderLeft: '8px solid #111',
          borderRight: '8px solid #111',
        }}>
          <div key={animKey} className={`pl-anim-${transition.type.toLowerCase()}`} style={{ animationDuration: `${speedMs}ms`, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderContent()}
          </div>
          
          {/* Loader Progress Bar moving from one slide to the next */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.15)', zIndex: 50 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.1s linear' }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <button onClick={goPrev} className="pl-chip" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}>← Prev</button>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem', margin: 0 }}>{cur?.name}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} />{secsToHHMMSS(cur?.duration || 0)}
              </span>
              <button
                onClick={() => setIsPlaying(p => !p)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
            {/* Thumbnail strip */}
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => advanceTo(i)}
                  style={{
                    width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                    background: i === idx ? 'var(--accent)' : 'rgba(255,255,255,0.25)',
                    border: 'none', cursor: 'pointer', padding: 0,
                    transition: 'width 0.2s ease, background 0.2s ease'
                  }}
                />
              ))}
            </div>
          </div>

          <button onClick={goNext} className="pl-chip" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}>Next →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Where Playing Modal ─────────────────────────────────────────────────────────

function WherePlayingModal({ playlistId, onClose }: { playlistId: string | number | null; onClose: () => void }) {
  const [screens, setScreens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playlistId || playlistId === 'new') {
      setLoading(false);
      return;
    }
    // Fetch screens mapped to this playlist
    cmsApi.get(`/screen`)
      .then(res => {
        const mapped = res.data?.content?.filter((s: any) => 
          s.playlistId === playlistId || s.defaultPlaylistId === playlistId || s.fallbackPlaylistId === playlistId
        ) || [];
        setScreens(mapped);
      })
      .catch(err => {
        console.error('Failed to fetch screens:', err);
        toast.error('Failed to load screens');
      })
      .finally(() => setLoading(false));
  }, [playlistId]);

  return (
    <div className="pl-overlay" onClick={onClose} style={{ padding: '20px', zIndex: 1100 }}>
      <div className="pl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
        <div className="pl-modal-hd" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h3 style={{ color: '#fff' }}>Currently Playing On</h3>
          <button className="pl-modal-x" onClick={onClose} style={{ color: '#fff' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px', minHeight: '150px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ margin: 'auto', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>
          ) : screens.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {screens.map(s => (
                <div key={s.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Tv size={20} color="var(--accent)" />
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{s.screenName || s.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{s.location || 'No Location'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ margin: 'auto', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              <Tv size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p style={{ margin: 0 }}>This playlist is not currently assigned to any screens.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Main Editor Page ─────────────────────────────────────────────────────────

export default function PlaylistEditorPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params?.id as string;
  const isNew = playlistId === 'create';

  // Playlist state
  const [playlistName, setPlaylistName] = useState('New Playlist');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('New Playlist');
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [transition, setTransition] = useState<TransitionSettings>({ type: 'NONE', speed: 'MEDIUM' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  // UI modals
  const [showTransition, setShowTransition] = useState(false);
  const [showPreview, setShowPreview] = useState<{ isOpen: boolean; initialIndex?: number }>({ isOpen: false });
  const [showWherePlaying, setShowWherePlaying] = useState(false);
  const [activeAppModal, setActiveAppModal] = useState<{
    contentType: string;
    editIndex?: number;
    initialData?: any;
    label?: string;
  } | null>(null);

  // Sidebar
  const [sideTab, setSideTab] = useState<'Images' | 'Videos' | 'Apps'>('Images');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop
  const dragIndexRef = useRef<number | null>(null);

  // ── Load existing playlist ──
  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    cmsApiV2.get(`/pc/playlist/${playlistId}?includeContents=true`)
      .then(({ data }) => {
        setPlaylistName(data.name || 'Playlist');
        setNameInput(data.name || 'Playlist');
        const apiToUiMap: Record<string, any> = {
          SLIDE_IN_RIGHT: 'SLIDE',
          SLIDE_IN_LEFT: 'SLIDE',
          FADE_IN: 'FADE',
          ZOOM_IN: 'ZOOM',
          ROTATE_IN: 'ROTATE',
          FLIP_IN: 'FLIP'
        };
        const mappedType = data.transitionType ? (apiToUiMap[data.transitionType] || 'NONE') : 'NONE';
        setTransition({ type: mappedType, speed: data.transitionSpeed || 'MEDIUM' });
        const contents: PlaylistItem[] = Array.isArray(data.contents)
          ? data.contents.map((c: any) => ({
            id: c.id,
            name: c.name,
            thumbLink: c.thumbLink,
            duration: c.duration || 10,
            contentType: c.contentType,
            permaLink: c.permaLink,
          }))
          : [];
        setItems(contents);
      })
      .catch(() => toast.error('Failed to load playlist'))
      .finally(() => setLoading(false));
  }, [isNew, playlistId]);

  // ── Load assets for sidebar ──
  const loadAssets = useCallback(async () => {
    if (sideTab === 'Apps') { setAssets([]); return; }
    setAssetsLoading(true);
    const enumMap: Record<string, string> = { Images: 'IMAGE', Videos: 'VIDEO' };
    try {
      const { data } = await cmsApi.get('/cc/content', {
        params: { contentType: enumMap[sideTab], page: 0, size: 50, keyword: search || undefined }
      });
      setAssets(Array.isArray(data) ? data : data?.content || []);
    } catch {
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [sideTab, search]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // ── Inline name editing ──
  function startEdit() { setNameInput(playlistName); setEditingName(true); }
  function confirmEdit() { const n = nameInput.trim() || 'New Playlist'; setPlaylistName(n); setEditingName(false); }

  // ── Add to playlist ──
  function addItem(asset: ContentAsset) {
    const item: PlaylistItem = {
      id: asset.id,
      name: asset.name,
      thumbLink: asset.thumbLink,
      permaLink: asset.permaLink,
      duration: asset.duration || 10,
      contentType: asset.contentType,
    };
    setItems(prev => [...prev, item]);
    toast.success(`"${asset.name}" added`);
  }

  function addAppItem(item: PlaylistItem) {
    setItems(prev => [...prev, { ...item, id: `app_${Date.now()}` }]);
    toast.success(`"${item.name}" added`);
  }

  // ── Duration control ──
  function changeDuration(idx: number, delta: number) {
    setItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, duration: Math.max(1, (Number(it.duration) || 1) + delta) } : it
    ));
  }

  function setDurationValue(idx: number, secs: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, duration: secs } : it));
  }

  // ── Remove item ──
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Drag reorder ──
  function onDragStart(e: React.DragEvent, idx: number) {
    dragIndexRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === idx) return;
    const from = dragIndexRef.current;
    dragIndexRef.current = idx;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
  }

  // ── Drag from sidebar to playlist ──
  function onAssetDragStart(e: React.DragEvent, asset: ContentAsset | any) {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function getSafeThumbnailUrl(item: PlaylistItem) {
    if (item.contentType === 'APP_YOUTUBE' && item.permaLink) {
      const id = extractYouTubeId(item.permaLink);
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }

    if (item.thumbLink && !item.thumbLink.includes('../assets')) {
      return item.thumbLink;
    }
    
    if (item.permaLink && !item.contentType?.startsWith('APP_')) return item.permaLink;

    return null;
  }

  function handleEditItemClick(item: PlaylistItem, idx: number) {
    const requiresInput = [
      'APP_YOUTUBE', 'APP_HTML', 'APP_CANVA_PUBLIC', 'APP_GOOGLE_SHEET',
      'APP_GOOGLE_SLIDE', 'APP_OUTLOOK_CALENDAR', 'APP_MICROSOFT_EXCEL',
      'APP_MICROSOFT_POWERBI', 'APP_WEATHER', 'APP_INSTAGRAM', 'APP_GOOGLE_CALENDAR',
      'APP_POSTER_MY_WALL'
    ].includes(item.contentType || '');

    if (item.contentType?.startsWith('APP_')) {
      const appDef = APP_ITEMS.find(a => a.contentType === item.contentType);
      setActiveAppModal({
        contentType: item.contentType,
        editIndex: idx,
        initialData: item.metadata || { permaLink: item.permaLink, url: item.permaLink, name: item.name },
        label: appDef?.label || 'App'
      });
    } else if (!item.contentType?.startsWith('APP_')) {
      setShowPreview({ isOpen: true, initialIndex: idx });
    }
  }

  function onPlaylistDrop(e: React.DragEvent) {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const asset = JSON.parse(data);
        if (asset && asset.isApp) {
          setActiveAppModal({ contentType: asset.contentType, label: asset.label });
        } else if (asset && asset.id) {
          addItem(asset);
        }
      } catch {}
    }
  }

  function onPlaylistDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  // ── Helper to transform Google Calendar URLs to embeddable format ──
  function transformCalendarUrl(url: string, title?: string): string {
    try {
      let calendarId = '';
      if (url.includes('src=')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        calendarId = urlParams.get('src') || '';
      } else if (url.includes('calendar/embed')) {
        const urlObj = new URL(url);
        calendarId = urlObj.searchParams.get('src') || '';
      } else if (url.includes('calendar/u/0/r')) {
        const urlParams = new URL(url).searchParams;
        calendarId = urlParams.get('cid') || '';
      } else {
        calendarId = url;
      }
      if (!calendarId) return url;

      const baseUrl = 'https://calendar.google.com/calendar/embed';
      const params = new URLSearchParams();
      params.set('src', calendarId);
      params.set('hl', 'en');
      params.set('wkst', '1');
      params.set('ctz', 'UTC');
      params.set('mode', 'AGENDA');
      params.set('bgcolor', '#ffffff');
      params.set('color', '#2952a3');
      params.set('showTitle', '1');
      params.set('showNav', '1');
      params.set('showDate', '1');
      params.set('showPrint', '0');
      params.set('showTabs', '0');
      params.set('showCalendars', '1');
      params.set('showTz', '1');
      if (title) {
        params.set('title', title);
      }
      return `${baseUrl}?${params.toString()}`;
    } catch {
      return url;
    }
  }

  // ── Save app content item & return real database ID ──
  async function saveAppContent(item: PlaylistItem): Promise<number> {
    const typeMap: Record<string, string> = {
      APP_YOUTUBE: 'youtube',
      APP_HTML: 'website',
      APP_ANNOUNCEMENT: 'announcement',
      APP_CANVA_PUBLIC: 'canva_public_view',
      APP_GOOGLE_SHEET: 'google_sheet',
      APP_GOOGLE_SLIDE: 'google_slide',
      APP_OUTLOOK_CALENDAR: 'outlook_calendar',
      APP_MICROSOFT_EXCEL: 'microsoft_excel',
      APP_MICROSOFT_POWERBI: 'microsoft_powerbi',
      APP_POSTER_MY_WALL: 'poster_my_wall',
      APP_WEATHER: 'weather',
      APP_INSTAGRAM: 'instagram',
      APP_GOOGLE_CALENDAR: 'google_calendar',
      APP_ZONES: 'zones',
    };
    const type = typeMap[item.contentType || ''];
    if (!type || (!item.permaLink && item.contentType !== 'APP_ZONES' && item.contentType !== 'APP_ANNOUNCEMENT')) return 0;
    
    // Default body
    const body: any = {
      id: 0,
      name: item.name,
      permaLink: item.permaLink || '',
      format: 'html', // default format
      assetSourceType: type,
      thumbLink: item.thumbLink || '',
      contentType: item.contentType,
      metadata: {}
    };

    if (item.contentType === 'APP_WEATHER') {
      body.metadata = {
        city: item.metadata?.city || item.permaLink,
        unit: 'C',
        layout: 'Temperature',
        forecastDays: 'Hourly',
        language: 'English',
        font: 'Inter',
        fontColor: '#ffffff',
        backgroundImage: '',
        ...(item.metadata || {}),
      };
      body.format = 'HTML';
      body.assetSourceType = '';
    } else if (item.contentType === 'APP_INSTAGRAM') {
      body.metadata = {
        accountName: item.permaLink,
        language: 'English (en)',
        duration: 10,
        showCaption: true,
        font: 'Poppins',
        fontColor: '#ffffff',
        backgroundColor: '#920a75',
        transitionSpeed: 'Medium',
        template: 'Image with text on left',
        ...(item.metadata || {})
      };
      body.format = 'html';
    } else if (item.contentType === 'APP_GOOGLE_CALENDAR') {
      const embedUrl = transformCalendarUrl(item.permaLink || '', item.name);
      body.permaLink = embedUrl;
      body.metadata = {
        calendarUrl: item.permaLink,
        embedUrl: embedUrl,
        eventsColor: '#2952a3',
        defaultView: 'AGENDA',
        visibleElements: ['Title', 'Date', 'Calendars', 'Timezone'],
        customTitle: item.name,
        language: 'en',
        weekStartDay: '1',
        timezone: 'UTC',
        refreshInterval: 5,
        ...(item.metadata || {})
      };
      body.format = 'html';
      body.assetSourceType = 'GOOGLE_CALENDAR';
    } else if (item.contentType === 'APP_ZONES') {
      body.metadata = {
        zones: [
          { id: 1, name: 'Zone 1', x: 0, y: 0, w: 100, h: 100 }
        ],
        ...(item.metadata || {})
      };
      body.format = 'html';
    } else if (item.contentType === 'APP_YOUTUBE') {
      body.format = 'youtube_video';
      body.assetSourceType = 'youtube';
      body.metadata = { isMuted: true, ...(item.metadata || {}) };
    } else if (item.contentType === 'APP_HTML') {
      body.format = 'WEBSITE';
      body.assetSourceType = 'website';
      body.metadata = {
        htmlContent: item.permaLink,
        url: item.permaLink,
        preRender: false
      };
    } else if (item.contentType === 'APP_CANVA_PUBLIC') {
      body.format = 'html';
      body.assetSourceType = 'HTML';
      body.metadata = {
        url: item.permaLink,
        embedUrl: item.permaLink,
        designId: 'Design',
        type: 'canva_public_view',
        ...(item.metadata || {})
      };
    } else if (item.contentType === 'APP_GOOGLE_SHEET') {
      body.format = 'html';
      body.assetSourceType = 'google_sheet';
      body.metadata = {
        url: item.permaLink,
        embedUrl: item.permaLink,
        sheetId: 'Sheet',
        type: 'google_sheet',
        ...(item.metadata || {})
      };
    } else if (item.contentType === 'APP_GOOGLE_SLIDE') {
      body.format = 'html';
      body.assetSourceType = 'google_slide';
      body.metadata = {
        url: item.permaLink,
        embedUrl: item.permaLink,
        slideId: 'Slide',
        type: 'google_slide',
        delay: 10,
        ...(item.metadata || {})
      };
    } else if (item.contentType === 'APP_OUTLOOK_CALENDAR') {
      body.format = 'html';
      body.assetSourceType = 'outlook_calendar';
      body.metadata = { url: item.permaLink, embedUrl: item.permaLink, ...(item.metadata || {}) };
    } else if (item.contentType === 'APP_MICROSOFT_EXCEL') {
      body.format = 'html';
      body.assetSourceType = 'microsoft_excel';
      body.metadata = { url: item.permaLink, embedUrl: item.permaLink, ...(item.metadata || {}) };
    } else if (item.contentType === 'APP_MICROSOFT_POWERBI') {
      body.format = 'html';
      body.assetSourceType = 'microsoft_powerbi';
      body.metadata = { url: item.permaLink, embedUrl: item.permaLink, ...(item.metadata || {}) };
    } else if (item.contentType === 'APP_ANNOUNCEMENT') {
      body.format = 'HTML';
      body.assetSourceType = '';
      body.metadata = { 
        text: item.permaLink || item.name,
        font: 'Inter',
        fontColor: '#ffffff',
        backgroundColor: '#000000',
        scrollingSpeed: 'Normal',
        direction: 'Left',
        ...(item.metadata || {})
      };
    }

    const { data } = await cmsApi.post(`/cc/content-save/${type}`, body);
    return data?.id ?? 0;
  }

  // ── Save ──
  async function save() {
    if (items.length === 0) { toast.warning('Add at least one item before saving'); return; }
    setSaving(true);
    try {
      // Resolve any unsaved app items (those with string IDs like 'app_...') to real DB IDs
      const resolvedItems = await Promise.all(
        items.map(async (it, i) => {
          let resolvedId: string | number = it.id;
          if (typeof it.id === 'string' && it.id.startsWith('app_')) {
            try {
              const newId = await saveAppContent(it);
              resolvedId = newId;
            } catch {
              toast.warning(`Could not save "${it.name}" — skipping it`);
              return null;
            }
          }
          return { id: resolvedId, duration: it.duration, orderIndex: i, contentType: it.contentType, permaLink: it.permaLink, thumbLink: it.thumbLink, name: it.name };
        })
      );
      const validContents = resolvedItems.filter(Boolean);

      const uiToApiMap: Record<string, string> = {
        SLIDE: 'SLIDE_IN_RIGHT',
        FADE: 'FADE_IN',
        ZOOM: 'ZOOM_IN',
        ROTATE: 'ROTATE_IN',
        FLIP: 'FLIP_IN'
      };
      const apiType = transition.type === 'NONE' ? null : (uiToApiMap[transition.type] || transition.type);

      const payload = {
        name: playlistName,
        transitionType: apiType,
        transitionSpeed: transition.speed,
        contents: validContents,
      };
      if (isNew) {
        await cmsApiV2.post('/pc/playlist', payload);
        toast.success('Playlist saved!');
      } else {
        await cmsApiV2.put('/pc/playlist', { id: playlistId, ...payload });
        toast.success('Playlist saved!');
      }
      router.push('/playlists');
    } catch (err: any) {
      console.error('Playlist save error:', err?.response?.data || err);
      toast.error(err?.response?.data?.message || 'Failed to save playlist');
    } finally {
      setSaving(false);
    }
  }

  // ── Upload file ──
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const uuid = Math.random().toString(36).substr(2) + Date.now().toString(36);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folderId', '0');
    fd.append('fileName', file.name);
    fd.append('fileType', file.type || 'application/octet-stream');
    fd.append('filesize', file.size.toString());
    fd.append('chunkindex', '0');
    fd.append('totalChunks', '1');
    fd.append('uuid', uuid);
    fd.append('cancelUpload', 'false');

    const toastId = toast.loading('Uploading…');
    try {
      await cmsApi.post('/cc/content/chunk', fd);
      toast.success('Uploaded!', { id: toastId });
      loadAssets();
    } catch (err: any) {
      console.error('Upload failed:', err?.response?.data || err?.message || err);
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Upload failed';
      toast.error(`Error: ${msg}`, { id: toastId, duration: 5000 });
    }
    e.target.value = '';
  }



  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading playlist…
      </div>
    );
  }

  const totalSecs = totalDurSecs(items);

  return (
    <div className="ple-root">
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <header className="ple-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="ple-back" onClick={() => router.push('/playlists')} title="Back to playlists">
            <ArrowLeft size={16} />
          </button>

          {/* Editable playlist name */}
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                className="ple-name-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingName(false); }}
                autoFocus
              />
              <button className="ple-icon-btn" onClick={confirmEdit}><Check size={14} /></button>
              <button className="ple-icon-btn" onClick={() => setEditingName(false)}><X size={14} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h1 className="ple-title">{playlistName}</h1>
              <button className="ple-icon-btn" onClick={startEdit} title="Rename"><Pencil size={13} /></button>
            </div>
          )}
        </div>

        {/* Duration pill */}
        <div className="ple-duration-pill">
          <Clock size={13} />
          <span>{secsToHHMMSS(totalSecs)}</span>
          <span style={{ opacity: 0.5 }}>· {items.length} items</span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="ple-action-btn" onClick={() => setShowWherePlaying(true)} title="Currently Playing">
            <Tv size={15} />
            <span>Where Playing</span>
          </button>
          <button className="ple-action-btn" onClick={() => setShowPreview({ isOpen: true, initialIndex: 0 })} disabled={items.length === 0}>
            <Eye size={15} />
            <span>Preview</span>
          </button>
          <button className="ple-action-btn" onClick={() => setShowTransition(true)} title="Transition">
            <Settings2 size={15} />
            <span>Transition</span>
          </button>
          <button
            className="ple-save-btn"
            onClick={save}
            disabled={saving}
            title="Save playlist"
          >
            <Save size={15} />
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </header>

      <div className="ple-body">
        {/* ── Left: Playlist items ──────────────────────────────────── */}
        <div className="ple-list-panel" onDrop={onPlaylistDrop} onDragOver={onPlaylistDragOver}>
          {items.length === 0 ? (
            <div className="ple-empty">
              <Play size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No items yet</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4 }}>Browse and add content from the right panel</p>
            </div>
          ) : (
            <div className="ple-items">
              {items.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="ple-item"
                  draggable
                  onDragStart={e => onDragStart(e, idx)}
                  onDragOver={e => onDragOver(e, idx)}
                >
                  <div className="ple-item-drag"><GripVertical size={14} /></div>
                  <span className="ple-item-idx">{idx + 1}</span>

                  {/* Thumbnail */}
                  <div className="ple-thumb" onClick={() => {
                    if (!item.contentType?.startsWith('APP_')) {
                      setShowPreview({ isOpen: true, initialIndex: idx });
                    } else {
                      handleEditItemClick(item, idx);
                    }
                  }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Click to edit">
                    {getSafeThumbnailUrl(item) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getSafeThumbnailUrl(item)!} alt={item.name} />
                    ) : item.contentType?.startsWith('APP_') ? (
                      <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {APP_ITEMS.find(a => a.contentType === item.contentType)?.icon || (
                          <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{item.name ? item.name.charAt(0).toUpperCase() : 'A'}</div>
                        )}
                      </div>
                    ) : (
                      <ImageIcon size={18} style={{ opacity: 0.3 }} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="ple-item-info" onClick={() => handleEditItemClick(item, idx)} style={{ cursor: 'pointer' }} title="Click to edit">
                    <p className="ple-item-name">{item.name}</p>
                    <p className="ple-item-meta">{secsToHHMMSS(item.duration || 0)}</p>
                  </div>

                  {/* Duration controls */}
                  <div className="ple-dur-ctrl">
                    <button onClick={() => changeDuration(idx, -1)}><Minus size={11} /></button>
                    <DurationInput
                      value={item.duration}
                      onChange={secs => setDurationValue(idx, secs)}
                    />
                    <button onClick={() => changeDuration(idx, 1)}><Plus size={11} /></button>
                  </div>

                  <button className="ple-del-btn" onClick={() => removeItem(idx)} title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Content browser ────────────────────────────────── */}
        <div className="ple-sidebar">
          {/* Search + Upload */}
          <div className="ple-sb-top">
            <div className="ple-sb-search">
              <Search size={13} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
              />
            </div>
            <input ref={fileInputRef} type="file" hidden accept="image/*,video/*" onChange={handleUpload} />
            <button className="ple-upload-btn" onClick={() => fileInputRef.current?.click()} title="Upload asset">
              <Upload size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div className="ple-sb-tabs">
            {(['Images', 'Videos', 'Apps'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSideTab(tab)}
                className={sideTab === tab ? 'ple-tab-active' : 'ple-tab'}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content list */}
          <div className="ple-sb-list">
            {sideTab === 'Apps' ? (
              <div className="ple-apps-list">
                {APP_ITEMS.map(app => {
                  const requiresInput = [
                    'APP_YOUTUBE', 'APP_HTML', 'APP_CANVA_PUBLIC', 'APP_GOOGLE_SHEET',
                    'APP_GOOGLE_SLIDE', 'APP_OUTLOOK_CALENDAR', 'APP_MICROSOFT_EXCEL',
                    'APP_MICROSOFT_POWERBI', 'APP_WEATHER', 'APP_INSTAGRAM', 'APP_GOOGLE_CALENDAR',
                    'APP_POSTER_MY_WALL'
                  ].includes(app.contentType);

                  return (
                    <div key={app.contentType} className="ple-app-item" draggable onDragStart={e => {
                      if (requiresInput) {
                        e.preventDefault(); // Don't allow drag-to-add for items that require input/URLs
                      } else {
                        onAssetDragStart(e, { ...app, isApp: true });
                      }
                    }}>
                      <div className="ple-app-icon">{app.icon}</div>
                      <div className="ple-app-info">
                        <p className="ple-app-name">{app.label}</p>
                        <p className="ple-app-sub">{app.sub}</p>
                      </div>
                      <button
                        className="ple-add-btn"
                        onClick={() => setActiveAppModal({ contentType: app.contentType, label: app.label })}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : assetsLoading ? (
              <div className="ple-sb-loading">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="ple-asset-skeleton" style={{ animationDelay: `${i * 0.07}s` }} />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="ple-sb-empty">
                <ImageIcon size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p>No {sideTab.toLowerCase()} found</p>
                <button className="ple-upload-big" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} /> Upload
                </button>
              </div>
            ) : (
              <div className="ple-asset-grid">
                {assets.map(asset => (
                  <div key={asset.id} className="ple-asset-card" onClick={() => addItem(asset)} draggable onDragStart={e => onAssetDragStart(e, asset)}>
                    {asset.thumbLink ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.thumbLink} alt={asset.name} />
                    ) : (
                      <ImageIcon size={20} style={{ opacity: 0.3 }} />
                    )}
                    <div className="ple-asset-overlay">
                      <Plus size={18} />
                    </div>
                    <p className="ple-asset-name">{asset.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showTransition && (
        <TransitionPopup
          isOpen={showTransition}
          settings={transition}
          onSave={s => {
            setTransition(s);
            setShowTransition(false);
          }}
          onClose={() => setShowTransition(false)}
        />
      )}

      {showPreview.isOpen && (
        <PreviewModal
          items={items}
          initialIndex={showPreview.initialIndex}
          name={playlistName}
          transition={transition}
          onClose={() => setShowPreview({ isOpen: false })}
        />
      )}

      {showWherePlaying && (
        <WherePlayingModal
          playlistId={playlistId}
          onClose={() => setShowWherePlaying(false)}
        />
      )}

      {activeAppModal && (
        (() => {
          const commonProps = {
            editIndex: activeAppModal.editIndex,
            initialData: activeAppModal.initialData,
            onAdd: (item: PlaylistItem) => addAppItem(item),
            onEdit: (idx: number, item: PlaylistItem) => {
              setItems(prev => {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], name: item.name, permaLink: item.permaLink, metadata: item.metadata };
                return copy;
              });
            },
            onClose: () => setActiveAppModal(null)
          };

          switch (activeAppModal.contentType) {
            case 'APP_ZONES': return <ZonesEditorModal {...commonProps} />;
            case 'APP_WEATHER': return <WeatherAppModal {...commonProps} />;
            case 'APP_ANNOUNCEMENT': return <AnnouncementAppModal {...commonProps} />;
            case 'APP_YOUTUBE': return <YoutubeAppModal {...commonProps} />;
            case 'APP_INSTAGRAM': return <InstagramAppModal {...commonProps} />;
            case 'APP_CANVA_PUBLIC': return <CanvaPublicAppModal {...commonProps} />;
            case 'APP_GOOGLE_SHEET': return <GoogleSheetAppModal {...commonProps} />;
            case 'APP_GOOGLE_SLIDE': return <GoogleSlideAppModal {...commonProps} />;
            case 'APP_GOOGLE_CALENDAR': return <GoogleCalendarAppModal {...commonProps} />;
            case 'APP_MICROSOFT_EXCEL': return <MicrosoftExcelAppModal {...commonProps} />;
            case 'APP_MICROSOFT_POWERBI': return <MicrosoftPowerBiAppModal {...commonProps} />;
            case 'APP_OUTLOOK_CALENDAR': return <OutlookCalendarAppModal {...commonProps} />;
            case 'APP_POSTER_MY_WALL': return <PosterMyWallAppModal {...commonProps} />;
            case 'APP_HTML': return <WebsiteAppModal {...commonProps} />;
            default: return null;
          }
        })()
      )}

      {/* ── Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        .ple-root {
          display: flex; flex-direction: column; height: 100vh;
          background: var(--bg-base); overflow: hidden;
        }

        /* Header */
        .ple-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; height: 60px; flex-shrink: 0;
          background: var(--sidebar-bg); border-bottom: 1px solid var(--border);
          gap: 16px;
        }
        .ple-back {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .ple-back:hover { background: var(--card-bg); color: var(--text); }
        .ple-title {
          margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--text);
        }
        .ple-name-input {
          font-size: 0.9rem; font-weight: 700; color: var(--text);
          background: var(--input-bg); border: 1px solid var(--accent);
          border-radius: 8px; padding: 4px 10px; outline: none;
        }
        .ple-icon-btn {
          width: 26px; height: 26px; border-radius: 6px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .ple-icon-btn:hover { color: var(--text); background: var(--card-bg); }
        .ple-duration-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          background: var(--card-bg); border: 1px solid var(--border);
          font-size: 0.75rem; font-weight: 600; color: var(--text-muted);
        }
        .ple-action-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 9px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); font-size: 0.78rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .ple-action-btn:hover { border-color: var(--accent); color: var(--accent); }
        .ple-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ple-save-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 18px; border-radius: 12px; border: none;
          background: var(--btn-cta-bg); color: var(--btn-cta-text);
          font-size: 0.78rem; font-weight: 700; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease;
        }
        .ple-save-btn:hover { background: var(--btn-cta-hover); }
        .ple-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Body layout */
        .ple-body {
          display: flex; flex: 1; overflow: hidden;
        }

        /* Left playlist panel */
        .ple-list-panel {
          flex: 1; overflow-y: auto; padding: 16px;
          border-right: 1px solid var(--border);
        }
        .ple-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; color: var(--text-muted);
          font-size: 0.85rem; text-align: center;
        }
        .ple-items { display: flex; flex-direction: column; gap: 8px; }
        .ple-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          background: var(--card-bg); border: 1px solid var(--border);
          transition: box-shadow 0.15s, border-color 0.15s;
          cursor: grab;
        }
        .ple-item:active { cursor: grabbing; }
        .ple-item:hover { border-color: var(--accent); box-shadow: 0 2px 12px rgba(99,102,241,0.12); }
        .ple-item-drag { color: var(--text-muted); opacity: 0.4; flex-shrink: 0; }
        .ple-item-idx {
          min-width: 22px; text-align: center; font-size: 0.7rem;
          font-weight: 700; color: var(--text-muted); flex-shrink: 0;
        }
        .ple-thumb {
          width: 52px; height: 40px; border-radius: 7px; flex-shrink: 0;
          background: var(--bg-base); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border);
        }
        .ple-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .ple-item-info { flex: 1; min-width: 0; }
        .ple-item-name {
          margin: 0; font-size: 0.78rem; font-weight: 600; color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ple-item-meta {
          margin: 2px 0 0; font-size: 0.68rem; color: var(--text-muted);
        }
        .ple-dur-ctrl {
          display: flex; align-items: center; gap: 4px; flex-shrink: 0;
        }
        .ple-dur-ctrl button {
          width: 22px; height: 22px; border-radius: 5px;
          border: 1px solid var(--border); background: var(--bg-base);
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; transition: all 0.1s;
        }
        .ple-dur-ctrl button:hover { border-color: var(--accent); color: var(--accent); }
        .ple-dur-input {
          width: 44px; text-align: center;
          padding: 3px 4px; border-radius: 5px;
          border: 1px solid var(--border); background: var(--input-bg);
          color: var(--text); font-size: 0.72rem; font-weight: 600;
          outline: none;
        }
        .ple-del-btn {
          width: 28px; height: 28px; border-radius: 7px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.15s;
        }
        .ple-del-btn:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; color: #ef4444; }

        /* Right sidebar */
        .ple-sidebar {
          width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
          background: var(--sidebar-bg); overflow: hidden;
        }
        .ple-sb-top {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; border-bottom: 1px solid var(--border);
        }
        .ple-sb-search {
          flex: 1; display: flex; align-items: center; gap: 7px;
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 9px; padding: 6px 10px;
        }
        .ple-sb-search input {
          flex: 1; border: none; background: transparent; color: var(--text);
          font-size: 0.78rem; outline: none;
        }
        .ple-sb-search svg { color: var(--text-muted); flex-shrink: 0; }
        .ple-upload-btn {
          width: 34px; height: 34px; border-radius: 9px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .ple-upload-btn:hover { border-color: var(--accent); color: var(--accent); }
        .ple-sb-tabs {
          display: flex; border-bottom: 1px solid var(--border);
          padding: 0 14px;
        }
        .ple-tab, .ple-tab-active {
          flex: 1; padding: 10px 0; border: none; background: none;
          font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .ple-tab { color: var(--text-muted); }
        .ple-tab-active { color: var(--accent); border-bottom-color: var(--accent); }
        .ple-sb-list { flex: 1; overflow-y: auto; padding: 12px; }
        .ple-sb-loading {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        }
        .ple-asset-skeleton {
          height: 90px; border-radius: 10px;
          background: var(--card-bg); animation: pulse 1.4s ease-in-out infinite;
        }
        .ple-sb-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 200px; color: var(--text-muted);
          font-size: 0.8rem; text-align: center; gap: 6px;
        }
        .ple-upload-big {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px; border-radius: 8px; margin-top: 8px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); font-size: 0.75rem; cursor: pointer;
          transition: all 0.15s;
        }
        .ple-upload-big:hover { border-color: var(--accent); color: var(--accent); }
        .ple-asset-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        }
        .ple-asset-card {
          border-radius: 10px; overflow: hidden;
          background: var(--card-bg); border: 1px solid var(--border);
          cursor: pointer; position: relative;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .ple-asset-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
        .ple-asset-card img { width: 100%; height: 80px; object-fit: cover; display: block; }
        .ple-asset-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          color: #fff; opacity: 0; transition: opacity 0.15s;
        }
        .ple-asset-card:hover .ple-asset-overlay { opacity: 1; }
        .ple-asset-name {
          padding: 5px 7px; margin: 0; font-size: 0.65rem; font-weight: 600;
          color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Apps list */
        .ple-apps-list { display: flex; flex-direction: column; gap: 6px; }
        .ple-app-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 10px;
          background: var(--card-bg); border: 1px solid var(--border);
          transition: border-color 0.15s;
        }
        .ple-app-item:hover { border-color: var(--accent); }
        .ple-app-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ple-app-info { flex: 1; min-width: 0; }
        .ple-app-name { margin: 0; font-size: 0.78rem; font-weight: 600; color: var(--text); }
        .ple-app-sub { margin: 2px 0 0; font-size: 0.66rem; color: var(--text-muted); }
        .ple-add-btn {
          width: 28px; height: 28px; border-radius: 7px; border: none;
          background: var(--btn-cta-bg); color: var(--btn-cta-text); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s ease;
        }
        .ple-add-btn:hover { background: var(--btn-cta-hover); }

        /* Modals */
        .pl-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(4px);
        }
        .pl-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 18px; width: 100%; overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.35);
        }
        .pl-modal-hd {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 14px; border-bottom: 1px solid var(--border);
        }
        .pl-modal-hd h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text); }
        .pl-modal-x {
          width: 28px; height: 28px; border-radius: 7px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .pl-modal-bd { padding: 18px 20px; display: flex; flex-direction: column; }
        .pl-modal-ft {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 14px 20px; border-top: 1px solid var(--border);
        }
        .pl-label { margin: 0 0 0; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
        .pl-input {
          width: 100%; padding: 9px 12px; border-radius: 9px;
          border: 1px solid var(--border); background: var(--input-bg);
          color: var(--text); font-size: 0.83rem; outline: none;
          margin-top: 6px;
        }
        .pl-chip {
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); font-size: 0.75rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .pl-chip:hover { border-color: var(--accent); color: var(--accent); }
        .pl-chip-active {
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid var(--accent); background: var(--accent);
          color: #fff; font-size: 0.75rem; font-weight: 600;
          cursor: pointer;
        }
        .pl-btn-ghost {
          padding: 8px 18px; border-radius: 9px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); font-size: 0.78rem; font-weight: 600; cursor: pointer;
        }
        .pl-btn-primary {
          padding: 8px 20px; border-radius: 12px; border: none;
          background: var(--btn-cta-bg); color: var(--btn-cta-text);
          font-size: 0.78rem; font-weight: 700; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease;
        }
        .pl-btn-primary:hover { background: var(--btn-cta-hover); }
        .pl-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        @keyframes pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
