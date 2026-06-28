'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderHeart,
  CalendarRange,
  Monitor,
  FileVideo,
  Palette,
  User,
  Users,
  CreditCard,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useDSStore } from '@/store/useDSStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import Image from 'next/image';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  action?: 'INVITE_USER' | 'MANAGE_BILLING' | 'PAIR_SCREEN' | 'CREATE_CONTENT';
}

export const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isSidebarOpen = useDSStore((state) => state.isSidebarOpen);
  const toggleSidebar = useDSStore((state) => state.toggleSidebar);
  const setSidebarOpen = useDSStore((state) => state.setSidebarOpen);
  const theme = useDSStore((state) => state.theme);
  const { canPerform } = usePermissions();

  const { t } = useLanguage();

  // Collapse sidebar on mobile mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const handleNav = (path: string) => {
    router.push(path);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const coreItems: SidebarItem[] = [
    { name: t('MENUITEMS.SIDEBAR.dashboard'),    path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { name: t('MENUITEMS.SIDEBAR.content_mang'), path: '/content',   icon: <FileVideo size={18} /> },
    { name: t('MENUITEMS.SIDEBAR.playlists'),    path: '/playlists', icon: <FolderHeart size={18} /> },
    { name: t('MENUITEMS.SIDEBAR.scheduling'),   path: '/schedules', icon: <CalendarRange size={18} /> },
    { name: t('MENUITEMS.SIDEBAR.screens'),      path: '/screens',   icon: <Monitor size={18} /> },
    { name: t('MENUITEMS.SIDEBAR.templates'),    path: '/templates', icon: <Palette size={18} /> },
  ];

  const settingItems: SidebarItem[] = [
    { name: t('MENUITEMS.SIDEBAR.myAccount'),  path: '/my-account', icon: <User size={18} /> },
    { name: t('MENUITEMS.SIDEBAR.users'),      path: '/users',      icon: <Users size={18} />, action: 'INVITE_USER' },
    { name: t('MENUITEMS.SIDEBAR.subscription'), path: '/billing',  icon: <CreditCard size={18} /> },
    { name: t('MENUITEMS.SIDEBAR.location'),   path: '/locations',  icon: <MapPin size={18} /> },
  ];

  // Use theme-aware classes
  const isLight = theme === 'light';

  const renderItem = (item: SidebarItem) => {
    if (item.action && !canPerform(item.action)) return null;

    const isActive =
      pathname === item.path ||
      (item.path !== '/dashboard' && pathname.startsWith(item.path));

    return (
      <button
        key={item.path}
        onClick={() => handleNav(item.path)}
        style={isActive ? {
          background: 'var(--nav-active-bg)',
          color: 'var(--nav-active-text)',
        } : {
          color: 'var(--text-muted)',
          background: 'transparent',
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all sidebar-nav-btn${isActive ? ' nav-item-active' : ''}`}
      >
        <span className="shrink-0">{item.icon}</span>
        {isSidebarOpen && <span className="truncate">{item.name}</span>}
      </button>
    );
  };

  return (
    <aside
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
      className={`h-screen fixed md:sticky top-0 left-0 flex flex-col justify-between transition-all duration-300 z-40 relative ${
        isSidebarOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full md:translate-x-0'
      }`}
    >
      <div className="flex flex-col overflow-y-auto flex-1 py-6 px-4 gap-8">

        {/* Branding header + toggle arrow */}
        <div className="flex flex-col gap-3">
          {/* Logo row */}
          <div className={`flex items-center px-2 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <Image
                src={theme === 'dark' ? '/images/DS_b.png' : '/images/DS_w.png'}
                alt="DSHub Logo"
                width={110}
                height={36}
                className="object-contain cursor-pointer"
                onClick={() => handleNav('/dashboard')}
                priority
              />
            ) : (
              <Image
                src={theme === 'dark' ? '/images/DS_black_s.png' : '/images/DS_white_s.png'}
                alt="DS"
                width={32}
                height={32}
                className="object-contain cursor-pointer"
                onClick={() => handleNav('/dashboard')}
                priority
              />
            )}
          </div>

          {/* Toggle arrow — just below the logo, right-aligned in expanded / centered in collapsed */}
          <div className={`flex px-2 ${isSidebarOpen ? 'justify-end' : 'justify-center'}`}>
            <button
              onClick={toggleSidebar}
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
              className="p-1 rounded-lg transition-all hidden md:flex items-center justify-center sidebar-toggle-btn"
            >
              {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>

        {/* Navigation Core */}
        <div className="flex flex-col gap-1">
          {coreItems.map(renderItem)}
        </div>

        {/* Separator */}
        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Settings list */}
        <div className="flex flex-col gap-1">
          {isSidebarOpen && (
            <p style={{ color: 'var(--text-muted)' }}
               className="text-[10px] uppercase font-bold tracking-widest mb-2 px-4 opacity-50">
              Settings &amp; Admin
            </p>
          )}
          {settingItems.map(renderItem)}
        </div>

      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.2)',
        }}
        className="p-4 text-center"
      >
        {isSidebarOpen ? (
          <p style={{ color: 'var(--text-muted)' }} className="text-[10px] font-medium opacity-40">
            © 2026 DShub Portal
          </p>
        ) : (
          <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-medium opacity-40">
            v1.0
          </span>
        )}
      </div>

      <style>{`
        .sidebar-nav-btn:hover:not(.nav-item-active) {
          background: var(--sidebar-hover) !important;
          color: var(--text) !important;
        }
        .nav-item-active {
          box-shadow: inset 3px 0 0 var(--nav-active-indicator);
        }
        .nav-item-active .shrink-0 {
          color: var(--nav-active-text);
        }
        .sidebar-toggle-btn:hover {
          border-color: var(--border-color) !important;
          color: var(--text) !important;
        }
      `}</style>
    </aside>
  );
};
export default Sidebar;
