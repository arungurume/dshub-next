import { create } from 'zustand';

export interface UserRole {
  id: number;
  name: string;
}

export interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: UserRole[];
  organizationId: number;
  locationId: number;
  profilePictureUrl?: string;
  token?: string;
  organization?: any;
}

export interface LocationInfo {
  id: number;
  name: string;
  organizationId: number;
  timezone?: string;
  address?: string;
}

interface DSState {
  currentUser: UserProfile | null;
  currentLocation: LocationInfo | null;
  isSidebarOpen: boolean;
  theme: 'dark' | 'light';

  // Actions
  setCurrentUser: (user: UserProfile | null) => void;
  setCurrentLocation: (location: LocationInfo | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  clearStore: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

export const useDSStore = create<DSState>((set) => ({
  currentUser: null,
  currentLocation: null,
  isSidebarOpen: true,
  theme: 'light',

  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  clearStore: () => set({ currentUser: null, currentLocation: null }),

  setTheme: (theme) => {
    if (typeof window !== 'undefined') localStorage.setItem('ds-theme', theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') localStorage.setItem('ds-theme', next);
      return { theme: next };
    }),
}));
