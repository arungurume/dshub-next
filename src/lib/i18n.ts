/**
 * i18n utility - mirrors Angular LanguageService behaviour.
 * Storage key: 'ds_lang' (same as Angular)
 * Supported: en, es, de, fr
 */

import en from '@/i18n/en.json';
import de from '@/i18n/de.json';
import es from '@/i18n/es.json';
import fr from '@/i18n/fr.json';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'de', 'fr'] as const;
export type SupportedLang = typeof SUPPORTED_LANGUAGES[number];

export const LANG_META: Record<SupportedLang, { name: string; flag: string; nativeName: string }> = {
  en: { name: 'English',  flag: '🇬🇧', nativeName: 'English'  },
  es: { name: 'Spanish',  flag: '🇪🇸', nativeName: 'Español'  },
  de: { name: 'German',   flag: '🇩🇪', nativeName: 'Deutsch'  },
  fr: { name: 'French',   flag: '🇫🇷', nativeName: 'Français' },
};

export const TRANSLATIONS: Record<SupportedLang, any> = { en, de, es, fr };

const STORAGE_KEY = 'ds_lang';

/** Detect browser language and normalize it */
function detectBrowserLang(): SupportedLang {
  if (typeof window === 'undefined') return 'en';
  const nav = window.navigator as any;
  const raw: string = (nav.languages?.[0] ?? nav.language ?? 'en');
  const code = raw.split('-')[0].toLowerCase() as SupportedLang;
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'en';
}

/** Read stored or browser language (SSR-safe) */
export function getStoredLang(): SupportedLang {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY) as SupportedLang | null;
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  return detectBrowserLang();
}

/** Persist language choice */
export function storeLang(lang: SupportedLang): void {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
}

/**
 * Translate a dot-notation key against the given translations object.
 * e.g. t(dict, 'LOGIN.email') → 'Email'
 */
export function t(dict: any, key: string, fallback?: string): string {
  const parts = key.split('.');
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return fallback ?? key;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : (fallback ?? key);
}
