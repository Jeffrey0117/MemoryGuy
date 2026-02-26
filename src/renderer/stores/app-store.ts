import { create } from 'zustand';
import type { Locale } from '../i18n';

export type Theme = 'dark' | 'light';
type Tab = 'dashboard' | 'processes' | 'actions' | 'guardian' | 'devservers';

interface AppStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  theme: Theme;
  toggleTheme: () => void;
  locale: Locale;
  toggleLocale: () => void;
}

export const useAppStore = create<AppStore>()((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  theme: 'dark',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  locale: 'en',
  toggleLocale: () => set((s) => ({ locale: s.locale === 'en' ? 'zh' : 'en' })),
}));
