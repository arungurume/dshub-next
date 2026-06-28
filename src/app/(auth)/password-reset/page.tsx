'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { umsApi } from '@/lib/api';
import { useDSStore } from '@/store/useDSStore';

function PasswordResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useDSStore();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  if (!token) {
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
          <XCircle size={40} className="mx-auto text-red-500" />
          <h1 className="text-xl font-bold" style={{ color: theme === 'dark' ? '#fff' : '#1f2937' }}>
            Invalid Reset Link
          </h1>
          <p className="text-sm" style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <button
            onClick={() => router.push('/forgot-password')}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: theme === 'dark' ? '#fff' : '#1f2937', color: theme === 'dark' ? '#1f2937' : '#fff' }}
          >
            Request New Link
          </button>
        </div>
      </main>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await umsApi.put('/forget/user/password', {
        token,
        newPassword,
        confirmNewPassword: confirmPassword,
      });
      setDone(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: '52px',
    borderRadius: '14px',
    padding: '0 44px 0 16px',
    border: `1px solid ${theme === 'dark' ? '#2d2d30' : '#d1d5db'}`,
    background: theme === 'dark' ? '#18181b' : '#ffffff',
    color: theme === 'dark' ? '#f4f4f5' : '#1f2937',
    fontSize: '0.875rem',
    fontWeight: 500,
    width: '100%',
    outline: 'none',
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: theme === 'dark' ? '#0B0B0C' : '#f7f8fb' }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-2xl"
        style={{
          background: theme === 'dark' ? '#18181b' : '#ffffff',
          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
        }}
      >
        <div className="flex justify-center mb-8">
          <Image
            src={theme === 'dark' ? '/images/DS_b.png' : '/images/DS_w.png'}
            alt="DSHub"
            width={120}
            height={52}
            className="object-contain"
            priority
          />
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <CheckCircle size={40} className="mx-auto text-green-500" />
            <h1 className="text-xl font-bold" style={{ color: theme === 'dark' ? '#fff' : '#1f2937' }}>
              Password Reset!
            </h1>
            <p className="text-sm" style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button
              onClick={() => router.push('/signin')}
              className="w-full py-3 rounded-xl font-bold text-sm mt-2"
              style={{ background: theme === 'dark' ? '#fff' : '#1f2937', color: theme === 'dark' ? '#1f2937' : '#fff' }}
            >
              Sign In
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme === 'dark' ? '#fff' : '#1f2937' }}>
                Set New Password
              </h1>
              <p className="text-sm mt-2" style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
                Enter your new password below.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                       style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    style={inputStyle}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                       style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    style={inputStyle}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: theme === 'dark' ? '#ffffff' : '#1f2937',
                  color: theme === 'dark' ? '#1f2937' : '#ffffff',
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function PasswordResetPage() {
  return (
    <React.Suspense fallback={null}>
      <PasswordResetContent />
    </React.Suspense>
  );
}
