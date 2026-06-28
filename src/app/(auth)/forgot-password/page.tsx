'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Sun, Lightbulb, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/context/TranslateContext';
import { useDSStore } from '@/store/useDSStore';
import { umsApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useDSStore();
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Apply theme class to <html>
  React.useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setIsLoading(true);
    try {
      await umsApi.post('/forget/user/password', { email });
      toast.success(t('LOGIN.email_sent') || 'Reset instructions sent — check your inbox');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex"
      style={{ background: 'var(--bg-base)', color: 'var(--text)' }}
    >
      {/* Left: Form */}
      <div
        className="w-full md:w-[45%] min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative z-0"
        style={{ 
          background: theme === 'dark' ? '#0B0B0C' : '#f7f8fb', 
          color: theme === 'dark' ? '#ffffff' : '#1f2937', 
          borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e5e7eb' 
        }}
      >
        {/* Back arrow - top-left corner */}
        <div className="absolute top-6 left-6 z-10">
          <button
            id="fp-back-btn"
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
            id="fp-theme-toggle"
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
              {t('LOGIN.reset_password_heading')}
            </h1>
            <p className="text-sm leading-normal mt-2" 
               style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
              {t('LOGIN.reset_password_instruction')}
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label
                className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}
              >
                {t('LOGIN.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('LOGIN.email')}
                className="login-input"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="login-submit-btn"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                t('LOGIN.reset_password_btn')
              )}
            </button>
          </form>

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

      {/* Right: Hero Image */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        <Image
          src="/images/forgot-password-graphic.png"
          alt="Reset password"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <div className="backdrop-blur-md rounded-2xl p-6"
               style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-xl font-bold text-white">
              {t('LOGIN.reset_password_heading')}
            </h2>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {t('LOGIN.reset_password_instruction_sent')}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
