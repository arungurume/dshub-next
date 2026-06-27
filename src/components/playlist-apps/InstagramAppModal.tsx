import React, { useState } from 'react';
import { X, Check, XCircle, Play } from 'lucide-react';
import { PlaylistItem } from '@/types/playlist';
import { PreviewTVBezel } from './PreviewTVBezel';

export function InstagramAppModal({ editIndex, initialData, onAdd, onEdit, onClose }: { 
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'source' | 'moderate' | 'style'>('moderate');
  
  const [accountName, setAccountName] = useState(initialData?.accountName || 'DShub');
  const [displayLanguage, setDisplayLanguage] = useState(initialData?.language || 'English (en)');
  const [postDuration, setPostDuration] = useState(initialData?.duration || 10);
  const [showPostCaption, setShowPostCaption] = useState(initialData?.showCaption !== false);
  const [selectedFont, setSelectedFont] = useState(initialData?.font || 'Poppins');
  const [fontColor, setFontColor] = useState(initialData?.fontColor || '#ffffff');
  const [backgroundColor, setBackgroundColor] = useState(initialData?.backgroundColor || '#920a75');
  const [transitionSpeed, setTransitionSpeed] = useState(initialData?.transitionSpeed || 'Medium');
  const [template, setTemplate] = useState(initialData?.template || 'Image with text on left');

  const transitionSpeeds = ['Slow', 'Medium', 'Fast'];
  const templates = ['Image only', 'Image with text on right', 'Image with text on left', 'Image with text overlay'];
  const availableFonts = ['Inter', 'Roboto', 'Poppins', 'Lato', 'Montserrat', 'Open Sans'];
  const availableLanguages = ['English (en)', 'Spanish (es)', 'French (fr)', 'German (de)', 'Italian (it)'];

  // Mock posts for Moderate tab
  const [posts, setPosts] = useState(Array.from({ length: 8 }).map((_, i) => ({
    id: i + 1,
    user: 'DShub',
    time: '8 months ago',
    image: `assets/images/cat${i + 1}.jpg`,
    caption: 'Test News Posting - This is a test post! http://edne.tw/n959534',
    approved: true
  })));

  function toggleApproval(id: number, status: boolean) {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, approved: status } : p));
  }

  function save() {
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: `Instagram: ${accountName}`,
      permaLink: accountName,
      thumbLink: '',
      duration: postDuration,
      contentType: 'APP_INSTAGRAM',
      metadata: {
        accountName,
        language: displayLanguage,
        duration: postDuration,
        showCaption: showPostCaption,
        font: selectedFont,
        fontColor,
        backgroundColor,
        transitionSpeed,
        template
      }
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
          <h3>Configure Instagram App</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {(['source', 'moderate', 'style'] as const).map(tab => (
            <div 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                color: activeTab === tab ? '#E1306C' : 'rgba(255,255,255,0.6)',
                borderBottom: activeTab === tab ? '2px solid #E1306C' : '2px solid transparent',
                textTransform: 'capitalize',
                fontWeight: 600
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <div className="pl-modal-bd" style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'source' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p className="pl-label">Account Name</p>
                <input className="pl-input" value={accountName} onChange={e => setAccountName(e.target.value)} />
              </div>
            </div>
          )}

          {activeTab === 'moderate' && (
            <div>
              <p className="pl-label" style={{ marginBottom: '12px' }}>Moderate Posts</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                {posts.map(post => (
                  <div key={post.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ height: '100px', background: '#2a2a2a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#555' }}>Image Placeholder</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                       <span style={{ fontSize: '0.7rem', color: '#888' }}>{post.user}</span>
                       <span style={{ fontSize: '0.7rem', color: '#888' }}>{post.time}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#ccc', marginBottom: '12px', height: '32px', overflow: 'hidden' }}>{post.caption}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => toggleApproval(post.id, true)}
                        style={{ flex: 1, padding: '6px', background: post.approved ? 'rgba(46, 204, 113, 0.2)' : 'transparent', border: '1px solid #2ecc71', color: '#2ecc71', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => toggleApproval(post.id, false)}
                        style={{ flex: 1, padding: '6px', background: !post.approved ? 'rgba(231, 76, 60, 0.2)' : 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'style' && (
            <div style={{ display: 'flex', gap: 24, height: '100%' }}>
              {/* Left Controls */}
              <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p className="pl-label">Display Language</p>
                  <select className="pl-input" value={displayLanguage} onChange={e => setDisplayLanguage(e.target.value)}>
                    {availableLanguages.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <p className="pl-label">Post Duration (seconds)</p>
                  <input type="number" className="pl-input" value={postDuration} onChange={e => setPostDuration(Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="checkbox" id="showCaption" checked={showPostCaption} onChange={e => setShowPostCaption(e.target.checked)} />
                  <label htmlFor="showCaption" className="pl-label" style={{ margin: 0, cursor: 'pointer' }}>Show Post Caption</label>
                </div>
                 <div>
                  <p className="pl-label">Font Family</p>
                  <select className="pl-input" value={selectedFont} onChange={e => setSelectedFont(e.target.value)}>
                    {availableFonts.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <p className="pl-label">Transition Speed</p>
                  <select className="pl-input" value={transitionSpeed} onChange={e => setTransitionSpeed(e.target.value)}>
                    {transitionSpeeds.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <p className="pl-label">Font Color</p>
                    <input type="color" className="pl-input" style={{ padding: '2px', height: '36px' }} value={fontColor} onChange={e => setFontColor(e.target.value)} />
                  </div>
                  <div>
                    <p className="pl-label">Background Color</p>
                    <input type="color" className="pl-input" style={{ padding: '2px', height: '36px' }} value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} />
                  </div>
                </div>
                <div>
                    <p className="pl-label">Template</p>
                    <select className="pl-input" value={template} onChange={e => setTemplate(e.target.value)}>
                      {templates.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
              </div>

              {/* Right Preview */}
              <PreviewTVBezel>
                <div style={{ flex: 1, backgroundColor: '#000', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ 
                  width: '100%', 
                  maxWidth: '360px', 
                  backgroundColor, 
                  color: fontColor, 
                  fontFamily: selectedFont, 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: template === 'Image with text on left' ? 'row-reverse' : template === 'Image with text on right' ? 'row' : 'column'
                }}>
                  {template !== 'Image only' && (
                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{accountName}</span>
                      </div>
                      {showPostCaption && (
                        <p style={{ fontSize: '0.9rem', lineHeight: 1.5, opacity: 0.9 }}>
                          This is a live preview of your Instagram post! The text and styling updates automatically.
                        </p>
                      )}
                      <span style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 'auto', paddingTop: '16px' }}>2 hours ago</span>
                    </div>
                  )}
                  <div style={{ 
                    flex: template === 'Image only' ? '1 1 100%' : '1 1 50%',
                    aspectRatio: template === 'Image only' || template === 'Image with text overlay' ? '1 / 1' : '4 / 5',
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Image Area</span>
                    {template === 'Image with text overlay' && (
                       <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '20px', color: '#fff' }}>
                          <p style={{ fontSize: '0.9rem' }}>{showPostCaption ? 'Overlay caption text preview here...' : ''}</p>
                       </div>
                    )}
                  </div>
                </div>
                </div>
              </PreviewTVBezel>
            </div>
          )}
        </div>

        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
