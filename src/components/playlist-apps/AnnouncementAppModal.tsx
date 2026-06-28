import React, { useState } from 'react';
import { X, AlignLeft, AlignCenter, AlignRight, ArrowUpToLine, ArrowDownToLine, Minus } from 'lucide-react';
import { PreviewTVBezel } from './PreviewTVBezel';
import { PlaylistItem } from '@/types/playlist';

const AVAILABLE_FONTS = ['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Open Sans', 'Lato'];

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
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(initialData?.textAlign || 'center');
  const [verticalAlign, setVerticalAlign] = useState<'top' | 'middle' | 'bottom'>(initialData?.verticalAlign || 'middle');
  const [fontSize, setFontSize] = useState<number>(initialData?.fontSize || 2.5);
  const [fontFamily, setFontFamily] = useState<string>(initialData?.font || 'Inter');

  function save() {
    if (!text.trim()) return;
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: `Announcement`,
      thumbLink: '',
      duration: 15,
      contentType: 'APP_ANNOUNCEMENT',
      permaLink: text,
      metadata: { text, fontColor: textColor, backgroundColor: bgColor, textAlign, verticalAlign, fontSize, font: fontFamily, scrollingSpeed: 'Normal', direction: 'Left' }
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <p className="pl-label" style={{ margin: 0 }}>Font</p>
                </div>
                <select className="pl-input" style={{ width: '100%', height: '36px' }} value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
                  {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <p className="pl-label" style={{ margin: 0 }}>Font Size</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fontSize}rem</span>
                </div>
                <input type="range" min="1" max="8" step="0.5" value={fontSize} onChange={e => setFontSize(parseFloat(e.target.value))} style={{ width: '100%', cursor: 'pointer', height: '36px' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <p className="pl-label">Horizontal Align</p>
                <div style={{ display: 'flex', gap: 8, background: 'var(--accent-light)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
                  <button
                    onClick={() => setTextAlign('left')}
                    style={{ background: textAlign === 'left' ? 'var(--accent)' : 'transparent', color: textAlign === 'left' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  >
                    <AlignLeft size={16} />
                  </button>
                  <button
                    onClick={() => setTextAlign('center')}
                    style={{ background: textAlign === 'center' ? 'var(--accent)' : 'transparent', color: textAlign === 'center' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  >
                    <AlignCenter size={16} />
                  </button>
                  <button
                    onClick={() => setTextAlign('right')}
                    style={{ background: textAlign === 'right' ? 'var(--accent)' : 'transparent', color: textAlign === 'right' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  >
                    <AlignRight size={16} />
                  </button>
                </div>
              </div>
              <div>
                <p className="pl-label">Vertical Align</p>
                <div style={{ display: 'flex', gap: 8, background: 'var(--accent-light)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
                  <button
                    onClick={() => setVerticalAlign('top')}
                    style={{ background: verticalAlign === 'top' ? 'var(--accent)' : 'transparent', color: verticalAlign === 'top' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  >
                    <ArrowUpToLine size={16} />
                  </button>
                  <button
                    onClick={() => setVerticalAlign('middle')}
                    style={{ background: verticalAlign === 'middle' ? 'var(--accent)' : 'transparent', color: verticalAlign === 'middle' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    onClick={() => setVerticalAlign('bottom')}
                    style={{ background: verticalAlign === 'bottom' ? 'var(--accent)' : 'transparent', color: verticalAlign === 'bottom' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  >
                    <ArrowDownToLine size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Preview - LED TV Style */}
          <PreviewTVBezel>
            <div style={{ flex: 1, display: 'flex', alignItems: verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center', justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center', backgroundColor: bgColor, color: textColor, padding: '24px', textAlign: textAlign, position: 'relative' }}>
              {text ? (
                <h2 style={{ margin: 0, fontSize: `${fontSize}rem`, fontFamily, fontWeight: 700, wordBreak: 'break-word', lineHeight: 1.3 }}>{text}</h2>
              ) : (
                <p style={{ opacity: 0.5, fontSize: `${fontSize}rem`, fontFamily, fontWeight: 700, margin: 0, wordBreak: 'break-word', lineHeight: 1.3 }}>Announcement Preview</p>
              )}
            </div>
          </PreviewTVBezel>
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
