import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet } from 'lucide-react';
import { PreviewTVBezel } from './PreviewTVBezel';
import { PlaylistItem } from '@/types/playlist';

function transformToEmbedUrl(url: string): string {
  if (!url) return '';
  try {
    if (url.includes('/pubhtml')) {
      return url + (url.includes('?') ? '&' : '?') + 'widget=true&headers=false';
    }
    if (url.includes('/edit')) {
      return url.replace(/\/edit.*$/, '/preview');
    }
    if (!url.endsWith('/preview') && !url.includes('/pubhtml')) {
      let cleanUrl = url.split('?')[0].split('#')[0];
      if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
      return cleanUrl + '/preview';
    }
    return url;
  } catch (e) {
    return url;
  }
}

export function GoogleSheetAppModal({ editIndex, initialData, onAdd, onEdit, onClose }: { 
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialData?.url || initialData?.permaLink || '');
  const [name, setName] = useState(initialData?.name || '');
  
  const isValidSheetLink = url.includes('docs.google.com/spreadsheets');
  const iframeUrl = isValidSheetLink ? transformToEmbedUrl(url) : '';

  function save() {
    if (!url.trim() || !isValidSheetLink) return;
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: name.trim() || 'Google Sheet',
      thumbLink: '',
      duration: 15,
      contentType: 'APP_GOOGLE_SHEET',
      permaLink: url.trim(),
      metadata: { url: url.trim() }
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
          <h3>Configure Google Sheet App</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pl-modal-bd" style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 24, padding: '20px' }}>
          {/* Left Controls */}
          <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="pl-label">Label (optional)</p>
              <input className="pl-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales Data" autoFocus />
            </div>
            <div>
              <p className="pl-label">Google Sheet URL</p>
              <textarea className="pl-input" style={{ minHeight: '120px', resize: 'vertical' }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              {!isValidSheetLink && url.length > 0 && (
                <p style={{ color: '#e74c3c', fontSize: '0.75rem', marginTop: '4px' }}>Please enter a valid Google Sheets URL.</p>
              )}
            </div>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}><strong>Note:</strong> Make sure your Google Sheet is set to "Anyone with the link can view" or published to the web.</p>
            </div>
          </div>

          {/* Right Preview - LED TV Style */}
          <PreviewTVBezel>
            {iframeUrl ? (
              <iframe
                width="100%"
                height="100%"
                src={iframeUrl}
                title="Google Sheet Preview"
                frameBorder="0"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              ></iframe>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '50%', marginBottom: '16px' }}>
                  <FileSpreadsheet size={48} strokeWidth={1.5} />
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Enter a valid URL to see preview</p>
              </div>
            )}
          </PreviewTVBezel>
        </div>
        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save} disabled={!url.trim() || !isValidSheetLink}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
