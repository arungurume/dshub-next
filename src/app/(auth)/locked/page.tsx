'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function LockedPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0B0B0C]">
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-white/5 space-y-6 text-center shadow-2xl">
        <h1 className="text-xl font-display font-bold text-destructive">Account Locked</h1>
        <p className="text-xs text-muted-foreground">Your account has been locked due to security parameters. Contact your organization administrator.</p>
        <button onClick={() => router.push('/signin')} className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-muted-foreground font-semibold text-xs transition-all hover:bg-white/10">
          Back to Login
        </button>
      </div>
    </main>
  );
}
