'use client';

import React, { useState, useEffect } from 'react';

interface TransitionSettings {
  type: 'NONE' | 'SLIDE' | 'FADE' | 'ZOOM' | 'ROTATE' | 'FLIP';
  speed: 'SLOW' | 'MEDIUM' | 'FAST';
}

interface TransitionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TransitionSettings;
  onSave: (settings: TransitionSettings) => void;
}

const TRANSITIONS = [
  { value: 'SLIDE', label: 'Slide In Right' },
  { value: 'FADE', label: 'Fade In' },
  { value: 'ROTATE', label: 'Rotate In' },
  { value: 'ZOOM', label: 'Zoom In' },
  { value: 'FLIP', label: 'Flip In' },
  { value: 'NONE', label: 'None (Instant)' },
] as const;

const SPEED_MAP = {
  SLOW: 800,
  MEDIUM: 400,
  FAST: 200,
} as const;

export const TransitionPopup: React.FC<TransitionPopupProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState<TransitionSettings>({ ...settings });

  // Update local settings if props change (e.g. when opened)
  useEffect(() => {
    if (isOpen) {
      setLocalSettings({ ...settings });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const speedIndex = localSettings.speed === 'SLOW' ? 0 : localSettings.speed === 'FAST' ? 2 : 1;
  const speedMs = SPEED_MAP[localSettings.speed];

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const speed: TransitionSettings['speed'] = val === 0 ? 'SLOW' : val === 2 ? 'FAST' : 'MEDIUM';
    setLocalSettings(prev => ({ ...prev, speed }));
  };

  const handleSave = () => {
    onSave(localSettings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Modal Card - pure white theme matching screenshot */}
      <div className="bg-white w-full max-w-[620px] rounded-[28px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-5">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">
            Transition Settings
          </h3>
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-slate-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              Save
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-8 pb-8 flex flex-col gap-8">
          {/* Card Grid */}
          <div className="grid grid-cols-3 gap-4">
            {TRANSITIONS.map((t) => {
              const isActive = localSettings.type === t.value;
              return (
                <PreviewCard
                  key={t.value}
                  type={t.value}
                  label={t.label}
                  isActive={isActive}
                  speedMs={speedMs}
                  onClick={() => setLocalSettings(prev => ({ ...prev, type: t.value }))}
                />
              );
            })}
          </div>

          {/* Speed Slider Section */}
          <div className="flex flex-col gap-3 mt-2 px-1">
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="2"
                step="1"
                value={speedIndex}
                onChange={handleSpeedChange}
                className="w-full h-[3px] bg-slate-200 rounded-lg appearance-none cursor-pointer outline-none accent-black"
                style={{
                  WebkitAppearance: 'none',
                }}
              />
              <style jsx>{`
                input[type='range']::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  background: #000;
                  cursor: pointer;
                  transition: transform 0.1s ease;
                }
                input[type='range']::-webkit-slider-thumb:hover {
                  transform: scale(1.2);
                }
              `}</style>
            </div>
            
            {/* Slider Labels */}
            <div className="flex justify-between text-[11px] font-bold tracking-wider text-slate-400 uppercase select-none">
              <span 
                onClick={() => setLocalSettings(prev => ({ ...prev, speed: 'SLOW' }))}
                className={`cursor-pointer transition-colors ${localSettings.speed === 'SLOW' ? 'text-slate-900 font-extrabold' : ''}`}
              >
                SLOW
              </span>
              <span 
                onClick={() => setLocalSettings(prev => ({ ...prev, speed: 'MEDIUM' }))}
                className={`cursor-pointer transition-colors ${localSettings.speed === 'MEDIUM' ? 'text-slate-900 font-extrabold' : ''}`}
              >
                MEDIUM
              </span>
              <span 
                onClick={() => setLocalSettings(prev => ({ ...prev, speed: 'FAST' }))}
                className={`cursor-pointer transition-colors ${localSettings.speed === 'FAST' ? 'text-slate-900 font-extrabold' : ''}`}
              >
                FAST
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// ── Helper Component for Transition Preview Card ─────────────────────────────
interface PreviewCardProps {
  type: TransitionSettings['type'];
  label: string;
  isActive: boolean;
  speedMs: number;
  onClick: () => void;
}

const PreviewCard: React.FC<PreviewCardProps> = ({
  type,
  label,
  isActive,
  speedMs,
  onClick,
}) => {
  const [animKey, setAnimKey] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Trigger preview animation when card becomes active or is hovered
  const triggerAnimation = () => {
    setAnimKey(k => k + 1);
  };

  useEffect(() => {
    if (isActive) {
      triggerAnimation();
    }
  }, [isActive]);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => {
        setIsHovered(true);
        triggerAnimation();
      }}
      onMouseLeave={() => setIsHovered(false)}
      className={`group flex flex-col border rounded-[20px] p-2 bg-white transition-all cursor-pointer text-center outline-none ${
        isActive
          ? 'border-2 border-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
          : 'border-slate-200/80 hover:border-slate-350 hover:shadow-[0_2px_10px_rgba(0,0,0,0.03)]'
      }`}
    >
      <div className="relative overflow-hidden w-full aspect-[4/3] rounded-[12px] bg-slate-50 flex items-center justify-center border border-slate-100">
        {type === 'NONE' ? (
          <div className="text-[11px] text-slate-400 font-bold tracking-wide uppercase select-none">
            No transition
          </div>
        ) : (
          <img
            key={animKey}
            src="/images/burger-menu-preview.png"
            alt={label}
            className={`w-full h-full object-cover rounded-lg ${
              isActive || isHovered ? `pl-anim-${type.toLowerCase()}` : ''
            }`}
            style={{
              animationDuration: `${speedMs}ms`,
            }}
          />
        )}
      </div>
      <span className="text-[13px] font-bold text-slate-800 pt-2.5 pb-1 block select-none">
        {label}
      </span>
    </button>
  );
};

export default TransitionPopup;
