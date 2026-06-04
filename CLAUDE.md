# MemoryGuy

Electron desktop app — your dev environment's bodyguard. Monitors system/process memory, detects leaks, scans dev servers, protects processes from accidental kills (including by AI tools), and virtualizes large files to cloud-backed pointers.

## Stack

- **Runtime**: Electron 28 (main + preload + renderer)
- **Language**: TypeScript (strict)
- **UI**: React 18, Tailwind CSS, Recharts (charts)
- **State**: Zustand (`renderer/stores/app-store.ts`)
- **System info**: `systeminformation` + per-platform shell ops (PowerShell on Win32)
- **Validation**: zod
- **Build**: Vite + Electron Forge (Squirrel maker; ZIP for darwin/linux). NSIS installer in `installer/`
- **Platform**: Windows 10/11 primary (PowerShell 5.1+). macOS (`darwin`) platform layer exists but partial.

## Directory structure

```
src/
  main/
    index.ts            ← Main process entry: instantiates all services, wires IPC, lifecycle
    ipc-handlers.ts     ← Central IPC handler registration (all channels)
    tray.ts             ← System tray
    services/           ← All business logic (one class per concern, start()/stop() lifecycle)
      system-monitor, process-monitor, memory-tracker (leak detection via linear regression)
      process-guardian, protection-store, process-killer  ← guardian / safe-kill
      port-scanner, dev-server-manager                    ← dev server dashboard + auto-restart
      optimizer                                           ← 3-tier memory optimization (trim/recommend/kill)
      hook-generator                                      ← generates Claude Code PreToolUse kill-block hook
      disk-cleaner, disk-watchdog, disk-virtualizer       ← disk space tools
      refile/, refile-watcher.ts                          ← file virtualization (.repic/.revid/.remusic/.refile)
      startup-manager, env-reader, hardware-profiler, software-manager
      telegram-notifier                                   ← optional notifications
      platform/{win32,darwin}/                            ← OS-specific ops behind a shared interface
  preload/index.ts      ← contextBridge API exposed to renderer (contextIsolation: true)
  renderer/
    App.tsx, index.tsx, i18n.ts
    components/          ← React UI (Dashboard, DevServers, GuardianPanel, DiskVirtualize, etc.)
    hooks/              ← Data hooks wrapping IPC (useProcessList, useLeakDetection, useDevServers...)
    stores/app-store.ts ← Zustand store
  shared/
    constants.ts        ← IPC channel names + all tuning thresholds
    types.ts            ← Shared TS types across processes
```

## Key concepts

- **Service architecture**: Each feature is a service class in `main/services/` with `start()`/`stop()`. All are instantiated in `index.ts` and injected into `setupIpcHandlers`. Stop order in `before-quit` matters (notification sources stopped first to avoid shutdown bursts).
- **IPC contract**: All channel names live in `shared/constants.ts` (`IPC` object). Renderer ↔ main only through preload's contextBridge. `ON_*` channels are main→renderer push events.
- **Platform abstraction**: OS-specific work (process/port/disk/env ops) lives in `services/platform/{win32,darwin}/` behind `platform/types.ts`; consumed via `platform/index.ts`.
- **Leak detection**: `memory-tracker` uses linear regression + R-squared on per-process RAM history. Thresholds in `constants.ts` (suspect = 1MB/min/5min, critical = 5MB/min/2min).
- **Process Guardian**: Protected processes never killed by MemoryGuy; `hook-generator` writes `~/.claude/hooks/block-process-kill.js` + registers it in `~/.claude/settings.json` so AI tools can't kill them either.
- **File virtualization (refile)**: Replaces large files with ~200-byte JSON pointers (cloud URL + SHA-256 + metadata). Backends in `services/refile/backends/`. Registry tracks all virtualized files; `refile-watcher` watches folders.
- **Crash logging**: `index.ts` writes uncaught exceptions/rejections to `crash.log` then quits.

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run app in dev (runs `prestart` → builds preload, then `electron-forge start`) |
| `npm run build:preload` | esbuild bundle of preload to `dist/preload.js` |
| `npm run package` | Package app → `out/MemoryGuy-win32-x64/` |
| `npm run make` | Build Squirrel.Windows installer |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src` (.ts/.tsx) |

NSIS installer (bundles optional REPIC/REVID companions): `npm run package` then `installer\build.bat` → `installer/MemoryGuy-Setup.exe`.

## Coding rules

- **Immutability**: create new objects, never mutate.
- **Files small & focused** (<800 lines), organized by feature/concern.
- **Security**: contextIsolation on, nodeIntegration off; validate inputs with zod; spawn with care.
- **No console.log** (use `console.error` for real errors only).
- Keep IPC channel names centralized in `shared/constants.ts` — never hardcode channel strings.
