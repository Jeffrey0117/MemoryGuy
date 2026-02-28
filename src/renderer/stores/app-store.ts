import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '../i18n';

export type Theme = 'dark' | 'light';
type Tab = 'dashboard' | 'processes' | 'actions' | 'guardian' | 'devservers' | 'startup' | 'envvars' | 'diskcleanup' | 'virtualize';

interface AppStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  theme: Theme;
  toggleTheme: () => void;
  locale: Locale;
  toggleLocale: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      activeTab: 'dashboard' as Tab,
      setActiveTab: (tab: Tab) => set({ activeTab: tab }),
      theme: 'light' as Theme,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      locale: 'zh' as Locale,
      toggleLocale: () => set((s) => ({ locale: s.locale === 'en' ? 'zh' : 'en' })),
    }),
    {
      name: 'memoryguy-prefs',
      partialize: (state) => ({
        activeTab: state.activeTab,
        theme: state.theme,
        locale: state.locale,
      }),
    },
  ),
);
