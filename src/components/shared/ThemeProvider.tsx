'use client';

import { useEffect } from 'react';
import { useDSStore } from '@/store/useDSStore';

/**
 * Reads saved theme from localStorage on mount, syncs to store,
 * and applies 'dark'/'light' class to <html> whenever store.theme changes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useDSStore((s) => s.theme);
  const setTheme = useDSStore((s) => s.setTheme);

  // On first mount restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ds-theme') as 'dark' | 'light' | null;
    if (saved && saved !== theme) {
      setTheme(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme class to <html> whenever it changes
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    html.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
