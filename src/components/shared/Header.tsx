'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronDown, User, MapPin, Building2, Bell, Sun, Lightbulb, Menu, ShieldAlert } from 'lucide-react';
import { useDSStore } from '@/store/useDSStore';
import { umsApi, removeCookie, setCookie, cmsApiV2 } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import EditOrganizationModal from './EditOrganizationModal';
import TrialExpiredUpgradeModal from './TrialExpiredUpgradeModal';

export const Header: React.FC = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const currentUser = useDSStore((state) => state.currentUser);
  const currentLocation = useDSStore((state) => state.currentLocation);
  const setCurrentLocation = useDSStore((state) => state.setCurrentLocation);
  const clearStore = useDSStore((state) => state.clearStore);
  const theme = useDSStore((state) => state.theme);
  const toggleTheme = useDSStore((state) => state.toggleTheme);
  const toggleSidebar = useDSStore((state) => state.toggleSidebar);

  const [locations, setLocations] = useState<any[]>([]);
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);

  // Load locations on mount from organization profile
  useEffect(() => {
    if (currentUser?.organization?.locations) {
      setLocations(currentUser.organization.locations);
      
      // Select default location if not set in Zustand
      if (!currentLocation && currentUser.organization.locations.length > 0) {
        const defaultLoc = currentUser.organization.locations.find(
          (loc: any) => loc.id === currentUser.locationId
        ) || currentUser.organization.locations[0];
        
        setCurrentLocation(defaultLoc);
      }
    }
  }, [currentUser, currentLocation, setCurrentLocation]);

  const [isTrialPlan, setIsTrialPlan] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [isTrialEnded, setIsTrialEnded] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [trialScreens, setTrialScreens] = useState<any[]>([]);
  useEffect(() => {
    cmsApiV2.get('/sac/my/plan')
      .then(({ data }) => {
        const type = data.planType || '';
        const isTrial = type === 'TRIAL_PLAN';
        const ended = !!data.trialExpired;
        const totalScreens = data.totalEntitlementScreens || 0;
        
        setIsTrialPlan(isTrial);
        setIsTrialEnded(ended);
        setTotalEntitlementScreens(totalScreens);
        setTrialScreens(data?.trialScreens ?? []);
        
        if (isTrial && data.trialEndAt) {
          const diffTime = new Date(data.trialEndAt).getTime() - Date.now();
          setTrialDaysLeft(Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))));
        }
      })
      .catch(() => {});
  }, []);

  const handleLocationSwitch = async (location: any) => {
    setIsLocationMenuOpen(false);
    if (currentLocation?.id === location.id) return;

    const toastId = toast.loading(`Switching location context to ${location.name}...`);
    try {
      // API call to UMS to swap location token scope
      const response = await umsApi.get(`/auth/change-location/${location.id}/refresh-token`);
      const updatedUser = response.data;

      // Update cookie tokens and store
      setCookie('token', updatedUser.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', updatedUser.token);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        localStorage.setItem('role', updatedUser.roles[0].name);
      }
      
      setCurrentLocation(location);
      toast.success(`Location switched to ${location.name}`, { id: toastId });

      // Hard reload page to clear all cache states in later stages
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to switch location scope:', err);
      toast.error('Failed to switch location. Please try again.', { id: toastId });
    }
  };

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    try {
      await umsApi.get('/auth/signout');
    } catch (err) {
      // Ignore network errors on signout
      console.warn('Signout endpoint failure (non-blocking):', err);
    } finally {
      // Clean up client states
      removeCookie('token');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentUserOrg');
        localStorage.removeItem('role');
        localStorage.removeItem('firstName');
        localStorage.removeItem('profilePictureUrl');
      }
      clearStore();
      toast.success('Logged out successfully');
      router.push('/signin');
    }
  };

  return (
    <>
    <header className="glass-panel border-b border-white/5 h-16 sticky top-0 flex items-center justify-between px-6 z-[25]">
      
      {/* Organization display */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg border border-white/10 hover:border-primary/40 block md:hidden mr-1 text-muted-foreground hover:text-foreground transition-all"
          title="Toggle Sidebar"
          id="mobile-sidebar-toggle"
        >
          <Menu size={16} />
        </button>
        <Building2 size={16} className="text-muted-foreground" />
        {(!currentUser?.organization?.name || currentUser.organization.name === 'My Organization') ? (
          <button
            onClick={() => setShowEditOrg(true)}
            className="flex items-center gap-1 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md"
            title={t('DASHBOARD.click_to_update_org', 'Click to update organization details')}
          >
            {t('DASHBOARD.update_org_info', 'Update Org Info ↗')}
          </button>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {currentUser.organization.name}
          </span>
        )}
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-4">
        
        {/* Trial Badge */}
        {isTrialPlan && (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className={`flex flex-col justify-center px-3 py-1.5 rounded-lg border transition-all min-w-[130px] ${
              isTrialEnded 
                ? 'bg-destructive/10 border-destructive/20 hover:bg-destructive/20 cursor-pointer' 
                : 'bg-primary/5 border-primary/20 hover:bg-primary/10 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isTrialEnded ? 'text-destructive' : 'text-primary'}`}>
                {isTrialEnded ? 'Trial Ended' : 'Free Trial'}
              </span>
              <span className={`text-[10px] font-bold ${isTrialEnded ? 'text-destructive' : 'text-muted-foreground'}`}>
                {isTrialEnded ? '0 days' : `${trialDaysLeft} days left`}
              </span>
            </div>
            <div className="w-full bg-black/20 dark:bg-white/10 rounded-full h-1 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${isTrialEnded ? 'bg-destructive' : trialDaysLeft <= 3 ? 'bg-amber-500' : 'bg-primary'}`} 
                style={{ width: `${Math.min(100, Math.max(0, (isTrialEnded ? 0 : trialDaysLeft) / 14 * 100))}%` }}
              />
            </div>
          </button>
        )}

        {/* Location selector dropdown */}
        {locations.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsLocationMenuOpen(!isLocationMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-foreground transition-all hover:bg-white/10"
            >
              <MapPin size={14} className="text-primary" />
              <span className="font-semibold truncate max-w-[120px]">
                {currentLocation?.name || locations[0].name}
              </span>
              <ChevronDown size={12} />
            </button>

            {isLocationMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl border shadow-2xl animate-in fade-in slide-in-from-top-1 duration-100 overflow-hidden flex flex-col"
                 style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                <p className="text-[10px] uppercase font-bold text-muted-foreground/40 tracking-widest px-4 py-2 bg-black/10 dark:bg-white/5">
                  Change Location
                </p>
                <div className="max-h-48 overflow-y-auto py-1">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleLocationSwitch(loc)}
                      className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors ${
                        currentLocation?.id === loc.id ? 'text-primary font-bold bg-white/[0.01]' : 'text-muted-foreground'
                      }`}
                    >
                      <MapPin size={12} />
                      <span className="truncate">{loc.name || 'Unnamed'}</span>
                    </button>
                  ))}
                </div>
                <div className="p-1.5 border-t border-white/10 bg-black/5 dark:bg-white/5">
                  <button
                    onClick={() => { setIsLocationMenuOpen(false); router.push('/locations/0'); }}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 text-primary font-bold hover:bg-white/10 rounded-md transition-colors"
                  >
                    <div className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center">
                      <span className="text-primary text-[10px] leading-none">+</span>
                    </div>
                    <span>Add Location</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all">
          <Bell size={16} />
        </button>

        {/* Theme toggle */}
        <button
          id="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid var(--border)',
            background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
            cursor: 'pointer', color: 'var(--text-muted)',
            transition: 'all 0.2s',
          }}
        >
          {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Lightbulb size={15} strokeWidth={1.8} />}
        </button>

        {/* Profile menu */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-full bg-white/5 border border-white/10 hover:border-primary/40 transition-all"
          >
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display font-bold text-xs uppercase overflow-hidden">
              {currentUser?.profilePictureUrl ? (
                <img src={currentUser.profilePictureUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                currentUser?.firstName?.[0] || <User size={14} />
              )}
            </div>
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-48 rounded-xl border py-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-100"
                 style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <div className="px-4 py-2 border-b border-white/5 mb-1.5">
                <p className="text-xs font-semibold text-foreground truncate">
                  {currentUser?.firstName} {currentUser?.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{currentUser?.email}</p>
              </div>
              <button
                onClick={() => { setIsProfileMenuOpen(false); router.push('/my-account'); }}
                className="w-full text-left px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center gap-2 transition-colors"
              >
                <User size={12} />
                My Account
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-xs text-destructive hover:bg-white/5 flex items-center gap-2 transition-colors border-t border-white/5 mt-1.5 pt-2"
              >
                <LogOut size={12} />
                Log Out
              </button>
            </div>
          )}
        </div>

      </div>

    </header>

      <EditOrganizationModal
        open={showEditOrg}
        onClose={() => setShowEditOrg(false)}
      />

      {showUpgradeModal && (
        <TrialExpiredUpgradeModal trialScreens={trialScreens} onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
};
export default Header;
