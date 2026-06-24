'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Monitor, ArrowLeft, Wifi, CheckCircle2, RefreshCw,
  Tv2, Smartphone, Globe, Tv, LayoutPanelTop, LayoutPanelLeft,
  X, Calendar, ChevronDown, MapPin, AlertCircle, Image as ImageIcon, Lock,
} from 'lucide-react';
import { cmsApi, cmsApiV2 } from '@/lib/api';
import { ContentSelectPopup } from '@/components/shared/ContentSelectPopup';

// ─── Real download URLs from Angular i18n ─────────────────────────────────────

const PLAYERS = [
  {
    id: 'firetv',
    label: 'Amazon Firestick',
    icon: Tv2,
    deviceType: 2,
    instructionHtml: `Open the FireTV DSHub Player app and input the code below.<br/><a href="https://www.amazon.ca/dp/B0F7Y9Q598" target="_blank" rel="noopener noreferrer" class="instr-link">Download it from Amazon ↗</a>`,
    steps: [
      'Search "DShub Player" in the Amazon App Store',
      'Install and launch on your Fire TV Stick or Cube',
      'A 6-character pair code will appear on your TV',
      'Enter that code below to pair',
    ],
  },
  {
    id: 'android',
    label: 'Android & Chromecast',
    icon: Smartphone,
    deviceType: 1,
    instructionHtml: `Open the Android or Chromecast DSHub Player app and input the code below.<br/><a href="https://play.google.com/store/apps/details?id=com.dshub.signage&hl=en" target="_blank" rel="noopener noreferrer" class="instr-link">Get it on Google Play ↗</a>`,
    steps: [
      'Download "DShub Player" from the Google Play Store',
      'Launch the app on your Android device or Chromecast',
      'Note the 6-character pair code shown on screen',
      'Enter that code below to pair',
    ],
  },
  {
    id: 'web',
    label: 'Web & TV Browser',
    icon: Globe,
    deviceType: 3,
    instructionHtml: `Open the DSHub Web Player in your browser and input the code below.<br/><a href="https://player.digitalsigns.ai/#/" target="_blank" rel="noopener noreferrer" class="instr-link">Go to DShub Web Player ↗</a>`,
    steps: [
      'Open https://player.digitalsigns.ai in the target browser',
      'A 6-character pair code will appear',
      'Enter that code below to pair your display',
      'Keep the tab open and in fullscreen mode',
    ],
  },
];

// ─── Combobox (searchable dropdown) ──────────────────────────────────────────

