import { useAppStore } from '../stores/app-store';

export function TitleBar() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const locale = useAppStore((s) => s.locale);
  const toggleLocale = useAppStore((s) => s.toggleLocale);

  return (
    <div className="drag-region flex items-center justify-between h-8 bg-mg-bg px-4 select-none">
      <span className="text-xs font-bold text-mg-muted tracking-wider">MEMORYGUY</span>
      <div className="flex items-center gap-3 no-drag">
        <button
          onClick={toggleLocale}
          className="text-xs text-mg-muted hover:text-mg-text transition-colors px-1"
          title="Switch language"
        >
          {locale === 'en' ? 'ZH' : 'EN'}
        </button>
        <button
          onClick={toggleTheme}
          className="text-xs text-mg-muted hover:text-mg-text transition-colors px-1"
          title="Toggle theme"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <span className="text-xs text-mg-muted">v0.1.0</span>
      </div>
    </div>
  );
}
