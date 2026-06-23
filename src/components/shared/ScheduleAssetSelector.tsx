'use client';

import React, { useState } from 'react';
import { Search, X, FolderHeart, FileVideo } from 'lucide-react';
import { useTranslation } from '@/context/TranslateContext';

interface AssetOption {
  id: string | number;
  name: string;
  type: 'PLAYLIST' | 'CONTENT';
  detail: string;
}

interface ScheduleAssetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: AssetOption) => void;
}

export const ScheduleAssetSelector: React.FC<ScheduleAssetSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'PLAYLIST' | 'CONTENT'>('PLAYLIST');

  if (!isOpen) return null;

  // Mock list
  const mockPlaylists: AssetOption[] = [
    { id: 101, name: 'Default Store Loop', type: 'PLAYLIST', detail: '3 items • 60s total' },
    { id: 102, name: 'Lunch Special Display', type: 'PLAYLIST', detail: '5 items • 150s total' },
  ];

  const mockContent: AssetOption[] = [
    { id: 1, name: 'Holiday Hours Banner', type: 'CONTENT', detail: 'Image' },
    { id: 2, name: 'Winter Video Promo', type: 'CONTENT', detail: 'Video' },
  ];

  const activeOptions = selectedCategory === 'PLAYLIST' ? mockPlaylists : mockContent;

  const filteredOptions = activeOptions.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-lg font-display font-semibold tracking-wide text-foreground">
            Select Schedule Target Asset
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/5 bg-black/20">
          <button
            onClick={() => { setSelectedCategory('PLAYLIST'); setSearchQuery(''); }}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${
              selectedCategory === 'PLAYLIST'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => { setSelectedCategory('CONTENT'); setSearchQuery(''); }}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${
              selectedCategory === 'CONTENT'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Single Content
          </button>
        </div>

        {/* Search */}
        <div className="p-5 border-b border-white/5 bg-white/[0.01]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder={`Search ${selectedCategory.toLowerCase()}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="glass-card p-4 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-white/[0.02] flex items-center justify-between transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-black/40 flex items-center justify-center text-primary/80 shrink-0">
                    {item.type === 'PLAYLIST' ? <FolderHeart size={18} /> : <FileVideo size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">No items found matching query</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
export default ScheduleAssetSelector;
