import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PlaylistItem } from '@/types/playlist';

export function UrlInputModal({
  label, placeholder, contentType, initialUrl = '', editIndex, onAdd, onEdit, onClose
}: {
  label: string;
  placeholder: string;
  contentType: string;
  initialUrl?: string;
  editIndex?: number;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, url: string, name: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState('');

  function add() {
    if (!url.trim()) return;
    if (editIndex !== undefined) {
      onEdit(editIndex, url.trim(), name.trim() || label);
    } else {
      onAdd({
        id: `app_${Date.now()}`,
        name: name.trim() || label,
        thumbLink: '',
        duration: 15,
        contentType,
        permaLink: url.trim(),
      });
    }
    onClose();
  }

  let inputLabel = 'URL';
  let inputPlaceholder = placeholder;
  if (contentType === 'APP_INSTAGRAM') {
    inputLabel = 'Account Username';
    inputPlaceholder = 'e.g. instagram_username';
  } else if (contentType === 'APP_GOOGLE_CALENDAR') {
    inputLabel = 'Google Calendar Embed URL';
    inputPlaceholder = 'e.g. https://calendar.google.com/...';
  } else if (contentType === 'APP_CANVA_PUBLIC') {
    inputLabel = 'Canva Public View URL';
  } else if (contentType === 'APP_GOOGLE_SHEET') {
    inputLabel = 'Google Sheet URL';
  } else if (contentType === 'APP_GOOGLE_SLIDE') {
    inputLabel = 'Google Slide URL';
  } else if (contentType === 'APP_OUTLOOK_CALENDAR') {
    inputLabel = 'Outlook Calendar URL';
  } else if (contentType === 'APP_MICROSOFT_EXCEL') {
    inputLabel = 'Microsoft Excel URL';
  } else if (contentType === 'APP_MICROSOFT_POWERBI') {
    inputLabel = 'Power BI URL';
  } else if (contentType === 'APP_POSTER_MY_WALL') {
    inputLabel = 'PosterMyWall Design URL';
    inputPlaceholder = 'e.g. https://www.postermywall.com/...';
  }

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="pl-modal-hd">
          <h3>Add {label}</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pl-modal-bd" style={{ gap: 14 }}>
          <div>
            <p className="pl-label">Label (optional)</p>
            <input className="pl-input" value={name} onChange={e => setName(e.target.value)} placeholder={`e.g. My ${label}`} />
          </div>
          <div>
            <p className="pl-label">{inputLabel}</p>
            <input className="pl-input" value={url} onChange={e => setUrl(e.target.value)}
              placeholder={inputPlaceholder} onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
          </div>
        </div>
        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={add} disabled={!url.trim()}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
