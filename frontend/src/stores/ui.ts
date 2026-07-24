import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeType, DensityType } from '../types';

export type OverviewWidgetId = 'projects' | 'stats' | 'wallet' | 'actions';

export const DEFAULT_OVERVIEW_WIDGETS: Record<OverviewWidgetId, boolean> = {
  projects: true,
  stats: true,
  wallet: true,
  actions: true,
};

interface UIState {
  theme: ThemeType;
  density: DensityType;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  /** Workspace overview section visibility (AWS-style customize). */
  overviewWidgets: Record<OverviewWidgetId, boolean>;
  setTheme: (theme: ThemeType) => void;
  setDensity: (density: DensityType) => void;
  setReducedMotion: (value: boolean) => void;
  toggleSidebar: () => void;
  setOverviewWidget: (id: OverviewWidgetId, visible: boolean) => void;
  resetOverviewWidgets: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      density: 'comfortable',
      reducedMotion: false,
      sidebarCollapsed: false,
      overviewWidgets: { ...DEFAULT_OVERVIEW_WIDGETS },

      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setOverviewWidget: (id, visible) =>
        set(state => ({
          overviewWidgets: { ...state.overviewWidgets, [id]: visible },
        })),
      resetOverviewWidgets: () => set({ overviewWidgets: { ...DEFAULT_OVERVIEW_WIDGETS } }),
    }),
    {
      name: 'zexvro_ui',
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<UIState>;
        return {
          ...current,
          ...p,
          overviewWidgets: {
            ...DEFAULT_OVERVIEW_WIDGETS,
            ...(p.overviewWidgets || {}),
          },
        };
      },
    },
  ),
);
