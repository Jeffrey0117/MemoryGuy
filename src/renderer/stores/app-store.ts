import { create } from 'zustand';

type Tab = 'dashboard' | 'processes' | 'actions';

interface AppStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const useAppStore = create<AppStore>()((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
