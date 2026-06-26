import React, { useState } from 'react';
import { X, Globe } from 'lucide-react';
import { PreviewTVBezel } from './PreviewTVBezel';
import { PlaylistItem } from '@/types/playlist';

function extractIframeSrc(code: string): string {
  if (!code) return '';
  if (code.startsWith('http')) return code;
  if (code.includes('<iframe')) {
    const srcMatch = code.match(/src=["'](.*?)["']/);
    if (srcMatch && srcMatch[1]) return srcMatch[1];
  }
  return code;
}

function BaseIframeModal({
  title, inputLabel, inputPlaceholder, contentType, validator, embedTransformer,
  editIndex, initialData, onAdd, onEdit, onClose
}: {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  contentType: string;
  validator?: (url: string) => boolean;
  embedTransformer?: (url: string) => string;
  editIndex?: number;
  initialData?: any;
  onAdd: (item: PlaylistItem) => void;
  onEdit: (idx: number, item: PlaylistItem) => void;
  onClose: () => void;
}) {
  const initialInput = initialData?.embedCode || initialData?.url || initialData?.permaLink || '';
  const [inputVal, setInputVal] = useState(initialInput);
  const [name, setName] = useState(initialData?.name || initialData?.title || '');
  
  const extractedUrl = extractIframeSrc(inputVal);
  const isValid = validator ? validator(extractedUrl) : true;
  const iframeUrl = (isValid && extractedUrl) ? (embedTransformer ? embedTransformer(extractedUrl) : extractedUrl) : '';

  function save() {
    if (!inputVal.trim() || !isValid || !iframeUrl) return;
    const item: PlaylistItem = {
      id: `app_${Date.now()}`,
      name: name.trim() || title,
      thumbLink: '',
      duration: 15,
      contentType,
      permaLink: iframeUrl,
      metadata: { embedCode: inputVal, url: iframeUrl, permaLink: iframeUrl }
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
          <h3>Configure {title}</h3>
          <button className="pl-modal-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pl-modal-bd" style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 24, padding: '20px' }}>
          {/* Left Controls */}
          <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="pl-label">Label (optional)</p>
              <input className="pl-input" value={name} onChange={e => setName(e.target.value)} placeholder={`e.g. My ${title}`} autoFocus />
            </div>
            <div>
              <p className="pl-label">{inputLabel}</p>
              <textarea className="pl-input" style={{ minHeight: '120px', resize: 'vertical' }} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder={inputPlaceholder} />
              {!isValid && inputVal.length > 0 && (
                <p style={{ color: '#e74c3c', fontSize: '0.75rem', marginTop: '4px' }}>Please enter a valid URL or embed code.</p>
              )}
            </div>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}><strong>Note:</strong> Paste the share URL or iframe embed code. The preview will automatically render on the right once a valid link is detected.</p>
            </div>
          </div>

          {/* Right Preview - LED TV Style */}
          <PreviewTVBezel>
            {iframeUrl ? (
              <iframe
                width="100%"
                height="100%"
                src={iframeUrl}
                title={`${title} Preview`}
                frameBorder="0"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              ></iframe>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '50%', marginBottom: '16px' }}>
                  <Globe size={48} strokeWidth={1.5} />
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Enter a valid URL to see preview</p>
              </div>
            )}
          </PreviewTVBezel>
        </div>
        <div className="pl-modal-ft">
          <button className="pl-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pl-btn-primary" onClick={save} disabled={!inputVal.trim() || !isValid || !iframeUrl}>
            {editIndex !== undefined ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GoogleSlideAppModal(props: any) {
  return <BaseIframeModal 
    {...props} 
    title="Google Slide" 
    inputLabel="Google Slide URL or Embed Code" 
    inputPlaceholder="https://docs.google.com/presentation/d/..." 
    contentType="APP_GOOGLE_SLIDE" 
    validator={url => url.includes('docs.google.com/presentation')}
    embedTransformer={url => url.replace(/\/edit.*$/, '/embed?start=true&loop=true&delayms=3000')}
  />;
}

export function MicrosoftExcelAppModal(props: any) {
  return <BaseIframeModal 
    {...props} 
    title="Microsoft Excel" 
    inputLabel="Excel Embed URL or Code" 
    inputPlaceholder="https://onedrive.live.com/embed?..." 
    contentType="APP_MICROSOFT_EXCEL" 
    validator={url => url.includes('live.com') || url.includes('sharepoint.com')}
  />;
}

export function MicrosoftPowerBiAppModal(props: any) {
  return <BaseIframeModal 
    {...props} 
    title="Microsoft Power BI" 
    inputLabel="Power BI Report URL or Embed Code" 
    inputPlaceholder="https://app.powerbi.com/view?..." 
    contentType="APP_MICROSOFT_POWERBI" 
    validator={url => url.includes('powerbi.com')}
  />;
}

export function OutlookCalendarAppModal(props: any) {
  return <BaseIframeModal 
    {...props} 
    title="Outlook Calendar" 
    inputLabel="Outlook HTML Link or Embed Code" 
    inputPlaceholder="https://outlook.live.com/owa/calendar/..." 
    contentType="APP_OUTLOOK_CALENDAR" 
    validator={url => url.includes('outlook')}
  />;
}

export function PosterMyWallAppModal(props: any) {
  return <BaseIframeModal 
    {...props} 
    title="PosterMyWall" 
    inputLabel="PosterMyWall Published URL or Embed Code" 
    inputPlaceholder="https://www.postermywall.com/index.php/posterbuilder/view/..." 
    contentType="APP_POSTER_MY_WALL" 
    validator={url => url.includes('postermywall.com')}
  />;
}

export function WebsiteAppModal(props: any) {
  return <BaseIframeModal 
    {...props} 
    title="Website" 
    inputLabel="Website URL" 
    inputPlaceholder="https://www.example.com" 
    contentType="APP_HTML" 
    validator={url => url.startsWith('http')}
  />;
}

function transformCalendarUrl(url: string, title?: string): string {
  try {
    let calendarId = '';
    if (url.includes('src=')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      calendarId = urlParams.get('src') || '';
    } else if (url.includes('calendar/embed')) {
      const urlObj = new URL(url);
      calendarId = urlObj.searchParams.get('src') || '';
    } else if (url.includes('calendar/u/0/r')) {
      const urlParams = new URL(url).searchParams;
      calendarId = urlParams.get('cid') || '';
    } else {
      calendarId = url;
    }
    if (!calendarId) return url;

    const baseUrl = 'https://calendar.google.com/calendar/embed';
    const params = new URLSearchParams();
    params.set('src', calendarId);
    params.set('hl', 'en');
    params.set('wkst', '1');
    params.set('ctz', 'UTC');
    params.set('mode', 'AGENDA');
    params.set('bgcolor', '#ffffff');
    params.set('color', '#2952a3');
    params.set('showTitle', '1');
    params.set('showNav', '1');
    params.set('showDate', '1');
    params.set('showPrint', '0');
    params.set('showTabs', '0');
    params.set('showCalendars', '1');
    params.set('showTz', '1');
    if (title) {
      params.set('title', title);
    }
    return `${baseUrl}?${params.toString()}`;
  } catch {
    return url;
  }
}

export function GoogleCalendarAppModal(props: any) {
  return <BaseIframeModal 
    {...props} 
    title="Google Calendar" 
    inputLabel="Calendar ID, Embed URL or Public Link" 
    inputPlaceholder="e.g. c_123456@group.calendar.google.com" 
    contentType="APP_GOOGLE_CALENDAR" 
    embedTransformer={url => transformCalendarUrl(url, props.initialData?.name)}
  />;
}
