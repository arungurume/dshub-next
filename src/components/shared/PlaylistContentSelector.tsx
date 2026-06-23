'use client';

import React, { useState } from 'react';
import { Search, X, Image as ImageIcon, Video, Globe, Grid } from 'lucide-react';
import { useTranslation } from '@/context/TranslateContext';

interface ContentItem {
  id: string | number;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'WEBSITE' | 'APP';
  url: string;
}

interface PlaylistContentSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: ContentItem) => void;
}

export const PlaylistContentSelector: React.FC<PlaylistContentSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'IMAGE' | 'VIDEO' | 'WEBSITE' | 'APP'>('ALL');

  if (!isOpen) return null;

  // Mock list for placeholder
  const mockContentItems: ContentItem[] = [
    { id: 1, name: 'Store Promo Poster', type: 'IMAGE', url: '/placeholder.jpg' },
    { id: 2, name: 'Hero Video Loop', type: 'VIDEO', url: '/placeholder.mp4' },
    { id: 3, name: 'Live Dashboard Menu', type: 'WEBSITE', url: 'https://example.com' },
    { id: 4, name: 'Weather Forecast Widget', type: 'APP', url: '' },
  ];

  const filteredItems = mockContentItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'ALL' || item.type === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-lg font-display font-semibold tracking-wide text-foreground">
            Select Content for Playlist
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="p-5 flex flex-col gap-4 border-b border-white/5 bg-white/[0.01]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search content by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['ALL', 'IMAGE', 'VIDEO', 'WEBSITE', 'APP'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="glass-card p-4 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-white/[0.02] flex items-center gap-4 transition-all duration-200"
              >
                <div className="h-12 w-12 rounded-lg bg-black/40 flex items-center justify-center text-primary/80 shrink-0">
                  {item.type === 'IMAGE' && <ImageIcon size={20} />}
                  {item.type === 'VIDEO' && <Video size={20} />}
                  {item.type === 'WEBSITE' && <Globe size={20} />}
                  {item.type === 'APP' && <Grid size={20} />}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.type.toLowerCase()}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">No items found matching criteria</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
export default PlaylistContentSelector;
