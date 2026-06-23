'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function PasswordResetPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0B0B0C]">
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-white/5 space-y-6 shadow-2xl">
        <h1 className="text-xl font-display font-bold text-foreground">Reset Password</h1>
        <p className="text-xs text-muted-foreground">Please configure your new account password below.</p>
        <button onClick={() => router.push('/signin')} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs transition-all hover:bg-primary/95">
          Go to Sign In
        </button>
      </div>
    </main>
  );
}
