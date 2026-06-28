'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { umsApi } from '@/lib/api';
import { useDSStore } from '@/store/useDSStore';

function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useDSStore();
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  React.useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please check your email link.');
      return;
    }

    umsApi.put(`/auth/user/verify?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified. You can now sign in.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Invalid or expired verification link.');
      });
  }, []);

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: theme === 'dark' ? '#0B0B0C' : '#f7f8fb' }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl space-y-6 text-center shadow-2xl"
        style={{
          background: theme === 'dark' ? '#18181b' : '#ffffff',
          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
        }}
      >
        <div className="flex justify-center mb-2">
          <Image
            src={theme === 'dark' ? '/images/DS_b.png' : '/images/DS_w.png'}
            alt="DSHub"
            width={120}
            height={52}
            className="object-contain"
            priority
          />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={40} className="animate-spin mx-auto" style={{ color: theme === 'dark' ? '#fff' : '#1f2937' }} />
            <h1 className="text-xl font-bold" style={{ color: theme === 'dark' ? '#fff' : '#1f2937' }}>
              Verifying your email…
            </h1>
            <p className="text-sm" style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
              Please wait while we confirm your account.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={40} className="mx-auto text-green-500" />
            <h1 className="text-xl font-bold" style={{ color: theme === 'dark' ? '#fff' : '#1f2937' }}>
              Email Verified!
            </h1>
            <p className="text-sm" style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
              {message}
            </p>
            <button
              onClick={() => router.push('/signin')}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                background: theme === 'dark' ? '#ffffff' : '#1f2937',
                color: theme === 'dark' ? '#1f2937' : '#ffffff',
              }}
            >
              Sign In
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto text-red-500" />
            <h1 className="text-xl font-bold" style={{ color: theme === 'dark' ? '#fff' : '#1f2937' }}>
              Verification Failed
            </h1>
            <p className="text-sm" style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
              {message}
            </p>
            <button
              onClick={() => router.push('/signin')}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                background: theme === 'dark' ? '#ffffff' : '#1f2937',
                color: theme === 'dark' ? '#1f2937' : '#ffffff',
              }}
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function ConfirmEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <ConfirmEmailContent />
    </React.Suspense>
  );
}
