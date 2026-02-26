import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProcessList } from './components/ProcessList';
import { QuickActions } from './components/QuickActions';
import { LeakAlert } from './components/LeakAlert';
import { TitleBar } from './components/TitleBar';

type Tab = 'dashboard' | 'processes' | 'actions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'processes', label: 'Processes' },
  { id: 'actions', label: 'Quick Actions' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <nav className="flex gap-1 px-4 pt-2 pb-0 bg-mg-bg">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-mg-surface text-white border border-mg-border border-b-0'
                : 'text-mg-muted hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto bg-mg-surface border-t border-mg-border p-4">
        <LeakAlert />
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'processes' && <ProcessList />}
        {activeTab === 'actions' && <QuickActions />}
      </main>
    </div>
  );
}
