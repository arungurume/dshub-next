'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sun, Lightbulb } from 'lucide-react';
import { useTranslation } from '@/context/TranslateContext';
import { useDSStore } from '@/store/useDSStore';

export default function JoinPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useDSStore();

  React.useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  return (
    <main className="min-h-screen flex" style={{ background: 'var(--bg-base)', color: 'var(--text)' }}>
      {/* Left: Info panel */}
      <div
        className="w-full md:w-[45%] flex flex-col justify-center p-8 lg:p-16"
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
      >
        <div className="max-w-md w-full mx-auto space-y-8">

          {/* Header: logo + theme */}
          <div className="flex items-center justify-between">
            <Image src={theme === 'dark' ? '/images/DS_b.png' : '/images/DS_w.png'} alt="DSHub" width={160} height={69}
              className="object-contain" priority />
            <button
              id="join-theme-toggle"
              onClick={toggleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
            >
              {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Lightbulb size={15} strokeWidth={1.8} />}
            </button>
          </div>

          {/* Back arrow */}
          <button
            id="join-back-btn"
            onClick={() => router.push('/signin')}
            className="flex items-center gap-2 text-xs font-medium transition-colors hover:opacity-75"
            style={{ color: 'var(--accent)' }}
          >
            <ArrowLeft size={15} />
            {t('LOGIN.back_to_login')}
          </button>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
              Join Organization
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              You&apos;ve been invited to join a DSHub organization. Validating your invite link…
            </p>
          </div>

          {/* Invite banner */}
          <div className="rounded-xl p-4 flex items-start gap-3"
               style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                 style={{ background: 'rgba(99,102,241,0.2)' }}>
              <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>✓</span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Invite link detected</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Please sign in or create an account to accept this invitation.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              id="join-signin-btn"
              onClick={() => router.push('/signin')}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all text-white"
              style={{ background: 'var(--btn-cta-bg)' }}
            >
              {t('LOGIN.login')} to Accept
            </button>
            <button
              id="join-signup-btn"
              onClick={() => router.push('/signup')}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
            >
              {t('LOGIN.create_account')}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Hero */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        <Image src="/images/auth-hero-1.webp" alt="DSHub" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <div className="backdrop-blur-md rounded-2xl p-6"
               style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-xl font-bold text-white">Your team is waiting</h2>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Join your organization on DSHub to collaborate on digital signage content, playlists, and screen management in real time.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
