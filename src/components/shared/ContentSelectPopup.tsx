'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Image as ImageIcon, Video, FileVideo, FolderHeart, Globe, Loader2, Play, AlertCircle } from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';

interface ContentAsset {
  id: string | number;
  name: string;
  contentType: 'IMAGE' | 'VIDEO' | 'YOUTUBE' | 'WEBSITE' | 'APP' | string;
  permaLink: string;
  thumbLink?: string;
  size?: number;
}

interface PlaylistAsset {
  id: string | number;
  name: string;
  thumbLink?: string;
  orientation?: string;
  zones?: any[];
}

export type SelectedAssetData = {
  asset: ContentAsset | PlaylistAsset;
  assetType: 'MEDIA' | 'PLAYLIST';
};

interface ContentSelectPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (data: SelectedAssetData) => void;
  initialSelectedId?: string | number;
}

export const ContentSelectPopup: React.FC<ContentSelectPopupProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialSelectedId,
}) => {
  const [selectedTab, setSelectedTab] = useState<'RECENT' | 'IMAGE' | 'VIDEO' | 'PLAYLIST'>('RECENT');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaList, setMediaList] = useState<ContentAsset[]>([]);
  const [playlistList, setPlaylistList] = useState<PlaylistAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ContentAsset | PlaylistAsset | null>(null);

  // Load content & playlists on mount when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [mediaRes, playlistRes] = await Promise.all([
          cmsApi.get('/cc/content', {
            params: { page: 0, size: 500, sortBy: 'updatedDate', sortOrder: 'DESC' },
          }),
          cmsApiV2.get('/pc/playlist', {
            params: { page: 0, size: 200, sortBy: 'updatedDate', sortOrder: 'DESC' },
          }),
        ]);

        setMediaList(mediaRes.data?.content || []);
        setPlaylistList(playlistRes.data?.content || []);

        // Attempt to find initialSelectedId in both lists
        const allItems = [...(mediaRes.data?.content || []), ...(playlistRes.data?.content || [])];
        if (initialSelectedId) {
          const matched = allItems.find(item => String(item.id) === String(initialSelectedId));
          if (matched) {
            setSelectedAsset(matched);
            // set correct tab based on selection type
            const isPlaylist = (playlistRes.data?.content || []).some((p: any) => String(p.id) === String(initialSelectedId));
            if (isPlaylist) {
              setSelectedTab('PLAYLIST');
            } else {
              const matchedMedia = matched as ContentAsset;
              if (matchedMedia.contentType === 'IMAGE') setSelectedTab('IMAGE');
              else if (matchedMedia.contentType === 'VIDEO') setSelectedTab('VIDEO');
              else setSelectedTab('RECENT');
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load assets', err);
        setError('Failed to fetch assets. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, initialSelectedId]);

  if (!isOpen) return null;

  // Helper to extract YouTube ID and thumbnail
  const getYouTubeThumbnail = (url: string): string => {
    if (!url) return '';
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/
    );
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : '';
  };

  // Filter lists based on tab and search query
  const query = searchQuery.trim().toLowerCase();

  const getFilteredAssets = () => {
    if (selectedTab === 'PLAYLIST') {
      return playlistList.filter(p => p.name?.toLowerCase().includes(query));
    }

    let filtered = mediaList;
    if (selectedTab === 'IMAGE') {
      filtered = filtered.filter(a => a.contentType === 'IMAGE');
    } else if (selectedTab === 'VIDEO') {
      filtered = filtered.filter(a => a.contentType === 'VIDEO' || a.contentType === 'YOUTUBE');
    }

    if (query) {
      filtered = filtered.filter(a => a.name?.toLowerCase().includes(query));
    }
    return filtered;
  };

  const filteredItems = getFilteredAssets();

  const handleItemSelect = (item: ContentAsset | PlaylistAsset) => {
    setSelectedAsset(item);
  };

  const handleSave = () => {
    if (!selectedAsset) return;
    const isPlaylist = selectedTab === 'PLAYLIST' || ('zones' in selectedAsset);
    onSelect({
      asset: selectedAsset,
      assetType: isPlaylist ? 'PLAYLIST' : 'MEDIA',
    });
  };

  return (
    <div className="csp-overlay">
      <div className="csp-container">
        
        {/* Header */}
        <div className="csp-header">
          <div>
            <h3 className="csp-title">Select Default Content</h3>
            <p className="csp-subtitle">
              Choose a media item or playlist to display by default on this screen
            </p>
          </div>
          <button onClick={onClose} className="csp-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Inner Content Grid */}
        <div className="csp-body">
          
          {/* Main List Area */}
          <div className="csp-main-area">
            {/* Search & Tabs */}
            <div className="csp-toolbar">
              <div className="csp-search-wrapper">
                <Search className="csp-search-icon" size={16} />
                <input
                  type="text"
                  placeholder={selectedTab === 'PLAYLIST' ? "Search playlists..." : "Search media contents..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="csp-search-input"
                />
              </div>

              <div className="csp-tabs">
                {([
                  { id: 'RECENT', label: 'Recent Media' },
                  { id: 'IMAGE', label: 'Images' },
                  { id: 'VIDEO', label: 'Videos & YouTube' },
                  { id: 'PLAYLIST', label: 'Playlists' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSelectedTab(tab.id);
                      setSearchQuery('');
                    }}
                    className={`csp-tab-btn ${selectedTab === tab.id ? 'active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Body */}
            <div className="csp-list-container">
              {loading ? (
                <div className="csp-empty-state">
                  <Loader2 className="csp-spin csp-indigo" size={24} />
                  <span style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Loading resources...</span>
                </div>
              ) : error ? (
                <div className="csp-empty-state csp-rose">
                  <AlertCircle size={24} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{error}</span>
                </div>
              ) : filteredItems.length > 0 ? (
                <div className="csp-grid">
                  {filteredItems.map((item) => {
                    const isSelected = selectedAsset?.id === item.id;
                    const isPlaylist = 'zones' in item;
                    
                    let icon = <ImageIcon size={18} />;
                    if (isPlaylist) {
                      icon = <FolderHeart size={18} />;
                    } else {
                      const cAsset = item as ContentAsset;
                      if (cAsset.contentType === 'VIDEO' || cAsset.contentType === 'YOUTUBE') {
                        icon = <Video size={18} />;
                      } else if (cAsset.contentType === 'WEBSITE') {
                        icon = <Globe size={18} />;
                      }
                    }

                    let thumb = item.thumbLink || '';
                    if (!thumb && !isPlaylist) {
                      const cAsset = item as ContentAsset;
                      if (cAsset.contentType === 'YOUTUBE') {
                        thumb = getYouTubeThumbnail(cAsset.permaLink);
                      }
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemSelect(item)}
                        className={`csp-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="csp-thumb-wrapper">
                          {thumb ? (
                            <img src={thumb} alt="" className="csp-thumb" />
                          ) : (
                            <div className="csp-icon-color">{icon}</div>
                          )}
                          {!isPlaylist && (item as ContentAsset).contentType === 'VIDEO' && (
                            <div className="csp-video-overlay">
                              <Play size={12} fill="currentColor" />
                            </div>
                          )}
                        </div>
                        <div className="csp-card-info">
                          <p className="csp-card-title">{item.name}</p>
                          <p className="csp-card-meta">
                            {isPlaylist ? 'Playlist' : (item as ContentAsset).contentType}
                          </p>
                        </div>
                        <div className="csp-radio-indicator">
                          {isSelected && <div className="csp-radio-dot" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="csp-empty-state">
                  <p style={{ fontSize: '0.75rem' }}>No matching items found</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Premium Preview & Details Pane */}
          <div className="csp-preview-sidebar">
            <div className="csp-sidebar-header">
              <h4 className="csp-sidebar-title">Selected Preview</h4>
            </div>

            <div className="csp-sidebar-content">
              {selectedAsset ? (
                <div style={{ width: '100%' }}>
                  {/* Visual Preview Frame */}
                  <div className="csp-preview-frame">
                    {(() => {
                      const isPlaylist = 'zones' in selectedAsset;
                      if (isPlaylist) {
                        return (
                          <div className="csp-preview-empty">
                            <FolderHeart size={40} className="csp-indigo" />
                            <span style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Playlist</span>
                          </div>
                        );
                      }

                      const asset = selectedAsset as ContentAsset;
                      let thumb = asset.thumbLink || '';
                      if (asset.contentType === 'YOUTUBE') {
                        thumb = getYouTubeThumbnail(asset.permaLink);
                      }

                      if (asset.contentType === 'IMAGE' && (asset.permaLink || thumb)) {
                        return <img src={asset.permaLink || thumb} alt="" className="csp-preview-img" />;
                      }

                      if (asset.contentType === 'YOUTUBE' && thumb) {
                        return <img src={thumb} alt="" className="csp-preview-img" />;
                      }

                      if (asset.contentType === 'VIDEO' && asset.permaLink) {
                        return (
                          <video src={asset.permaLink} className="csp-preview-video" controls muted />
                        );
                      }

                      return (
                        <div className="csp-preview-empty">
                          <Globe size={32} />
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>{asset.contentType}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Info details */}
                  <div className="csp-info-grid">
                    <div className="csp-info-item">
                      <span className="csp-info-label">Title</span>
                      <span className="csp-info-value">{selectedAsset.name}</span>
                    </div>

                    {'zones' in selectedAsset ? (
                      <div className="csp-info-item">
                        <span className="csp-info-label">Zones count</span>
                        <span className="csp-info-value">{(selectedAsset as PlaylistAsset).zones?.length || 0} zone(s)</span>
                      </div>
                    ) : (
                      <>
                        <div className="csp-info-item">
                          <span className="csp-info-label">Type</span>
                          <span className="csp-info-value" style={{ textTransform: 'capitalize' }}>
                            {(selectedAsset as ContentAsset).contentType?.toLowerCase()}
                          </span>
                        </div>
                        {(selectedAsset as ContentAsset).size && (
                          <div className="csp-info-item">
                            <span className="csp-info-label">Size</span>
                            <span className="csp-info-value">
                              {Math.round(((selectedAsset as ContentAsset).size || 0) / 1024)} KB
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="csp-preview-empty">
                  <div style={{
                    height: '48px', width: '48px', borderRadius: '50%',
                    border: '1px dashed var(--border)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem'
                  }}>
                    <ImageIcon size={20} style={{ opacity: 0.4 }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', maxWidth: '200px', margin: 0 }}>
                    Select any media asset or playlist from the list to see preview and details here.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="csp-footer">
          <button onClick={onClose} className="csp-btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedAsset}
            className="csp-btn-primary"
          >
            Select Asset
          </button>
        </div>

      </div>

      <style>{`
        .csp-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: csp-fadeIn 0.2s ease-out;
        }
        @keyframes csp-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .csp-container {
          background: var(--card-bg);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 1000px;
          height: 85vh;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: csp-zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes csp-zoomIn {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .csp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.02);
        }
        .csp-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }
        .csp-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.15rem;
        }
        .csp-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 0.35rem;
          border-radius: 8px;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .csp-close-btn:hover {
          background: var(--sidebar-hover);
          color: var(--text);
        }

        .csp-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        .csp-main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
          background: var(--card-bg);
        }

        .csp-toolbar {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          border-bottom: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.01);
        }
        .csp-search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .csp-search-icon {
          position: absolute;
          left: 0.85rem;
          color: var(--text-muted);
          pointer-events: none;
        }
        .csp-search-input {
          width: 100%;
          padding: 0.65rem 1rem 0.65rem 2.25rem;
          background: var(--sidebar-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 0.85rem;
          color: var(--text);
          outline: none;
          transition: border-color 0.15s;
        }
        .csp-search-input:focus {
          border-color: var(--accent);
        }
        .csp-tabs {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .csp-tabs::-webkit-scrollbar {
          display: none;
        }
        .csp-tab-btn {
          padding: 0.45rem 1rem;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 700;
          border: none;
          background: var(--sidebar-bg);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .csp-tab-btn:hover {
          color: var(--text);
          background: var(--sidebar-hover);
        }
        .csp-tab-btn.active {
          background: var(--accent);
          color: white;
        }

        .csp-list-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
        }
        .csp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 0.85rem;
        }
        .csp-card {
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--sidebar-bg);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          transition: all 0.15s;
        }
        .csp-card:hover {
          border-color: var(--accent);
          background: var(--sidebar-hover);
        }
        .csp-card.selected {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.08);
        }
        .csp-thumb-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
        }
        .csp-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .csp-icon-color {
          color: var(--accent);
        }
        .csp-video-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .csp-card-info {
          flex: 1;
          overflow: hidden;
        }
        .csp-card-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text);
          margin: 0;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
        .csp-card-meta {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 700;
          margin-top: 0.15rem;
          letter-spacing: 0.05em;
        }
        .csp-radio-indicator {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .csp-card.selected .csp-radio-indicator {
          border-color: var(--accent);
          background: var(--accent);
        }
        .csp-radio-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: white;
        }

        .csp-preview-sidebar {
          width: 320px;
          background: var(--sidebar-bg);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
        }
        .csp-sidebar-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .csp-sidebar-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .csp-sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .csp-preview-frame {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }
        .csp-preview-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .csp-preview-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .csp-preview-empty {
          text-align: center;
          color: var(--text-muted);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .csp-info-grid {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .csp-info-item {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .csp-info-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .csp-info-value {
          font-size: 0.8rem;
          color: var(--text);
          font-weight: 600;
          word-break: break-all;
        }

        .csp-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.02);
        }
        .csp-btn-secondary {
          background: var(--sidebar-bg);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 0.5rem 1.25rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .csp-btn-secondary:hover {
          background: var(--sidebar-hover);
        }
        .csp-btn-primary {
          background: var(--btn-cta-bg);
          color: var(--btn-cta-text);
          border: none;
          padding: 0.5rem 1.25rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: all 0.2s ease;
        }
        .csp-btn-primary:hover:not(:disabled) {
          background: var(--btn-cta-hover);
        }
        .csp-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .csp-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          color: var(--text-muted);
        }
        .csp-spin {
          animation: csp-spin-anim 1s linear infinite;
        }
        @keyframes csp-spin-anim {
          to { transform: rotate(360deg); }
        }
        .csp-indigo {
          color: var(--accent);
        }
        .csp-rose {
          color: #f43f5e;
        }
      `}</style>
    </div>
  );
};

export default ContentSelectPopup;
