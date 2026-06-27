'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Check, X } from 'lucide-react';
import { cmsApiV2, getCookie } from '@/lib/api';
import { useDSStore } from '@/store/useDSStore';
import Image from 'next/image';

function RedeemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const { theme, toggleTheme } = useDSStore();

  const [code, setCode] = useState(codeParam.toUpperCase());
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    screensGranted?: number;
    tier?: number;
  } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    const token = getCookie('token') || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) {
      const redirectTo = '/redeem' + (codeParam ? `?code=${encodeURIComponent(codeParam)}` : '');
      router.replace(`/signin?redirect=${encodeURIComponent(redirectTo)}`);
      return;
    }
    setAuthChecked(true);
  }, [router, codeParam]);

  async function handleRedeem() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setRedeeming(true);
    setResult(null);
    try {
      const { data } = await cmsApiV2.post('/sac/appsumo/redeem', { code: trimmed });
      setResult({ success: true, message: data.message, screensGranted: data.screensGranted, tier: data.tier });
      setCode('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Redemption failed. Please try again.';
      setResult({ success: false, message: msg });
    } finally {
      setRedeeming(false);
    }
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'var(--bg-base)', color: 'var(--text)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <Image
            src={isDark ? '/images/DS_b.png' : '/images/DS_w.png'}
            alt="DSHub"
            width={140}
            height={60}
            style={{ height: 'auto' }}
            className="object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '22px',
          padding: '2rem 1.75rem',
          boxShadow: '0 8px 40px rgba(0,0,0,.18)',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '.6rem' }}>🏷️</div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 .4rem', letterSpacing: '-.01em' }}>
              AppSumo Lifetime Deal
            </h1>
            <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Enter your AppSumo code to activate lifetime screen slots on your account.
            </p>
          </div>

          {/* Success state */}
          {result?.success ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '.6rem',
                padding: '1rem 1.1rem', borderRadius: '14px', marginBottom: '1.25rem',
                background: 'rgba(22,163,74,.09)', border: '1px solid rgba(22,163,74,.22)',
                color: '#16a34a', fontWeight: 600, fontSize: '.9rem', lineHeight: 1.4,
              }}>
                <Check size={18} style={{ marginTop: '.05rem', flexShrink: 0 }} />
                <span>{result.message}</span>
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  width: '100%', height: '50px', borderRadius: '13px', border: 'none',
                  background: isDark ? '#ffffff' : '#1f2937',
                  color: isDark ? '#1f2937' : '#ffffff',
                  fontWeight: 700, fontSize: '.875rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem',
                }}
              >
                Go to Dashboard →
              </button>
            </>
          ) : (
            <>
              {/* Error result */}
              {result && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '.6rem',
                  padding: '1rem 1.1rem', borderRadius: '14px', marginBottom: '1rem',
                  background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                  color: '#dc2626', fontWeight: 600, fontSize: '.875rem', lineHeight: 1.4,
                }}>
                  <X size={16} style={{ marginTop: '.1rem', flexShrink: 0 }} />
                  <span>{result.message}</span>
                </div>
              )}

              {/* Code input */}
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleRedeem()}
                placeholder="e.g. AS-T1-AB12CD34"
                maxLength={20}
                disabled={redeeming}
                style={{
                  width: '100%', height: '52px', borderRadius: '13px',
                  border: `1px solid ${result ? 'rgba(239,68,68,.4)' : 'var(--border)'}`,
                  background: 'var(--bg-base)', color: 'var(--text)',
                  fontFamily: 'monospace', fontSize: '1.05rem',
                  letterSpacing: '.07em', padding: '0 1rem',
                  textTransform: 'uppercase', boxSizing: 'border-box' as const,
                  outline: 'none', marginBottom: '.85rem',
                  opacity: redeeming ? .55 : 1,
                  transition: 'border-color .15s',
                }}
              />

              {/* Redeem button */}
              <button
                onClick={handleRedeem}
                disabled={redeeming || !code.trim()}
                style={{
                  width: '100%', height: '52px', borderRadius: '13px', border: 'none',
                  background: '#f59e0b', color: '#fff',
                  fontWeight: 700, fontSize: '.9rem',
                  cursor: redeeming || !code.trim() ? 'not-allowed' : 'pointer',
                  opacity: redeeming || !code.trim() ? .55 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.45rem',
                  transition: 'opacity .15s',
                }}
              >
                {redeeming
                  ? <><Loader2 size={15} className="animate-spin" /> Activating…</>
                  : 'Activate Lifetime Deal'}
              </button>
            </>
          )}

          {/* Tier legend */}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { tier: 1, screens: 1, color: '#2563eb', bg: 'rgba(59,130,246,.1)' },
              { tier: 2, screens: 3, color: '#7D2AE8', bg: 'rgba(125,42,232,.1)' },
              { tier: 3, screens: 5, color: '#d97706', bg: 'rgba(245,158,11,.1)' },
            ].map(t => (
              <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.77rem', color: 'var(--text-muted)' }}>
                <span style={{ padding: '.12rem .5rem', borderRadius: '999px', fontWeight: 800, fontSize: '.65rem', background: t.bg, color: t.color }}>
                  Tier {t.tier}
                </span>
                <span>{t.screens} lifetime screen{t.screens !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>

          {/* Stacking note */}
          <p style={{ textAlign: 'center', fontSize: '.74rem', color: 'var(--text-muted)', marginTop: '.85rem', lineHeight: 1.5 }}>
            🔗 <strong style={{ color: 'var(--text)' }}>Stacking supported</strong> — redeem multiple codes to accumulate more screen slots. Each code adds independently.
          </p>
        </div>

        {/* Footer link */}
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '.8rem', color: 'var(--text-muted)' }}>
          Already redeemed?{' '}
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '.8rem' }}
          >
            Go to Dashboard
          </button>
        </p>
      </div>
    </main>
  );
}

export default function RedeemPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    }>
      <RedeemContent />
    </Suspense>
  );
}