function Combobox({
  items,
  selected,
  onSelect,
  placeholder,
  id,
  disabled,
}: {
  items: { id: number; name: string }[];
  selected: { id: number; name: string };
  onSelect: (item: { id: number; name: string }) => void;
  placeholder: string;
  id: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync query when selected changes externally
  useEffect(() => {
    if (selected.id !== 0) setQuery(selected.name);
    else setQuery('');
  }, [selected]);

  const filtered = query.trim()
    ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : items;

  function highlight(text: string) {
    if (!query.trim()) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  function clear() {
    setQuery('');
    onSelect({ id: 0, name: 'None' });
    setOpen(false);
  }

  return (
    <div className="combobox" ref={ref}>
      <div className="combobox-input-wrap">
        <input
          id={id}
          className={`combobox-input ${disabled ? 'disabled' : ''}`}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {selected.id !== 0 && (
          <button className="combobox-clear" onClick={clear} tabIndex={-1}><X size={12} /></button>
        )}
        {selected.id !== 0 && (
          <span className="combobox-pill">{selected.name}</span>
        )}
      </div>
      {open && !disabled && (
        <div className="combobox-dropdown">
          {filtered.length === 0 ? (
            <div className="combo-empty">No results for "{query}"</div>
          ) : filtered.map(item => (
            <div
              key={item.id}
              className={`combo-item ${item.id === selected.id ? 'combo-active' : ''}`}
              onMouseDown={() => { onSelect(item); setQuery(item.id === 0 ? '' : item.name); setOpen(false); }}
              dangerouslySetInnerHTML={{ __html: highlight(item.name) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PairScreenPage() {
  const router = useRouter();
  const pairCodeRef = useRef<HTMLInputElement>(null);

  // Plan / entitlement
  const [canCreate, setCanCreate] = useState(true);
  const [planMessage, setPlanMessage] = useState('');

  // Player selection
  const [selectedPlayer, setSelectedPlayer] = useState<typeof PLAYERS[0] | null>(null);

  // Form state — mirrors screen_object from Angular
  const [pairCode, setPairCode] = useState('');
  const [screenName, setScreenName] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [placedAt, setPlacedAt] = useState('');
  const [defaultShowAssetType, setDefaultShowAssetType] = useState<'NONE' | 'MEDIA' | 'PLAYLIST'>('NONE');
  const [defaultShowAssetId, setDefaultShowAssetId] = useState<string | number>('');
  const [defaultShowAssetName, setDefaultShowAssetName] = useState<string>('');
  const [showContentSelect, setShowContentSelect] = useState(false);
  const [selectedTag, setSelectedTag] = useState({ id: 0, name: 'None' });
  const [selectedSchedule, setSelectedSchedule] = useState({ id: 0, name: 'None' });

  // Validation — mirrors validateScreenName() / validatePairCode()
  const [validationMsg, setValidationMsg] = useState('');

  // Data
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [schedules, setSchedules] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Load plan, tags, schedules on mount
  useEffect(() => {
    cmsApiV2.get('/sac/my/plan').then(({ data }) => {
      const canMake = data.canCreateScreen ?? true;
      setCanCreate(canMake);

      if (data.subscription) {
        const sub = data.subscription;
        if (sub.subscriptionType === 'TRIAL_PLAN') {
          const end = new Date(sub.currentPeriodEnd);
          const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
          setPlanMessage(days > 0 ? `Trial ends in ${days} day(s)` : 'Trial ended');
        } else {
          setPlanMessage(`Current Plan: ${sub.subscriptionType}`);
        }
      }

      if (!canMake) {
        setPlanMessage('You have reached your screen limit. Please upgrade your plan to add more screens.');
      }
    }).catch(() => {});

    cmsApi.get('/sc/screen-group', {
      params: { page: 0, size: 500, sortBy: 'updatedDate', sortOrder: 'DESC' },
    }).then(({ data }) => {
      setTags([{ id: 0, name: 'None' }, ...(data.content || [])]);
    }).catch(() => {});

    cmsApiV2.get('/scc/schedule', {
      params: { page: 0, size: 500, sortBy: 'updatedDate', sortOrder: 'DESC' },
    }).then(({ data }) => {
      setSchedules([{ id: 0, name: 'None' }, ...(data.content || [])]);
    }).catch(() => {});
  }, []);

  // selectPlayer — mirrors Angular selectPlayer(), clears pair code, focuses input
  function selectPlayer(player: typeof PLAYERS[0]) {
    setSelectedPlayer(player);
    setPairCode('');
    setValidationMsg('');
    setTimeout(() => pairCodeRef.current?.focus(), 100);
  }

  // forceUpperCase — mirrors Angular (input) handler
  function handlePairCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPairCode(e.target.value.toUpperCase());
    if (validationMsg) setValidationMsg('');
  }

  // validateScreenName() — exact mirror
  function validateScreenName(): boolean {
    if (!screenName.trim()) {
      setValidationMsg('Please provide screen name');
      return false;
    }
    setValidationMsg('');
    return true;
  }

  // validatePairCode() — exact mirror (only for new screen)
  function validatePairCode(): boolean {
    if (!pairCode.trim()) {
      setValidationMsg('Please provide screen pair code');
      return false;
    }
    setValidationMsg('');
    return true;
  }

  // Handle selected content/playlist from popup
  function handleContentSelect(selected: any) {
    if (selected) {
      setDefaultShowAssetType(selected.assetType);
      setDefaultShowAssetId(selected.asset.id);
      setDefaultShowAssetName(selected.asset.name);
    }
    setShowContentSelect(false);
  }

  // addSaveUpdateScrn() — exact mirror of Angular submit
  async function handleSave() {
    if (!canCreate) return;

    // Run validations in order (name first, then pair code)
    if (!validateScreenName()) return;
    if (!validatePairCode()) return;

    setSaving(true);
    try {
      const payload = {
        name: screenName.trim(),
        pairCode: pairCode.trim().toUpperCase(),
        orientation,
        placedAt: placedAt.trim(),
        screenGroupId: selectedTag.id,
        selectedScheduleId: selectedSchedule.id,
        defaultShowAssetType,
        defaultShowAssetId: defaultShowAssetId ? String(defaultShowAssetId) : '',
        defaultShowAssetName: defaultShowAssetName || '',
      };

      const { data } = await cmsApi.put('/sc/screen-pair-request', payload);

      if (data?.id) {
        if (defaultShowAssetType !== 'NONE') {
          toast.success('Initiated content assignment process. Please wait for the screen to update.');
        } else {
          toast.success('Screen created successfully!');
        }
        router.push('/screens');
      } else {
        toast.error('Failed to pair screen. Check the pair code and try again.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid pair code or screen limit reached';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const isDisabled = !canCreate;

  return (
    <div className="pair-page">
      {/* Header bar */}
      <div className="header-bar">
        <div className="header-left">
          <button className="back-btn" onClick={() => router.push('/screens')} id="back-btn">
            <ArrowLeft size={15} />
          </button>
          <h4>{selectedPlayer ? 'Add Your Screen' : 'Pair New Screen'}</h4>
        </div>
        <div className="header-right">
          <button
            className="save-btn-top"
            onClick={handleSave}
            disabled={isDisabled || saving}
            id="save-screen-btn"
          >
            {saving ? <RefreshCw size={14} className="spin" /> : null}
            Save
          </button>
        </div>
      </div>

      {/* Plan status alert — mirrors Angular planStatusMessage */}
      {planMessage && (
        <div className={`plan-alert ${!canCreate ? 'plan-alert-warn' : 'plan-alert-info'}`}>
          <div className="plan-alert-left">
            <AlertCircle size={15} />
            <span>{planMessage}</span>
          </div>
          {!canCreate && (
            <a href="/billing" className="upgrade-btn">Upgrade</a>
          )}
        </div>
      )}

      {/* Validation message — mirrors Angular validationMessage */}
      {validationMsg && (
        <div className="validation-alert">
          <AlertCircle size={14} />
          {validationMsg}
        </div>
      )}

      <div className="content-block">
        <div className="orientation-screen">
          {/* ── LEFT COLUMN ── */}
          <div className="left-col">

            {/* Player selection — only in add mode */}
            <div className="section">
              <label className="section-label">Select Player</label>
              <div className={`player-row ${isDisabled ? 'player-disabled' : ''}`}>
                {PLAYERS.map(p => {
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.id}
                      className={`player-opt ${selectedPlayer?.id === p.id ? 'player-selected' : ''} ${isDisabled ? '' : 'player-clickable'}`}
                      onClick={() => !isDisabled && selectPlayer(p)}
                      id={`player-${p.id}`}
                    >
                      <div className="player-ico"><Icon size={28} /></div>
                      <p>{p.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Instructions below player selection — mirrors Angular [innerHTML]="instructions" */}
              {selectedPlayer && (
                <div
                  className="instructions-block"
                  dangerouslySetInnerHTML={{ __html: selectedPlayer.instructionHtml }}
                />
              )}
            </div>

            {/* Pair Code — locked until a player is selected */}
            <div className="form-ctrl">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Pair Code
                {!selectedPlayer && <Lock size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={pairCodeRef}
                  id="pair-code-input"
                  type="text"
                  maxLength={6}
                  className={`pair-code-field ${(isDisabled || !selectedPlayer) ? 'field-disabled pair-code-locked' : ''}`}
                  placeholder={selectedPlayer ? 'Enter Pair Code' : 'Select a player first'}
                  value={pairCode}
                  onChange={handlePairCodeChange}
                  disabled={isDisabled || !selectedPlayer}
                />
                {!selectedPlayer && (
                  <div style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', opacity: 0.5, pointerEvents: 'none',
                  }}>
                    <Lock size={18} />
                  </div>
                )}
              </div>
              {!selectedPlayer && (
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                  👆 Select a player type above to unlock this field
                </p>
              )}
            </div>

            {/* Screen Name */}
            <div className="form-ctrl">
              <label>Screen Name</label>
              <input
                id="screen-name-input"
                type="text"
                className={`form-field ${isDisabled ? 'field-disabled' : ''}`}
                placeholder="Enter Screen Name"
                value={screenName}
                onChange={e => { setScreenName(e.target.value); if (validationMsg) setValidationMsg(''); }}
                disabled={isDisabled}
              />
            </div>

            {/* Screen Orientation */}
            <div className="form-ctrl">
              <label className="orient-lbl">Select Screen Orientation</label>
              <div className={`orient-radio ${orientation === 'vertical' ? 'vertical-active' : ''} ${isDisabled ? 'orient-disabled' : ''}`}>
                <div
                  className={`radio-btn ${orientation === 'horizontal' ? 'selected' : ''}`}
                  onClick={() => !isDisabled && setOrientation('horizontal')}
                  id="orient-horizontal"
                >
                  <LayoutPanelTop size={15} /> Horizontal
                </div>
                <div
                  className={`radio-btn ${orientation === 'vertical' ? 'selected' : ''}`}
                  onClick={() => !isDisabled && setOrientation('vertical')}
                  id="orient-vertical"
                >
                  <LayoutPanelLeft size={15} /> Vertical
                </div>
              </div>
            </div>

            {/* Placed At */}
            <div className="form-ctrl">
              <label>Placed At</label>
              <input
                id="placed-at-input"
                type="text"
                className={`form-field ${isDisabled ? 'field-disabled' : ''}`}
                placeholder="Lobby"
                value={placedAt}
                onChange={e => setPlacedAt(e.target.value)}
                disabled={isDisabled}
              />
            </div>

            {/* Default Content — mirrors Angular content-buttons */}
            <div className="form-ctrl">
              <label>Default Content</label>
              <div className={`content-btns ${defaultShowAssetType === 'NONE' ? 'none-active' : 'media-active'} ${isDisabled ? 'orient-disabled' : ''}`}>
                <div
                  className={`radio-btn ${defaultShowAssetType === 'NONE' ? 'selected' : ''}`}
                  onClick={() => {
                    if (!isDisabled) {
                      setDefaultShowAssetType('NONE');
                      setDefaultShowAssetId('');
                      setDefaultShowAssetName('');
                    }
                  }}
                  id="content-none"
                >
                  None
                </div>
                <div
                  className={`radio-btn ${defaultShowAssetType !== 'NONE' ? 'selected' : ''}`}
                  onClick={() => !isDisabled && setShowContentSelect(true)}
                  id="content-media"
                >
                  Media/Playlist
                </div>
              </div>

              {defaultShowAssetType !== 'NONE' && defaultShowAssetName && (
                <div className="selected-asset-display">
                  <div className="selected-asset-info">
                    <span className="selected-asset-label">
                      Selected {defaultShowAssetType === 'PLAYLIST' ? 'Playlist' : 'Media'}:
                    </span>
                    <span className="selected-asset-name">
                      {defaultShowAssetName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => !isDisabled && setShowContentSelect(true)}
                    className="change-asset-btn"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Schedule — combobox with search + highlight */}
            <div className="form-ctrl">
              <label>Schedule:</label>
              <Combobox
                id="schedule-search"
                items={schedules}
                selected={selectedSchedule}
                onSelect={setSelectedSchedule}
                placeholder="Search or select a schedule"
                disabled={isDisabled}
              />
            </div>

          </div>

          {/* ── RIGHT COLUMN — preview ── */}
          <div className="right-col">
            <div className={`screen-preview-frame ${orientation}`}>
              <ImageIcon size={40} opacity={0.2} />
              <span className="preview-hint">
                {orientation === 'horizontal' ? '1920×1080' : '1080×1920'}
              </span>
              <span className="preview-subhint">Displays after screen is added</span>
            </div>

            {/* Player steps */}
            {selectedPlayer && (
              <div className="step-list">
                {selectedPlayer.steps.map((step, i) => (
                  <div key={i} className="step-row">
                    <span className="step-num">{i + 1}</span>
                    <span className="step-text">{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ContentSelectPopup
        isOpen={showContentSelect}
        onClose={() => setShowContentSelect(false)}
        onSelect={handleContentSelect}
        initialSelectedId={defaultShowAssetId}
      />

      <style>{`
        .pair-page { padding: 0; }

        /* Header bar — mirrors Angular header-bar */
        .header-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 2rem; border-bottom: 1px solid var(--border);
          background: var(--card-bg);
        }
        .header-left { display: flex; align-items: center; gap: .75rem; }
        .back-btn {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--sidebar-bg);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-muted);
        }
        .back-btn:hover { border-color: var(--accent); color: var(--accent); }
        .header-left h4 { font-size: 1rem; font-weight: 700; margin: 0; }
        .save-btn-top {
          display: inline-flex; align-items: center; gap: .4rem;
          background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none;
          padding: .55rem 1.5rem; border-radius: 12px;
          font-size: .875rem; font-weight: 700; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease;
        }
        .save-btn-top:hover:not(:disabled) { background: var(--btn-cta-hover); }
        .save-btn-top:disabled { opacity: .5; cursor: not-allowed; }

        /* Alerts */
        .plan-alert {
          display: flex; align-items: center; justify-content: space-between;
          padding: .75rem 2rem; font-size: .85rem; gap: 1rem;
        }
        .plan-alert-info { background: #eff6ff; color: #1e40af; }
        .plan-alert-warn { background: #fef3c7; color: #92400e; }
        .plan-alert-left { display: flex; align-items: center; gap: .5rem; }
        .upgrade-btn {
          background: var(--btn-cta-bg); color: var(--btn-cta-text); border: none;
          padding: .35rem .85rem; border-radius: 8px;
          font-size: .78rem; font-weight: 700; cursor: pointer;
          text-decoration: none; white-space: nowrap; transition: background 0.2s ease;
        }
        .upgrade-btn:hover { background: var(--btn-cta-hover); }
        .validation-alert {
          display: flex; align-items: center; gap: .5rem;
          margin: .75rem 2rem 0;
          background: #fee2e2; color: #991b1b;
          padding: .65rem 1rem; border-radius: 8px;
          font-size: .85rem; font-weight: 500;
        }

        /* Main layout */
        .content-block { padding: 1.5rem 2rem; }
        .orientation-screen { display: grid; grid-template-columns: 480px 1fr; gap: 2rem; }

        /* Left column */
        .left-col { display: flex; flex-direction: column; gap: 1.25rem; }
        .section { }
        .section-label {
          display: block; font-size: .8rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: .05em;
          color: var(--text-muted); margin-bottom: .65rem;
        }

        /* Player row */
        .player-row { display: flex; gap: .75rem; margin-bottom: .75rem; }
        .player-disabled { opacity: .5; pointer-events: none; }
        .player-opt {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: .5rem;
          padding: 1rem .5rem; border: 2px solid var(--border);
          border-radius: 12px; background: var(--card-bg); text-align: center;
          transition: all .15s;
        }
        .player-clickable { cursor: pointer; }
        .player-clickable:hover { border-color: var(--accent); }
        .player-selected { border-color: var(--accent) !important; background: rgba(99,102,241,.08) !important; }
        .player-ico { color: var(--accent); }
        .player-opt p { font-size: .72rem; font-weight: 600; margin: 0; color: var(--text); }

        /* Instructions block */
        .instructions-block {
          font-size: .82rem; color: var(--text-muted);
          background: rgba(99,102,241,.06); border-left: 3px solid var(--accent);
          padding: .75rem 1rem; border-radius: 0 8px 8px 0; line-height: 1.6;
        }
        .instructions-block :global(.instr-link) { color: var(--accent); font-weight: 600; text-decoration: none; }

        /* Form controls */
        .form-ctrl { display: flex; flex-direction: column; gap: .4rem; }
        .form-ctrl label {
          font-size: .8rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: var(--text-muted);
        }

        /* Pair code field */
        .pair-code-field {
          font-size: 1.6rem; font-weight: 800; letter-spacing: .2em;
          text-align: center; text-transform: uppercase;
          padding: .75rem 1rem;
          background: linear-gradient(135deg, rgba(99,102,241,.06), rgba(139,92,246,.06));
          border: 2px solid var(--accent); border-radius: 10px;
          color: var(--accent); outline: none; transition: box-shadow .15s;
          width: 100%; box-sizing: border-box;
        }
        .pair-code-field:focus { box-shadow: 0 0 0 4px rgba(99,102,241,.2); }
        .pair-code-field::placeholder { color: rgba(99,102,241,.25); font-size: 1rem; letter-spacing: .1em; }
        .pair-code-locked {
          border-color: var(--border) !important;
          background: var(--sidebar-bg) !important;
          color: var(--text-muted) !important;
          letter-spacing: .05em !important;
          font-size: 1rem !important;
          cursor: not-allowed;
        }

        /* Standard field */
        .form-field {
          padding: .65rem 1rem;
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; font-size: .9rem; color: var(--text);
          outline: none; transition: border-color .15s; width: 100%;
          box-sizing: border-box;
        }
        .form-field:focus { border-color: var(--accent); }
        .field-disabled { opacity: .45; cursor: not-allowed; }

        /* Orientation */
        .orient-lbl { }
        .orient-radio { display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .orient-disabled { opacity: .45; pointer-events: none; }
        .radio-btn {
          flex: 1; display: flex; align-items: center; justify-content: center;
          gap: .4rem; padding: .65rem .5rem; font-size: .85rem; font-weight: 600;
          cursor: pointer; color: var(--text-muted); transition: all .15s;
          border-right: 1px solid var(--border);
        }
        .radio-btn:last-child { border-right: none; }
        .radio-btn.selected {
          background: var(--accent); color: white;
        }
        .radio-btn:not(.selected):hover { background: var(--sidebar-hover); }

        /* Content type buttons */
        .content-btns { display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }

        .selected-asset-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: rgba(99, 102, 241, 0.06);
          border: 1px dashed rgba(99, 102, 241, 0.3);
          border-radius: 10px;
          margin-top: 0.5rem;
        }
        .selected-asset-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .selected-asset-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .selected-asset-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--accent);
          max-width: 260px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .change-asset-btn {
          background: rgba(99, 102, 241, 0.12);
          color: var(--accent);
          border: none;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .change-asset-btn:hover {
          background: rgba(99, 102, 241, 0.2);
        }

        /* Schedule combobox */
        .combobox { position: relative; }
        .combobox-input-wrap { position: relative; }
        .combobox-input {
          width: 100%; padding: .65rem 2rem .65rem 1rem;
          background: var(--sidebar-bg); border: 1px solid var(--border);
          border-radius: 10px; font-size: .875rem; color: var(--text);
          outline: none; box-sizing: border-box;
        }
        .combobox-input:focus { border-color: var(--accent); }
        .combobox-input.disabled { opacity: .45; cursor: not-allowed; }
        .combobox-clear {
          position: absolute; right: .65rem; top: 50%; transform: translateY(-50%);
          border: none; background: none; cursor: pointer;
          color: var(--text-muted); display: flex; align-items: center;
        }
        .combobox-pill {
          display: inline-block; background: rgba(99,102,241,.12);
          color: var(--accent); font-size: .72rem; font-weight: 700;
          padding: .15rem .5rem; border-radius: 5px;
          margin-top: .3rem;
        }
        .combobox-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,.2);
          z-index: 100; max-height: 200px; overflow-y: auto;
        }
        .combo-item {
          padding: .6rem 1rem; font-size: .875rem; cursor: pointer;
          color: var(--text); transition: background .1s;
        }
        .combo-item:hover, .combo-active { background: rgba(99,102,241,.08); }
        .combo-item mark { background: rgba(99,102,241,.2); color: var(--accent); border-radius: 2px; padding: 0 1px; }
        .combo-empty { padding: .65rem 1rem; font-size: .82rem; color: var(--text-muted); }

        /* Right column */
        .right-col { display: flex; flex-direction: column; gap: 1.5rem; align-items: center; padding-top: 1rem; }

        /* Screen preview frame */
        .screen-preview-frame {
          border: 2px dashed var(--border); border-radius: 12px;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: .5rem; color: var(--text-muted);
          background: var(--sidebar-bg); transition: all .3s;
        }
        .screen-preview-frame.horizontal { width: 320px; height: 180px; }
        .screen-preview-frame.vertical { width: 180px; height: 320px; }
        .preview-hint { font-size: .8rem; font-weight: 600; opacity: .5; }
        .preview-subhint { font-size: .7rem; opacity: .4; text-align: center; padding: 0 1rem; }

        /* Steps */
        .step-list { display: flex; flex-direction: column; gap: .85rem; max-width: 280px; width: 100%; }
        .step-row { display: flex; align-items: flex-start; gap: .65rem; }
        .step-num {
          width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
          background: var(--accent); color: white;
          font-size: .68rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          margin-top: 1px;
        }
        .step-text { font-size: .82rem; color: var(--text-muted); line-height: 1.5; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .orientation-screen { grid-template-columns: 1fr; }
          .right-col { align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
