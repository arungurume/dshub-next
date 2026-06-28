'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  CalendarRange, ChevronLeft, ChevronRight, Clock, Globe
} from 'lucide-react';
import CustomSelect from '@/components/shared/CustomSelect';

// ─── Types ────────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Common IANA timezones for the selector
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// Format a Date into HH:MM in a given timezone
function formatTime(date: Date, tz: string): string {
  try {
    return date.toLocaleTimeString('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

function formatDateInTz(date: Date, tz: string): string {
  try {
    return date.toLocaleDateString('en-GB', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function getTzOffset(tz: string): string {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = now.toLocaleString('en-US', { timeZone: tz });
    const diff = (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
    const sign = diff >= 0 ? '+' : '-';
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 60).toString().padStart(2, '0');
    const m = (abs % 60).toString().padStart(2, '0');
    return `UTC${sign}${h}:${m}`;
  } catch {
    return '';
  }
}

// Build a calendar grid for the given month/year in a timezone
function buildCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Pad start
  for (let i = 0; i < first.getDay(); i++) {
    days.push(new Date(year, month, -i));
  }
  days.reverse();

  // Month days
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Pad end to complete 6 weeks
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month + 1, d));
  }

  return days;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [primaryTz, setPrimaryTz] = useState('UTC');
  const [compareTz, setCompareTz] = useState('America/New_York');
  const [tick, setTick] = useState(Date.now());

  // Live clock — update every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const days = useMemo(() => buildCalendarDays(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);
  const currentMonthDays = days.filter(d => d.getMonth() === viewDate.getMonth());

  const timezoneOptions = useMemo(() => {
    return TIMEZONES.map(tz => ({
      value: tz,
      label: `${tz.replace(/_/g, ' ')} (${getTzOffset(tz)})`
    }));
  }, [tick]);

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToday() {
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  }

  const liveDate = new Date(tick);
  const isToday = (d: Date) => d.toDateString() === now.toDateString();
  const isSelected = (d: Date) => d.toDateString() === selectedDate.toDateString();
  const isCurrentMonth = (d: Date) => d.getMonth() === viewDate.getMonth();

  return (
    <div className="cal-page">
      <div className="cal-header">
        <div className="cal-title">
          <CalendarRange size={22} />
          <h1>Timezone Calendar</h1>
        </div>
        <p className="cal-subtitle">Timezone-aware schedule utility — preview display times across locations</p>
      </div>

      {/* Live Clock Row */}
      <div className="clock-row">
        <div className="clock-card">
          <div className="clock-tz-row">
            <Globe size={14} />
            <CustomSelect
              className="compact"
              wrapperClassName="tz-select-wrapper"
              value={primaryTz}
              onChange={e => setPrimaryTz(e.target.value)}
              id="primary-tz-select"
              options={timezoneOptions}
            />
          </div>
          <div className="clock-time">{formatTime(liveDate, primaryTz)}</div>
          <div className="clock-date">{formatDateInTz(liveDate, primaryTz)}</div>
          <div className="clock-offset">{getTzOffset(primaryTz)}</div>
        </div>

        <div className="clock-divider">
          <div className="divider-line" />
          <span className="divider-vs">VS</span>
          <div className="divider-line" />
        </div>

        <div className="clock-card clock-card-secondary">
          <div className="clock-tz-row">
            <Globe size={14} />
            <CustomSelect
              className="compact"
              wrapperClassName="tz-select-wrapper"
              value={compareTz}
              onChange={e => setCompareTz(e.target.value)}
              id="compare-tz-select"
              options={timezoneOptions}
            />
          </div>
          <div className="clock-time clock-time-secondary">{formatTime(liveDate, compareTz)}</div>
          <div className="clock-date">{formatDateInTz(liveDate, compareTz)}</div>
          <div className="clock-offset">{getTzOffset(compareTz)}</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="cal-body">
        {/* Navigation */}
        <div className="cal-nav">
          <button className="nav-btn" onClick={prevMonth} id="cal-prev"><ChevronLeft size={16} /></button>
          <div className="cal-month-title">
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </div>
          <button className="nav-btn" onClick={nextMonth} id="cal-next"><ChevronRight size={16} /></button>
          <button className="today-btn" onClick={goToday} id="cal-today">Today</button>
        </div>

        {/* Day headers */}
        <div className="cal-grid">
          {DAYS.map(d => (
            <div key={d} className="cal-day-hd">{d}</div>
          ))}

          {/* Day cells */}
          {days.map((day, i) => {
            const today = isToday(day);
            const selected = isSelected(day);
            const inMonth = isCurrentMonth(day);
            return (
              <button
                key={i}
                className={`cal-cell${today ? ' today' : ''}${selected ? ' selected' : ''}${!inMonth ? ' out-month' : ''}`}
                onClick={() => setSelectedDate(day)}
                id={`cal-day-${day.toISOString().split('T')[0]}`}
              >
                <span className="day-num">{day.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* Selected day info */}
        <div className="selected-info">
          <div className="selected-info-row">
            <Clock size={14} />
            <span className="selected-date-label">{selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="tz-comparison">
            <div className="tz-comp-item">
              <span className="tz-label">{primaryTz.split('/').pop()?.replace('_', ' ')}</span>
              <span className="tz-val">{formatDateInTz(selectedDate, primaryTz)}</span>
            </div>
            <div className="tz-comp-arrow">→</div>
            <div className="tz-comp-item">
              <span className="tz-label">{compareTz.split('/').pop()?.replace('_', ' ')}</span>
              <span className="tz-val">{formatDateInTz(selectedDate, compareTz)}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cal-page { padding: 1.5rem 2rem; max-width: 900px; margin: 0 auto; }
        .cal-header { margin-bottom: 1.5rem; }
        .cal-title { display: flex; align-items: center; gap: .75rem; margin-bottom: .35rem; }
        .cal-title h1 { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .cal-subtitle { font-size: .85rem; color: var(--text-muted); margin: 0; }

        /* Live clocks */
        .clock-row { display: flex; align-items: stretch; gap: 1rem; margin-bottom: 1.5rem; }
        .clock-card { flex: 1; background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 1.5rem; display: flex; flex-direction: column; gap: .4rem; }
        .clock-card-secondary { border-color: rgba(99,102,241,.3); background: linear-gradient(135deg, rgba(99,102,241,.06), rgba(139,92,246,.04)); }
        .clock-tz-row { display: flex; align-items: center; gap: .5rem; color: var(--text-muted); width: 100%; }
        .tz-select-wrapper { flex: 1; max-width: 240px; }
        .clock-time { font-size: 2.4rem; font-weight: 800; letter-spacing: -.02em; line-height: 1; margin-top: .25rem; }
        .clock-time-secondary { color: var(--accent); }
        .clock-date { font-size: .8rem; color: var(--text-muted); }
        .clock-offset { font-size: .72rem; color: var(--text-muted); opacity: .6; }
        .clock-divider { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; padding: 0 .25rem; }
        .divider-line { flex: 1; width: 1px; background: var(--border); }
        .divider-vs { font-size: .7rem; font-weight: 700; color: var(--text-muted); letter-spacing: .1em; }

        /* Calendar */
        .cal-body { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
        .cal-nav { display: flex; align-items: center; gap: .75rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
        .nav-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: transparent; cursor: pointer; color: var(--text); display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .nav-btn:hover { border-color: var(--accent); color: var(--accent); }
        .cal-month-title { flex: 1; font-size: 1rem; font-weight: 700; }
        .today-btn { padding: .35rem .9rem; border-radius: 8px; border: 1px solid var(--border); background: transparent; font-size: .78rem; font-weight: 600; cursor: pointer; color: var(--text-muted); transition: all .15s; }
        .today-btn:hover { border-color: var(--accent); color: var(--accent); }

        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); padding: .75rem; gap: .25rem; }
        .cal-day-hd { text-align: center; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); padding: .4rem 0; }
        .cal-cell { background: transparent; border: none; border-radius: 10px; padding: .5rem; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: .2rem; transition: background .1s; min-height: 52px; }
        .cal-cell:hover { background: var(--sidebar-hover); }
        .cal-cell.out-month .day-num { opacity: .25; }
        .day-num { font-size: .85rem; font-weight: 500; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .cal-cell.today .day-num { background: rgba(99,102,241,.2); color: var(--accent); font-weight: 700; }
        .cal-cell.selected .day-num { background: var(--accent); color: white; font-weight: 700; }

        /* Selected day */
        .selected-info { padding: 1rem 1.25rem; border-top: 1px solid var(--border); background: var(--sidebar-bg); }
        .selected-info-row { display: flex; align-items: center; gap: .5rem; margin-bottom: .75rem; color: var(--text-muted); font-size: .85rem; }
        .selected-date-label { font-weight: 600; color: var(--text); }
        .tz-comparison { display: flex; align-items: center; gap: 1rem; }
        .tz-comp-item { display: flex; flex-direction: column; gap: .2rem; }
        .tz-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
        .tz-val { font-size: .85rem; font-weight: 600; }
        .tz-comp-arrow { font-size: 1rem; color: var(--text-muted); }

        @media (max-width: 600px) {
          .clock-row { flex-direction: column; }
          .clock-divider { flex-direction: row; }
        }
      `}</style>
    </div>
  );
}
