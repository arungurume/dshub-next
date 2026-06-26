import React, { useState } from 'react';
import { X, Image } from 'lucide-react';
import { PlaylistItem } from '@/types/playlist';

function transformToEmbedUrl(url: string): string {
  if (!url) return '';
  try {
    let cleanUrl = url.split('?')[0].split('#')[0];
    if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
    }
    if (cleanUrl.endsWith('/watch')) {
        cleanUrl = cleanUrl.replace(/\/watch$/, '/view');
    } else if (!cleanUrl.endsWith('/view')) {
        if (cleanUrl.includes('/design/')) {
            const parts = cleanUrl.split('/');
            const designIndex = parts.indexOf('design');
            if (designIndex !== -1 && parts.length > designIndex + 1) {
                if (parts.length === designIndex + 2) {
                    cleanUrl += '/view';
                }
            }
        }
    }
    return cleanUrl;
  } catch (e) {
    return url;
  }
}

export function CanvaPublicAppModal({ editIndex, initialData, onAdd, onEdit, onClose }: { 
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialData?.url || initialData?.permaLink || '');
  const [name, setName] = useState(initialData?.name || '');
  
  const isValidCanvaLink = url.includes('canva.com');
  const iframeUrl = isValidCanvaLink ? transformToEmbedUrl(url) : '';

  function save() {
    if (!url.trim() || !isValidCanvaLink) return;
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: name.trim() || 'Canva Public View',
      thumbLink: '',
      duration: 15,
      contentType: 'APP_CANVA_PUBLIC',
      permaLink: iframeUrl, // The embed URL is what actually gets saved in angular often
      metadata: { url: iframeUrl }
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
          <h3>Configure Canva Public App</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pl-modal-bd" style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 24, padding: '20px' }}>
          {/* Left Controls */}
          <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="pl-label">Label (optional)</p>
              <input className="pl-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Menu Design" autoFocus />
            </div>
            <div>
              <p className="pl-label">Canva Public View URL</p>
              <textarea className="pl-input" style={{ minHeight: '120px', resize: 'vertical' }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.canva.com/design/..." />
              {!isValidCanvaLink && url.length > 0 && (
                <p style={{ color: '#e74c3c', fontSize: '0.75rem', marginTop: '4px' }}>Please enter a valid Canva URL.</p>
              )}
            </div>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}><strong>Note:</strong> Ensure you are using a public view link or an embed link from your Canva share settings.</p>
            </div>
          </div>

          {/* Right Preview */}
          <div style={{ flex: 1, backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              Live Preview
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', position: 'relative' }}>
              {iframeUrl ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={iframeUrl}
                  title="Canva Preview"
                  frameBorder="0"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                ></iframe>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '50%', marginBottom: '16px' }}>
                    <Image size={48} strokeWidth={1.5} />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Enter a valid Canva URL to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save} disabled={!url.trim() || !isValidCanvaLink}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
