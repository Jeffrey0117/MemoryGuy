import { useEffect, Component, type ReactNode } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProcessList } from './components/ProcessList';
import { QuickActions } from './components/QuickActions';
import { GuardianPanel } from './components/GuardianPanel';
import { DevServers } from './components/DevServers';
import { StartupPanel } from './components/StartupPanel';
import { EnvVarsPanel } from './components/EnvVarsPanel';
import { DiskCleanup } from './components/DiskCleanup';
import { LeakAlert } from './components/LeakAlert';
import { TitleBar } from './components/TitleBar';
import { useAppStore } from './stores/app-store';
import { t } from './i18n';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-red-400 bg-mg-surface">
          <h2 className="text-lg font-bold mb-2">Render Error</h2>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error.message}</pre>
          <pre className="text-xs whitespace-pre-wrap text-mg-muted mt-2">{this.state.error.stack}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 bg-mg-primary text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type Tab = 'dashboard' | 'processes' | 'actions' | 'guardian' | 'devservers' | 'startup' | 'envvars' | 'diskcleanup';

const TAB_KEYS: { id: Tab; key: 'tab.dashboard' | 'tab.processes' | 'tab.actions' | 'tab.guardian' | 'tab.devservers' | 'tab.startup' | 'tab.envvars' | 'tab.diskcleanup' }[] = [
  { id: 'dashboard', key: 'tab.dashboard' },
  { id: 'processes', key: 'tab.processes' },
  { id: 'guardian', key: 'tab.guardian' },
  { id: 'devservers', key: 'tab.devservers' },
  { id: 'diskcleanup', key: 'tab.diskcleanup' },
  { id: 'startup', key: 'tab.startup' },
  { id: 'envvars', key: 'tab.envvars' },
  { id: 'actions', key: 'tab.actions' },
];

export function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const theme = useAppStore((s) => s.theme);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="h-screen flex flex-col bg-mg-bg text-mg-text">
      <TitleBar />
      <nav className="flex gap-1 px-4 pt-2 pb-0 bg-mg-bg">
        {TAB_KEYS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-mg-surface text-mg-text border border-mg-border border-b-0'
                : 'text-mg-muted hover:text-mg-text'
            }`}
          >
            {t(tab.key, locale)}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto bg-mg-surface border-t border-mg-border p-4">
        <LeakAlert />
        <ErrorBoundary>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'processes' && <ProcessList />}
          {activeTab === 'actions' && <QuickActions />}
          {activeTab === 'guardian' && <GuardianPanel />}
          {activeTab === 'devservers' && <DevServers />}
          {activeTab === 'startup' && <StartupPanel />}
          {activeTab === 'envvars' && <EnvVarsPanel />}
          {activeTab === 'diskcleanup' && <DiskCleanup />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
