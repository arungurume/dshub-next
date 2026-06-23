'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/shared/Sidebar';
import Header from '@/components/shared/Header';
import { useDSStore } from '@/store/useDSStore';
import { Loader2 } from 'lucide-react';
import { getCookie } from '@/lib/api';
import { LanguageProvider } from '@/context/LanguageContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useDSStore((state) => state.currentUser);
  const setCurrentUser = useDSStore((state) => state.setCurrentUser);
  const setCurrentLocation = useDSStore((state) => state.setCurrentLocation);
  
  const isSidebarOpen = useDSStore((state) => state.isSidebarOpen);
  const toggleSidebar = useDSStore((state) => state.toggleSidebar);
  
  const [isHydrated, setIsHydrated] = useState(false);

  // Sync localStorage profile to Zustand on mount
  useEffect(() => {
    const token = getCookie('token');
    
    if (!token) {
      router.replace('/signin');
      return;
    }

    const storedUserStr = localStorage.getItem('currentUser');
    if (storedUserStr) {
      try {
        const storedUser = JSON.parse(storedUserStr);
        setCurrentUser(storedUser);

        // Hydrate default location
        if (storedUser.organization?.locations?.length > 0) {
          const defaultLoc = storedUser.organization.locations.find(
            (loc: any) => loc.id === storedUser.locationId
          ) || storedUser.organization.locations[0];
          setCurrentLocation(defaultLoc);
        }
      } catch (err) {
        console.error('State hydration from localStorage failed:', err);
      }
    }
    
    setIsHydrated(true);
  }, [router, setCurrentUser, setCurrentLocation]);

  if (!isHydrated || !currentUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4"
           style={{ backgroundColor: 'var(--loader-bg)' }}>
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Loading Dashboard Context...
        </p>
      </div>
    );
  }

  return (
    <LanguageProvider>
    <div className="min-h-screen flex overflow-hidden" style={{ backgroundColor: 'var(--bg-layout)' }}>

      {/* Collapsible Left Sidebar */}
      <Sidebar />

      {/* Backdrop overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/50 z-30 block md:hidden"
        />
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Dynamic Context Header */}
        <Header />

        {/* Dynamic Nested Viewports */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-base)' }}>
          {children}
        </main>

      </div>
    </div>
    </LanguageProvider>
  );
}
