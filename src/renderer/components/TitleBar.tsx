import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';

const api = (window as unknown as { memoryGuy: import('@shared/types').MemoryGuyAPI }).memoryGuy;

export function TitleBar() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const locale = useAppStore((s) => s.locale);
  const toggleLocale = useAppStore((s) => s.toggleLocale);
  const [maximized, setMaximized] = useState(false);

  const refreshMaximized = useCallback(() => {
    api.windowIsMaximized().then(setMaximized).catch(() => {});
  }, []);

  useEffect(() => {
    refreshMaximized();
    // Refresh on resize since user can double-click title bar or snap windows
    window.addEventListener('resize', refreshMaximized);
    return () => window.removeEventListener('resize', refreshMaximized);
  }, [refreshMaximized]);

  const handleMinimize = () => { api.windowMinimize(); };
  const handleMaximize = () => {
    api.windowMaximize().then(() => refreshMaximized());
  };
  const handleClose = () => { api.windowClose(); };

  return (
    <div className="drag-region flex items-center justify-between h-9 bg-mg-bg px-4 select-none shrink-0">
      <span className="text-xs font-bold text-mg-muted tracking-wider">MEMORYGUY</span>

      <div className="flex items-center gap-1 no-drag">
        {/* Language toggle */}
        <button
          onClick={toggleLocale}
          className="text-xs text-mg-muted hover:text-mg-text transition-colors px-2 py-1 rounded hover:bg-mg-border/50"
          title="Switch language"
        >
          {locale === 'en' ? 'ZH' : 'EN'}
        </button>

        {/* Theme toggle: sun = switch to light, moon = switch to dark */}
        <button
          onClick={toggleTheme}
          className="w-7 h-7 flex items-center justify-center text-mg-muted hover:text-mg-text transition-colors rounded hover:bg-mg-border/50"
          title="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <span className="text-xs text-mg-muted mx-1">v0.1.0</span>

        {/* Window control separator */}
        <div className="w-px h-4 bg-mg-border mx-1" />

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center text-mg-muted hover:text-mg-text hover:bg-mg-border/50 rounded transition-colors"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center text-mg-muted hover:text-mg-text hover:bg-mg-border/50 rounded transition-colors"
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" rx="0.5" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" fill="var(--mg-bg)" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center text-mg-muted hover:text-white hover:bg-red-600 rounded transition-colors"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
