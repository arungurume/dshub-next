import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, XCircle, RefreshCw } from 'lucide-react';
import { PlaylistItem } from '@/types/playlist';
import { PreviewTVBezel } from './PreviewTVBezel';
import { cmsApi } from '@/lib/api';
import {
  INSTAGRAM_CONNECT,
  INSTAGRAM_STATUS,
  INSTAGRAM_MEDIA,
  INSTAGRAM_DISCONNECT,
} from '@/lib/apiPaths';

interface IgPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
  approved: boolean;
}

export function InstagramAppModal({ editIndex, initialData, onAdd, onEdit, onClose }: {
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'source' | 'moderate' | 'style'>(
    initialData?.accountName ? 'style' : 'source'
  );

  // Connection state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [igUsername, setIgUsername] = useState<string>(initialData?.accountName || '');
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const popupRef = useRef<Window | null>(null);

  // Style settings
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

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    setMediaError('');
    try {
      const res = await cmsApi.get(INSTAGRAM_MEDIA);
      const data = res.data?.data || [];
      setIgUsername(res.data?.username || igUsername);
      setPosts(data.map((p: any) => ({ ...p, approved: true })));
    } catch {
      setMediaError('Failed to load Instagram posts. Please reconnect.');
    } finally {
      setMediaLoading(false);
    }
  }, [igUsername]);

  // Check connection status on mount
  useEffect(() => {
    cmsApi.get(INSTAGRAM_STATUS).then(res => {
      if (res.data?.connected) {
        setConnected(true);
        loadMedia();
      }
    }).catch(() => {});
  }, [loadMedia]);

  // Listen for popup postMessage from /instagram-callback
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'INSTAGRAM_OAUTH') return;
      if (popupRef.current) { popupRef.current.close(); popupRef.current = null; }
      setConnecting(false);
      if (e.data.status === 'success') {
        setConnected(true);
        loadMedia().then(() => setActiveTab('moderate'));
      } else {
        setMediaError('Instagram connection failed. Please try again.');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadMedia]);

  async function handleConnect() {
    setConnecting(true);
    setMediaError('');
    try {
      const res = await cmsApi.get(INSTAGRAM_CONNECT);
      const { authorizeUrl } = res.data;
      const popup = window.open(authorizeUrl, 'ig_oauth', 'width=600,height=700,left=200,top=100');
      popupRef.current = popup;
      // Poll for popup close in case postMessage doesn't fire
      const timer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(timer);
          setConnecting(false);
        }
      }, 1000);
    } catch {
      setConnecting(false);
      setMediaError('Could not start Instagram connection. Check backend config.');
    }
  }

  async function handleDisconnect() {
    await cmsApi.delete(INSTAGRAM_DISCONNECT).catch(() => {});
    setConnected(false);
    setIgUsername('');
    setPosts([]);
    setActiveTab('source');
  }

  function toggleApproval(id: string, status: boolean) {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, approved: status } : p));
  }

  function save() {
    const approvedPosts = posts.filter(p => p.approved).map(p => p.id);
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: `Instagram: ${igUsername || 'Account'}`,
      permaLink: igUsername,
      thumbLink: '',
      duration: postDuration,
      contentType: 'APP_INSTAGRAM',
      metadata: {
        accountName: igUsername,
        language: displayLanguage,
        duration: postDuration,
        showCaption: showPostCaption,
        font: selectedFont,
        fontColor,
        backgroundColor,
        transitionSpeed,
        template,
        approvedPostIds: approvedPosts,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Instagram gradient icon */}
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📷</div>
            <h3 style={{ margin: 0 }}>Instagram App</h3>
            {connected && igUsername && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(225,48,108,0.2)', color: '#E1306C', border: '1px solid rgba(225,48,108,0.4)', borderRadius: 20, padding: '2px 10px' }}>
                @{igUsername}
              </span>
            )}
          </div>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {(['source', 'moderate', 'style'] as const).map(tab => (
            <div
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px', cursor: 'pointer',
                color: activeTab === tab ? '#E1306C' : 'rgba(255,255,255,0.6)',
                borderBottom: activeTab === tab ? '2px solid #E1306C' : '2px solid transparent',
                textTransform: 'capitalize', fontWeight: 600
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <div className="pl-modal-bd" style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── SOURCE TAB ── */}
          {activeTab === 'source' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}>
              {connected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Connected as @{igUsername}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaa', marginTop: 2 }}>{posts.length} posts loaded</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="pl-btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={loadMedia} disabled={mediaLoading}>
                      <RefreshCw size={14} style={{ animation: mediaLoading ? 'spin 1s linear infinite' : 'none' }} />
                      Refresh Posts
                    </button>
                    <button className="pl-btn-ghost" style={{ flex: 1, color: '#e74c3c', borderColor: 'rgba(231,76,60,0.4)' }} onClick={handleDisconnect}>
                      Disconnect
                    </button>
                  </div>
                  <button className="pl-btn-primary" onClick={() => setActiveTab('moderate')}>
                    View Posts →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#555', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>No Instagram account connected</p>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                    Connect your Instagram Business or Creator account to display your posts on digital signs.
                  </p>
                  <button
                    className="pl-btn-primary"
                    style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? 'Connecting...' : '📸 Connect with Instagram'}
                  </button>
                  {mediaError && <p style={{ color: '#e74c3c', fontSize: '0.8rem', margin: 0 }}>{mediaError}</p>}
                </div>
              )}
            </div>
          )}

          {/* ── MODERATE TAB ── */}
          {activeTab === 'moderate' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p className="pl-label" style={{ margin: 0 }}>Moderate Posts</p>
                {connected && (
                  <button className="pl-btn-ghost" style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }} onClick={loadMedia} disabled={mediaLoading}>
                    <RefreshCw size={12} style={{ animation: mediaLoading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                  </button>
                )}
              </div>

              {!connected ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
                  <p style={{ marginBottom: 16 }}>Connect Instagram first to see real posts.</p>
                  <button className="pl-btn-primary" style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', border: 'none' }} onClick={() => setActiveTab('source')}>
                    Go to Source tab →
                  </button>
                </div>
              ) : mediaLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, height: 220, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
                  <p>No posts found for @{igUsername}</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {posts.map(post => (
                    <div key={post.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden', border: `1px solid ${post.approved ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'}` }}>
                      {/* Post image */}
                      <div style={{ position: 'relative', paddingBottom: '100%' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url}
                          alt={post.caption || ''}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {post.media_type === 'VIDEO' && (
                          <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 5px', fontSize: '0.65rem', color: '#fff' }}>VIDEO</div>
                        )}
                      </div>
                      {/* Caption */}
                      <div style={{ padding: '8px 10px' }}>
                        <p style={{ fontSize: '0.7rem', color: '#aaa', margin: 0, height: 28, overflow: 'hidden', lineHeight: 1.4 }}>
                          {post.caption || '(no caption)'}
                        </p>
                      </div>
                      {/* Approve / Reject */}
                      <div style={{ display: 'flex', gap: 6, padding: '0 10px 10px' }}>
                        <button
                          onClick={() => toggleApproval(post.id, true)}
                          style={{ flex: 1, padding: '5px', background: post.approved ? 'rgba(46,204,113,0.2)' : 'transparent', border: '1px solid #2ecc71', color: '#2ecc71', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => toggleApproval(post.id, false)}
                          style={{ flex: 1, padding: '5px', background: !post.approved ? 'rgba(231,76,60,0.2)' : 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <XCircle size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STYLE TAB ── */}
          {activeTab === 'style' && (
            <div style={{ display: 'flex', gap: 24, height: '100%' }}>
              <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                    <input type="color" className="pl-input" style={{ padding: 2, height: 36 }} value={fontColor} onChange={e => setFontColor(e.target.value)} />
                  </div>
                  <div>
                    <p className="pl-label">Background Color</p>
                    <input type="color" className="pl-input" style={{ padding: 2, height: 36 }} value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <p className="pl-label">Template</p>
                  <select className="pl-input" value={template} onChange={e => setTemplate(e.target.value)}>
                    {templates.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Right: Live Preview using a real post if available */}
              <PreviewTVBezel>
                <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  {(() => {
                    const previewPost = posts.find(p => p.approved) || null;
                    const imgSrc = previewPost
                      ? (previewPost.media_type === 'VIDEO' ? previewPost.thumbnail_url : previewPost.media_url)
                      : null;

                    return (
                      <div style={{
                        width: '100%', maxWidth: 340, backgroundColor, color: fontColor,
                        fontFamily: selectedFont, borderRadius: 12, overflow: 'hidden',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: template === 'Image with text on left' ? 'row-reverse'
                          : template === 'Image with text on right' ? 'row' : 'column'
                      }}>
                        {template !== 'Image only' && (
                          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{igUsername || 'your_account'}</span>
                            </div>
                            {showPostCaption && (
                              <p style={{ fontSize: '0.8rem', lineHeight: 1.4, opacity: 0.9, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                                {previewPost?.caption || 'Your Instagram post caption will appear here.'}
                              </p>
                            )}
                            <span style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: 'auto', paddingTop: 12 }}>
                              {previewPost ? new Date(previewPost.timestamp).toLocaleDateString() : 'just now'}
                            </span>
                          </div>
                        )}
                        <div style={{
                          flex: template === 'Image only' ? '1 1 100%' : '0 0 45%',
                          aspectRatio: template === 'Image only' || template === 'Image with text overlay' ? '1 / 1' : 'auto',
                          background: imgSrc ? `url(${imgSrc}) center/cover` : 'rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', minHeight: 120
                        }}>
                          {!imgSrc && <span style={{ opacity: 0.3, fontSize: '0.75rem' }}>Image Area</span>}
                          {template === 'Image with text overlay' && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', padding: '16px 14px' }}>
                              <p style={{ fontSize: '0.75rem', color: '#fff', margin: 0, lineHeight: 1.4 }}>
                                {showPostCaption ? (previewPost?.caption || 'Caption overlay preview...') : ''}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </PreviewTVBezel>
            </div>
          )}
        </div>

        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save}>
            {editIndex !== undefined ? 'Save' : 'Add to Playlist'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
}
