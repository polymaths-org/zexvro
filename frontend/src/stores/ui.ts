import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeType, DensityType } from '../types';

interface UIState {
  theme: ThemeType;
  density: DensityType;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  setTheme: (theme: ThemeType) => void;
  setDensity: (density: DensityType) => void;
  setReducedMotion: (value: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      density: 'comfortable',
      reducedMotion: false,
      sidebarCollapsed: false,

      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: 'zexvro_ui' }
  )
);
