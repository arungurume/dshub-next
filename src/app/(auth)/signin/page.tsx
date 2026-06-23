'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Script from 'next/script';
import { toast } from 'sonner';
import { Eye, EyeOff, Sun, Lightbulb, Loader2, ArrowRight, AlertCircle, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from '@/context/TranslateContext';
import { useDSStore } from '@/store/useDSStore';
import { umsApi, setCookie } from '@/lib/api';

const loginSchema = z.object({
  username: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginFields = z.infer<typeof loginSchema>;

export default function SignInPage() {
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();
  const setCurrentUser = useDSStore((state) => state.setCurrentUser);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
  ];

  // Initialize Google Sign-In
  const initGoogleSignIn = () => {
    try {
      const g = (window as any).google;
      if (!g?.accounts?.id) return;

      g.accounts.id.initialize({
        client_id: '332106161692-m75rkqurh616o3u0lath06lc2025ghb5.apps.googleusercontent.com',
        callback: handleGoogleCredentialResponse,
        auto_select: false,
      });

      // Calculate width based on viewport
      let btnWidth = 376;
      if (typeof window !== 'undefined') {
        const screenWidth = window.innerWidth;
        if (screenWidth < 480) {
          // Adjust for card margins and card padding on mobile
          btnWidth = Math.max(screenWidth - 64, 240);
        }
      }

      g.accounts.id.renderButton(
        document.getElementById('google-btn-container'),
        {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: btnWidth,
        }
      );
      g.accounts.id.disableAutoSelect();
    } catch (err) {
      console.error('Google Sign-In initialization failed:', err);
    }
  };

  useEffect(() => {
    // Attempt init if script loaded
    if ((window as any).google?.accounts?.id) {
      initGoogleSignIn();
    }
  }, []);

  const handleGoogleCredentialResponse = async (gResponse: any) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const response = await umsApi.post('/auth/signin/google', null, {
        headers: {
          'Authorization-Google': gResponse.credential,
        },
      });

      const user = response.data;
      // Write auth variables
      setCookie('token', user.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', user.token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('currentUserOrg', JSON.stringify(user.organization));
        localStorage.setItem('role', user.roles[0].name);
      }
      setCurrentUser(user);

      toast.success('Successfully logged in with Google');
      router.replace('/admin/dashboard');
    } catch (err: any) {
      console.error('Google Auth login error:', err);
      setLoginError(err.response?.data?.message || 'Google authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: LoginFields) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const response = await umsApi.post('/auth/signin/local', {
        userName: data.username,
        password: data.password,
      });

      const user = response.data;
      setCookie('token', user.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', user.token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('currentUserOrg', JSON.stringify(user.organization));
        localStorage.setItem('role', user.roles[0].name);
      }
      setCurrentUser(user);

      toast.success('Logged in successfully');
      router.replace('/admin/dashboard');
    } catch (err: any) {
      console.error('Local login error:', err);
      setLoginError(err.response?.data?.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  const { toggleTheme, theme } = useDSStore();

  // Apply theme class to <html> on auth pages too
  React.useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const LANG_FLAGS: Record<string, string> = {
    en: '🇬🇧', es: '🇪🇸', de: '🇩🇪', fr: '🇫🇷'
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row relative"
      style={{ background: 'var(--bg-base, #0B0B0C)', color: 'var(--text, #fff)' }}>
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={initGoogleSignIn}
        strategy="lazyOnload"
      />

      {/* Left Panel: Form */}
      <div className="w-full md:w-[45%] min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative z-0"
           style={{ 
             background: theme === 'dark' ? '#0B0B0C' : '#f7f8fb', 
             color: theme === 'dark' ? '#ffffff' : '#1f2937', 
             borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e5e7eb' 
           }}>
        
        {/* Top-Right Language + Theme Controls */}
        <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
          {/* Language picker */}
          <div className="relative">
            <button
              id="auth-lang-toggle"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              title="Change language"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100/10"
              style={{ border: 'none', background: 'transparent', color: '#6b7280' }}
            >
              <span>{LANG_FLAGS[language] || '🌐'}</span>
              <span className="uppercase tracking-wide">{language}</span>
            </button>
            {isLangMenuOpen && (
              <div className="absolute right-0 mt-1 w-36 rounded-xl py-1 shadow-2xl z-50"
                   style={{ 
                     background: theme === 'dark' ? '#18181b' : '#ffffff', 
                     border: theme === 'dark' ? '1px solid #2d2d30' : '1px solid #e5e7eb' 
                   }}>
                {languages.map((l) => (
                  <button
                    key={l.code}
                    id={`login-lang-${l.code}`}
                    onClick={() => { setLanguage(l.code); setIsLangMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors hover:bg-gray-100/10"
                    style={{
                      color: language === l.code ? (theme === 'dark' ? '#ffffff' : '#1f2937') : '#6b7280',
                      fontWeight: language === l.code ? 700 : 400,
                    }}
                  >
                    <span>{LANG_FLAGS[l.code]}</span>{l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            id="auth-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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
          <div className="flex justify-center mb-8">
            <Image
              src={theme === 'dark' ? '/images/DS_b.png' : '/images/DS_w.png'}
              alt="DSHub"
              width={160}
              height={69}
              className="object-contain"
              priority
            />
          </div>

          {/* Welcome Headline */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight leading-tight"
                style={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}>
              Welcome back
            </h1>
            <p className="text-sm leading-normal mt-2"
               style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
              Sign in to manage your screens and content.
            </p>
          </div>

          {/* Google Sign-In with Improved Styles */}
          <div className="relative w-full mb-6" style={{ height: '48px' }}>
            {/* Custom Styled Google Button */}
            <div
              className="absolute inset-0 flex items-center justify-center gap-3 px-4 rounded-[14px] text-sm font-semibold transition-all border"
              style={{
                height: '48px',
                background: theme === 'dark' ? '#18181b' : '#ffffff',
                borderColor: theme === 'dark' ? '#2d2d30' : '#d1d5db',
                color: theme === 'dark' ? '#f4f4f5' : '#4b5563',
              }}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.53 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.96-2.87 3.66-4.97 6.76-4.97z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.48c-.29 1.56-1.17 2.87-2.5 3.75l3.85 3c2.26-2.09 3.66-5.17 3.66-8.91z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.24 14.57c-.25-.75-.39-1.56-.39-2.4 0-.84.14-1.65.39-2.4L1.39 6.78C.5 8.56 0 10.53 0 12.63c0 2.1.5 4.07 1.39 5.85l3.85-3.06z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.85-3c-1.08.72-2.48 1.16-4.11 1.16-3.1 0-5.8-2.1-6.76-4.97L1.39 16.27C3.37 20.16 7.35 23 12 23z"
                />
              </svg>
              <span>Continue with Google</span>
            </div>

            {/* Invisible Official Google Button (Invisible overlay but clickable) */}
            <div
              id="google-btn-container"
              className="absolute inset-0 opacity-[0.01] hover:opacity-[0.05] transition-opacity cursor-pointer flex justify-center items-center"
              style={{
                height: '48px',
                width: '100%',
              }}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6"
               style={{ color: theme === 'dark' ? '#3f3f46' : '#d1d5db' }}>
            <span className="h-px flex-1" style={{ background: theme === 'dark' ? '#2d2d30' : '#e5e7eb' }} />
            <span className="text-xs uppercase font-bold tracking-wider opacity-60"
                  style={{ color: theme === 'dark' ? '#71717a' : '#9ca3af' }}>
              {t('LOGIN.or')}
            </span>
            <span className="h-px flex-1" style={{ background: theme === 'dark' ? '#2d2d30' : '#e5e7eb' }} />
          </div>

          {/* Local Credentials Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                     style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                {t('LOGIN.email')}
              </label>
              <input
                type="email"
                {...register('username')}
                placeholder={t('LOGIN.email')}
                className="login-input"
              />
              {errors.username && (
                <p className="mt-1.5 text-xs text-red-500">
                  {t('LOGIN.email_required')}
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider"
                       style={{ color: theme === 'dark' ? '#a1a1aa' : '#4b5563' }}>
                  {t('LOGIN.password')}
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-xs font-bold hover:underline"
                  style={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                >
                  {t('LOGIN.forgot_password')}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••"
                  className="login-input"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500">
                  {t('LOGIN.password_required')}
                </p>
              )}
            </div>

            {/* Inline error banner — anchored inside the form, never overlaps hero image */}
            {loginError && (
              <div
                role="alert"
                className="flex items-start gap-3 px-4 py-3 rounded-[12px] text-sm font-medium"
                style={{
                  background: theme === 'dark' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: theme === 'dark' ? '#fca5a5' : '#b91c1c',
                  animation: 'fadeSlideIn 0.2s ease',
                }}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{loginError}</span>
                <button
                  type="button"
                  onClick={() => setLoginError(null)}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="login-submit-btn"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>{t('LOGIN.login')} <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {/* Onboarding Trigger */}
          <div className="text-center text-xs mt-6"
               style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>
            {t('LOGIN.not_a_user')}{' '}
            <button
              onClick={() => router.push('/signup')}
              className="hover:underline font-bold"
              style={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
            >
              {t('LOGIN.signup_free')}
            </button>
          </div>

        </div>

        {/* Local Styles for Premium Input Fields and Buttons */}
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
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

      {/* Right Panel: Auto-rotating Image Slideshow */}
      <AuthHeroSlider />
    </main>
  );
}

/* ── Slideshow sub-component ── */
const HERO_SLIDES = [
  { img: '/images/auth-hero-2.webp', title: 'Turn any screen into a display', sub: 'Manage widgets, slides and menus inside DSHub.' },
  { img: '/images/auth-hero-1.webp', title: 'Engage your audience everywhere', sub: 'Create layouts, build scheduling slots and pair unlimited players.' },
  { img: '/images/auth-hero-3.webp', title: 'Real-time content management', sub: 'Push content to hundreds of screens instantly from one dashboard.' },
  { img: '/images/auth-hero-4.webp', title: 'Beautiful digital signage, simplified', sub: 'Drag and drop playlists, set schedules and go live in minutes.' },
  { img: '/images/auth-hero-5.webp', title: 'Your brand, on every screen', sub: 'Keep all locations on-brand with centralised content and templates.' },
];

function AuthHeroSlider() {
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden md:flex flex-1 relative overflow-hidden items-end">
      {/* All images stacked — only opacity changes, no dark bg ever shows */}
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={slide.img}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('${slide.img}')`,
            backgroundColor: '#0B0B0C',
            opacity: i === current ? 1 : 0,
            transition: 'opacity 800ms ease-in-out',
            zIndex: i === current ? 1 : 0,
          }}
        />
      ))}

      {/* Strong bottom gradient so text is always readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" style={{ zIndex: 2 }} />

      {/* Slide dot indicators */}
      <div className="absolute top-6 right-6 flex gap-1.5" style={{ zIndex: 10 }}>
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === current ? '20px' : '6px',
              height: '6px',
              background: i === current ? '#fff' : 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </div>

      {/* Brand tag — pinned to bottom, always visible */}
      <div
        className="absolute left-10 bottom-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ zIndex: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        DSHub Digital Signage Platform
      </div>

      {/* Slide text — each absolutely positioned above the brand tag */}
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={slide.img}
          className="absolute left-10 right-10 bottom-24"
          style={{
            zIndex: 4,
            opacity: i === current ? 1 : 0,
            transition: 'opacity 600ms ease-in-out',
            pointerEvents: i === current ? 'auto' : 'none',
          }}
        >
          <h2 className="text-2xl font-extrabold tracking-tight text-white leading-tight">
            {slide.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {slide.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
