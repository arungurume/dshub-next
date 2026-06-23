'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, ArrowLeft, Loader2, Sun, Lightbulb } from 'lucide-react';
import { umsApi } from '@/lib/api';
import { useTranslation } from '@/context/TranslateContext';
import { useDSStore } from '@/store/useDSStore';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  userName:  z.string().email('Valid email required'),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
});

type SignupFields = z.infer<typeof signupSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useDSStore();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFields>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(data: SignupFields) {
    setLoading(true);
    try {
      await umsApi.post('/auth/signup', data);
      toast.success('Account created! Please check your email to verify.');
      router.push('/signin');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (hasError: boolean) => ({
    background: 'var(--input-bg)',
    border: `1px solid ${hasError ? '#ef4444' : 'var(--border)'}`,
    color: 'var(--text)',
  });

  return (
    <main className="min-h-screen flex" style={{ background: 'var(--bg-base)', color: 'var(--text)' }}>
      {/* Left: Form */}
      <div
        className="w-full md:w-[45%] min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative z-0 overflow-y-auto"
        style={{ 
          background: theme === 'dark' ? '#0B0B0C' : '#f7f8fb', 
          color: theme === 'dark' ? '#ffffff' : '#1f2937', 
          borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e5e7eb' 
        }}
      >
        {/* Back arrow - top-left corner */}
        <div className="absolute top-6 left-6 z-10">
          <button
            id="signup-back-btn"
            onClick={() => router.push('/signin')}
            className="flex items-center gap-2 text-xs font-bold transition-all hover:opacity-80 px-2.5 py-1.5 rounded-lg hover:bg-gray-100/10"
            style={{ border: 'none', background: 'transparent', color: '#6b7280' }}
          >
            <ArrowLeft size={14} />
            {t('LOGIN.back_to_login')}
          </button>
        </div>

        {/* Top-Right Theme Controls */}
        <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
          <button
            id="signup-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all hover:bg-gray-100/10"
            style={{ border: 'none', background: 'transparent', color: '#6b7280' }}
          >
            {theme === 'dark'
              ? <Sun size={15} strokeWidth={1.8} />
              : <Lightbulb size={15} strokeWidth={1.8} />
            }
          </button>
        </div>

        {/* Flat Form Container */}
        <div 
          className="w-full flex flex-col p-6 sm:p-0"
          style={{
            maxWidth: '460px',
            color: theme === 'dark' ? '#ffffff' : '#1f2937'
          }}
        >
          {/* Logo at the top of the card (Larger) */}
          <div className="flex justify-center mb-6">
            <Image 
              src={theme === 'dark' ? '/images/DS_b.png' : '/images/DS_w.png'} 
              alt="DSHub" 
              width={160} 
              height={69}
              className="object-contain" 
              priority 
            />
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight leading-tight" 
                style={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}>
              {t('LOGIN.create_account')}
            </h1>
            <p className="text-sm leading-normal mt-2" 
               style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
              {t('LOGIN.lets_get_started')}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* First + Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                       style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                  {t('LOGIN.first_name')}
                </label>
                <input
                  {...register('firstName')}
                  placeholder="Jane"
                  className="login-input"
                />
                {errors.firstName && <p className="mt-1.5 text-xs text-red-500">{t('LOGIN.first_name_required')}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                       style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                  {t('LOGIN.last_name')}
                </label>
                <input
                  {...register('lastName')}
                  placeholder="Doe"
                  className="login-input"
                />
                {errors.lastName && <p className="mt-1.5 text-xs text-red-500">{t('LOGIN.last_name_required')}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                     style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                {t('LOGIN.email')}
              </label>
              <input
                {...register('userName')}
                type="email"
                placeholder={t('LOGIN.email')}
                className="login-input"
              />
              {errors.userName && <p className="mt-1.5 text-xs text-red-500">{t('LOGIN.valid_email')}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                     style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                {t('LOGIN.password')}
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  className="login-input"
                  style={{ paddingRight: '44px' }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{t('LOGIN.password_required')}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Creating account…' : t('LOGIN.register')}
            </button>
          </form>

          {/* Already registered */}
          <div className="text-center text-xs mt-6"
               style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
            {t('LOGIN.already_registered')}{' '}
            <button 
              onClick={() => router.push('/signin')}
              className="hover:underline font-bold"
              style={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
            >
              {t('LOGIN.login')}
            </button>
          </div>

        </div>

        {/* Local Styles for Premium Input Fields and Buttons */}
        <style>{`
          .login-input {
            height: 52px;
            border-radius: 14px;
            padding: 0 16px;
            border: 1px solid ${theme === 'dark' ? '#2d2d30' : '#d1d5db'};
            background: ${theme === 'dark' ? '#18181b' : '#ffffff'};
            color: ${theme === 'dark' ? '#f4f4f5' : '#1f2937'};
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s ease;
            width: 100%;
          }
          .login-input::placeholder {
            color: ${theme === 'dark' ? '#52525b' : '#9ca3af'};
          }
          .login-input:focus {
            outline: none;
            border-color: ${theme === 'dark' ? '#ffffff' : '#1f2937'} !important;
            box-shadow: 0 0 0 4px ${theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(31, 41, 55, 0.08)'} !important;
          }
          .login-submit-btn {
            height: 52px;
            background-color: ${theme === 'dark' ? '#ffffff' : '#1f2937'};
            color: ${theme === 'dark' ? '#1f2937' : '#ffffff'};
            border-radius: 14px;
            font-weight: 700;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: none;
            cursor: pointer;
          }
          .login-submit-btn:hover {
            background-color: ${theme === 'dark' ? '#e4e4e7' : '#111827'};
          }
          .login-submit-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>

      {/* Right: Hero */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        <Image src="/images/auth-hero-3.webp" alt="DSHub" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <div className="backdrop-blur-md rounded-2xl p-6"
               style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-xl font-bold text-white">Powerful digital signage, simplified</h2>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Create stunning content, schedule playlists, and manage all your screens from one beautiful dashboard.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
