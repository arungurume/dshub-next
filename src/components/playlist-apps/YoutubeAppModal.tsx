import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { PreviewTVBezel } from './PreviewTVBezel';
import { PlaylistItem } from '@/types/playlist';

const Youtube = ({ size = 24, strokeWidth = 2, ...props }: React.SVGProps<SVGSVGElement> & { size?: number, strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

function extractYouTubeId(url: string): string | null {
  const match = url?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

// Parse ISO 8601 duration (e.g. PT4M33S) to seconds
function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

function secsToDisplay(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function YoutubeAppModal({ editIndex, initialData, onAdd, onEdit, onClose }: {
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialData?.url || initialData?.permaLink || '');
  const [name, setName] = useState(initialData?.name || '');
  const [isMuted, setIsMuted] = useState(initialData?.metadata?.isMuted ?? true);
  const [duration, setDuration] = useState<number>(initialData?.duration || 15);
  const [fetchingDuration, setFetchingDuration] = useState(false);

  const videoId = extractYouTubeId(url);
  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  useEffect(() => {
    if (!videoId || !apiKey) return;
    setFetchingDuration(true);
    fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,snippet&key=${apiKey}`)
      .then(r => r.json())
      .then(data => {
        const item = data?.items?.[0];
        if (!item) return;
        const secs = parseISO8601Duration(item.contentDetails?.duration || '');
        if (secs > 0) setDuration(secs);
        if (!name.trim() && item.snippet?.title) setName(item.snippet.title);
      })
      .catch(() => {})
      .finally(() => setFetchingDuration(false));
  }, [videoId, apiKey]);

  function save() {
    if (!url.trim()) return;
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: name.trim() || 'YouTube Video',
      thumbLink: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '',
      duration,
      contentType: 'APP_YOUTUBE',
      permaLink: url.trim(),
      metadata: { isMuted }
    };
    if (editIndex !== undefined) {
      onEdit(editIndex, item);
    } else {
      onAdd(item);
    }
    onClose();
  }

  return (
    <div className="pl-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="pl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 960, minHeight: 600, display: 'flex', flexDirection: 'column' }}>
        <div className="pl-modal-hd">
          <h3>Configure YouTube Video</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pl-modal-bd" style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 24, padding: '20px' }}>
          {/* Left Controls */}
          <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="pl-label">Video Title (optional)</p>
              <input className="pl-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Promo Video" autoFocus />
            </div>
            <div>
              <p className="pl-label">YouTube URL</p>
              <input className="pl-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            </div>

            {/* Duration — auto-fetched, shown with edit control */}
            <div>
              <p className="pl-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Duration (seconds)
                {fetchingDuration && <Loader2 size={12} className="animate-spin" style={{ opacity: 0.6 }} />}
                {!fetchingDuration && videoId && (
                  <span style={{ fontSize: '0.75rem', color: 'rgba(99,255,99,0.7)', fontWeight: 400 }}>
                    · {secsToDisplay(duration)} auto-detected
                  </span>
                )}
              </p>
              <input
                type="number"
                className="pl-input"
                min={1}
                value={duration}
                onChange={e => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input type="checkbox" id="ytMuted" checked={isMuted} onChange={e => setIsMuted(e.target.checked)} />
              <label htmlFor="ytMuted" style={{ fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>Start video muted (recommended)</label>
            </div>
          </div>

          {/* Right Preview - LED TV Style */}
          <PreviewTVBezel>
            {videoId ? (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=${isMuted ? 1 : 0}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              ></iframe>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '50%', marginBottom: '16px' }}>
                  <Youtube size={48} strokeWidth={1.5} />
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Enter a valid YouTube URL</p>
              </div>
            )}
          </PreviewTVBezel>
        </div>
        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save} disabled={!url.trim()}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
