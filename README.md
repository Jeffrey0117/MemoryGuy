# MemoryGuy

A lightweight Windows system resource monitor built with Electron. Tracks RAM/CPU usage in real-time, detects memory leaks using statistical analysis, and reclaims memory safely without killing processes.

## Features

**Real-time Monitoring**
- RAM and CPU usage gauges with 30-minute rolling history charts
- Per-process memory/CPU tracking with trend indicators (rising/falling/stable)
- Process grouping, sorting, and search

**Memory Leak Detection**
- Statistical leak detection using linear regression with R-squared validation
- Two-tier severity: suspect (1+ MB/min for 5+ min) and critical (5+ MB/min for 2+ min)
- Real-time alerts with one-click process termination

**Safe Memory Optimization**
- One-click memory reclaim using Windows `EmptyWorkingSet` API -- no processes killed
- Smart recommendations: only flags real memory leaks and idle high-RAM processes
- Multi-process app awareness (Chrome, VS Code, Edge shown as summaries, not kill targets)
- Auto-protect: automatically trims working sets when RAM exceeds configurable threshold

**UI**
- Dark theme (matte black) and light theme (off-white) with toggle
- English / Chinese (Traditional) language switching
- Frameless window with custom title bar

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 28 |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Charts | Recharts |
| State | Zustand |
| System Info | systeminformation |
| Memory Trim | PowerShell + Win32 EmptyWorkingSet API |
| Build | Vite, Electron Forge |

## Getting Started

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build for distribution
npm run make
```

Requires: Node.js 18+, Windows 10/11, PowerShell 5.1+

## Architecture

```
src/
  main/                     # Electron main process
    index.ts                # App entry, window creation
    ipc-handlers.ts         # IPC bridge with input validation
    services/
      system-monitor.ts     # RAM/CPU polling (1s interval)
      process-monitor.ts    # Process list with trend tracking (2s interval)
      memory-tracker.ts     # Leak detection via linear regression (30s checks)
      optimizer.ts          # 3-tier optimizer: trim / recommend / manual kill
      process-killer.ts     # taskkill + EmptyWorkingSet via PowerShell
  preload/
    index.ts                # Context bridge (contextIsolation: true)
  renderer/
    App.tsx                 # Tab navigation, theme/locale provider
    i18n.ts                 # Translation strings (en/zh)
    stores/app-store.ts     # Zustand store (tab, theme, locale)
    components/
      Dashboard.tsx         # Gauges + history charts
      ProcessList.tsx       # Sortable/searchable/groupable process table
      QuickActions.tsx      # 3-tier optimizer UI
      LeakAlert.tsx         # Global leak notification banner
      SystemGauge.tsx       # SVG semicircle gauge
      MemoryChart.tsx       # Recharts line chart
  shared/
    types.ts                # Shared TypeScript interfaces
    constants.ts            # IPC channels, thresholds, protected process list
```

## How Optimization Works

| Tier | Action | Risk |
|------|--------|------|
| 1 | **Trim Working Sets** -- calls `EmptyWorkingSet` via PowerShell to release unused memory pages | None -- processes continue running |
| 2 | **Recommendations** -- flags memory leaks (statistical) and idle high-RAM processes | User decides whether to act |
| 3 | **Manual Kill** -- explicit process termination with confirmation | Data loss possible |

The optimizer never pre-selects processes for killing. System-critical processes and the app itself are always protected.

## License

MIT
