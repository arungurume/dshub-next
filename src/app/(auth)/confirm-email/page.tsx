'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function ConfirmEmailPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0B0B0C]">
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-white/5 space-y-6 text-center shadow-2xl">
        <h1 className="text-xl font-display font-bold text-foreground">Confirming Email</h1>
        <p className="text-xs text-muted-foreground">Verifying validation token with UMS Subsystem...</p>
        <button onClick={() => router.push('/signin')} className="text-xs text-primary hover:underline font-semibold">
          Return to Sign In
        </button>
      </div>
    </main>
  );
}
