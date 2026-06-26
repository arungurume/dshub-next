import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PlaylistItem } from '@/types/playlist';

export function ZonesEditorModal({ editIndex, onAdd, onEdit, onClose }: { editIndex?: number, onAdd: (zoneItem: PlaylistItem) => void; onEdit: (idx: number, item: PlaylistItem) => void; onClose: () => void }) {
  // A simplified Zones Editor for parity.
  // In a full implementation, this would allow drag/drop of widgets onto a grid.
  const [layout, setLayout] = useState('1'); // '1' = Full, '2' = Split, etc.
  
  const handleSave = () => {
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: `Zones Layout (${layout})`,
      thumbLink: '',
      duration: 30,
      contentType: 'APP_ZONES',
      metadata: {
        zones: [
          { id: 1, name: 'Main Zone', x: 0, y: 0, w: 100, h: 100 }
        ]
      }
    };
    if (editIndex !== undefined) {
      onEdit(editIndex, item);
    } else {
      onAdd(item);
    }
    onClose();
  };

  return (
    <div className="pl-overlay" onClick={onClose} style={{ padding: '20px', zIndex: 1100 }}>
      <div className="pl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
        <div className="pl-modal-hd" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h3 style={{ color: '#fff' }}>Zones Layout Editor</h3>
          <button className="pl-modal-x" onClick={onClose} style={{ color: '#fff' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
            Select a layout template to divide your screen into multiple zones.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div 
              style={{ border: layout === '1' ? '2px solid #E1306C' : '2px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
              onClick={() => setLayout('1')}
            >
              <div style={{ width: '100%', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '0.8rem', color: '#fff' }}>Single Zone (Full Screen)</span>
            </div>
            
            <div 
              style={{ border: layout === '2' ? '2px solid #E1306C' : '2px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
              onClick={() => setLayout('2')}
            >
              <div style={{ width: '100%', height: '80px', display: 'flex', gap: '4px' }}>
                <div style={{ flex: 2, background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.2)' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.2)' }} />
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.2)' }} />
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#fff' }}>Split Zone (Main + Sidebar)</span>
            </div>
          </div>
        </div>
        <div className="pl-modal-ft" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={handleSave}>Select & Continue</button>
        </div>
      </div>
    </div>
  );
}
