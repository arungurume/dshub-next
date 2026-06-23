'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SupportedLang, TRANSLATIONS, SUPPORTED_LANGUAGES,
  LANG_META, getStoredLang, storeLang, t as _t
} from '@/lib/i18n';

interface LanguageContextValue {
  lang: SupportedLang;
  dict: any;
  setLang: (lang: SupportedLang) => void;
  t: (key: string, fallback?: string) => string;
  langMeta: typeof LANG_META;
  supported: typeof SUPPORTED_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  dict: TRANSLATIONS.en,
  setLang: () => {},
  t: (k) => k,
  langMeta: LANG_META,
  supported: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SupportedLang>('en');
  const [dict, setDict] = useState<any>(TRANSLATIONS.en);

  useEffect(() => {
    const detected = getStoredLang();
    setLangState(detected);
    setDict(TRANSLATIONS[detected]);
  }, []);

  const setLang = useCallback((newLang: SupportedLang) => {
    setLangState(newLang);
    setDict(TRANSLATIONS[newLang]);
    storeLang(newLang);
    // Update document lang attribute
    if (typeof document !== 'undefined') document.documentElement.lang = newLang;
  }, []);

  const translate = useCallback((key: string, fallback?: string) => {
    return _t(dict, key, fallback);
  }, [dict]);

  return (
    <LanguageContext.Provider value={{
      lang, dict, setLang,
      t: translate,
      langMeta: LANG_META,
      supported: SUPPORTED_LANGUAGES,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
