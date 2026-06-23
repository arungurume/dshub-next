'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS, SUPPORTED_LANGUAGES, getStoredLang, storeLang, t as dotT, SupportedLang } from '@/lib/i18n';

type TranslationsObject = Record<string, any>;

interface TranslateContextProps {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string, variables?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const TranslateContext = createContext<TranslateContextProps | undefined>(undefined);

// Helper function to set cookies in document
const setCookie = (name: string, value: string, days = 365) => {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = '; expires=' + date.toUTCString();
  document.cookie = name + '=' + value + expires + '; path=/';
};

// Helper function to read cookies
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const TranslateProvider: React.FC<{ children: React.ReactNode; defaultLang?: string }> = ({ children, defaultLang }) => {
  const [language, setLanguageState] = useState<string>(defaultLang || 'en');
  const [translations, setTranslations] = useState<TranslationsObject>(
    TRANSLATIONS[(defaultLang || 'en') as SupportedLang] ?? TRANSLATIONS.en
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load language preference on mount — reads ds_lang (same key as admin LanguageContext)
  useEffect(() => {
    const detected = getStoredLang();
    setLanguageState(detected);
    setTranslations(TRANSLATIONS[detected] ?? TRANSLATIONS.en);
    setIsLoading(false);
  }, []);

  const setLanguage = async (lang: string) => {
    const code = (SUPPORTED_LANGUAGES.includes(lang as any) ? lang : 'en') as typeof SUPPORTED_LANGUAGES[number];
    setTranslations(TRANSLATIONS[code] ?? TRANSLATIONS.en);
    setLanguageState(code);
    // Write BOTH keys so admin LanguageContext also picks up the selection
    storeLang(code);
    setCookie('NEXT_LOCALE', code);
    setIsLoading(false);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    if (!key) return '';
    let value = dotT(translations, key, key);
    if (variables) {
      Object.entries(variables).forEach(([vKey, vVal]) => {
        value = value.replace(new RegExp(`{${vKey}}`, 'g'), String(vVal));
      });
    }
    return value;
  };

  return (
    <TranslateContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </TranslateContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslateContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslateProvider');
  }
  return context;
};
