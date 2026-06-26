import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PlaylistItem } from '@/types/playlist';

export function AnnouncementAppModal({ editIndex, initialData, onAdd, onEdit, onClose }: { 
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialData?.text || '');
  const [textColor, setTextColor] = useState(initialData?.textColor || '#ffffff');
  const [bgColor, setBgColor] = useState(initialData?.bgColor || '#000000');

  function save() {
    if (!text.trim()) return;
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: `Announcement`,
      thumbLink: '',
      duration: 15,
      contentType: 'APP_ANNOUNCEMENT',
      metadata: { text, fontColor: textColor, backgroundColor: bgColor, font: 'Inter', scrollingSpeed: 'Normal', direction: 'Left' }
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
          <h3>Configure Announcement</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pl-modal-bd" style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 24, padding: '20px' }}>
          {/* Left Controls */}
          <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="pl-label">Message Text</p>
              <textarea className="pl-input" style={{ minHeight: '120px', resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Type your announcement here..." autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <p className="pl-label">Text Color</p>
                <input type="color" className="pl-input" style={{ padding: '2px', height: '36px' }} value={textColor} onChange={e => setTextColor(e.target.value)} />
              </div>
              <div>
                <p className="pl-label">Background Color</p>
                <input type="color" className="pl-input" style={{ padding: '2px', height: '36px' }} value={bgColor} onChange={e => setBgColor(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Right Preview */}
          <div style={{ flex: 1, backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              Live Preview
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: bgColor, color: textColor, padding: '40px', overflow: 'hidden' }}>
              <div style={{ fontSize: '2rem', fontFamily: 'Inter', textAlign: 'center', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {text || 'Your announcement text will appear here'}
              </div>
            </div>
          </div>
        </div>
        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save} disabled={!text.trim()}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
