# MemoryGuy

**Your dev environment's bodyguard.**

Running 7 services on different ports? MemoryGuy watches them all — detects memory leaks, reclaims RAM without killing anything, scans your dev servers, and generates Claude Code hooks that **prevent AI from accidentally nuking your processes**.

## The Problem

You're running CloudPipe (port 8787), Next.js (3000), Express (4001-4006), and Claude Code — all Node.js. Something's eating RAM. You open Task Manager and see 20 `node.exe` processes. Which is which? You can't tell.

You run `taskkill /IM node.exe`. Everything dies. CloudPipe. Claude Code. Your unsaved work. All gone.

**MemoryGuy makes sure that never happens.**

## What It Does

### Dev Server Dashboard

Built-in port scanner that auto-discovers every running dev server (port 3000-9999):

- **Auto-detect** Node, Bun, Deno, Python, Ruby, Java, Go, PHP, .NET
- **Server cards** showing port, process name, PID, HTTP status, page title, RAM, CPU
- **One-click open** in browser
- **One-click protect** — add to guardian rules directly from the card
- **Safe kill** with confirmation dialog (no accidental kills)
- Search and filter across all servers

### Memory Leak Detection

Statistical leak detection using linear regression with R-squared validation:

| Severity | Trigger | Example |
|----------|---------|---------|
| **Suspect** | 1+ MB/min for 5+ min | Next.js dev server slowly leaking |
| **Critical** | 5+ MB/min for 2+ min | Runaway build process eating RAM fast |

Real-time alerts. One-click action. No false positives.

### Safe Memory Optimization

3-tier system — the optimizer **never pre-selects processes for killing**:

| Tier | Action | Risk |
|------|--------|------|
| 1 | **Trim Working Sets** — `EmptyWorkingSet` API releases unused pages | None. Processes keep running |
| 2 | **Recommendations** — flags leaks and idle high-RAM processes | You decide |
| 3 | **Manual Kill** — explicit termination with confirmation | Your call |

Multi-process aware: Chrome, VS Code, Edge shown as group summaries, not individual kill targets.

### Process Guardian

Mark any process as **protected** or **watched**:

- **Protected** — MemoryGuy will never touch it + generates hooks to prevent other tools from killing it
- **Watched** — monitors and alerts you if it gets terminated (by anything)
- **Event log** — tracks all termination events with timestamps
- **Desktop notifications** — instant alert when a watched process dies
- **Built-in rules** — system-critical processes (explorer, csrss, lsass, dwm) always protected

### Claude Code Hook Generator

**This is the bridge to the ecosystem.**

One click generates a `PreToolUse` hook for Claude Code that blocks dangerous kill commands targeting your protected processes:

```
You:       protect node.exe, python.exe in MemoryGuy
MemoryGuy: generates ~/.claude/hooks/block-process-kill.js
MemoryGuy: auto-registers in ~/.claude/settings.json

Claude:    "Let me clean up — taskkill /IM node.exe"
Hook:      BLOCKED. Command targets a protected process.
```

Your AI assistant can't accidentally kill your services. It works with Claude Code, ClaudeBot, or any tool that uses Claude Code hooks.

### Disk Virtualization

Replace large local files with tiny cloud-backed pointer files. Free disk space instantly — restore anytime.

| Extension | Content | Description |
|-----------|---------|-------------|
| `.repic` | Images | `image/*` MIME types |
| `.revid` | Videos | `video/*` MIME types |
| `.remusic` | Audio | `audio/*` MIME types |
| `.refile` | Other | Everything else |

Pointer files are small JSON (~200 bytes) containing the cloud URL, SHA-256 hash, original filename, and metadata.

**Overview tab** shows all virtualized files across folders with stats, MIME filtering, and batch restore.

### Companion Viewers — REPIC & REVID

After virtualizing, your files become `.repic` / `.revid` pointer files. Double-clicking them normally does nothing — they're just JSON.

**REPIC** and **REVID** are lightweight viewers built specifically for MemoryGuy. Install them once, and every `.repic` / `.revid` file becomes double-clickable — the viewer reads the pointer, streams the original from the cloud, and displays it instantly. No restore needed.

| Tool | What it does | Get it |
|------|-------------|--------|
| [**REPIC**](https://github.com/Jeffrey0117/REPIC) | Double-click `.repic` → see the image | [Download](https://github.com/Jeffrey0117/REPIC/releases/latest) |
| [**REVID**](https://github.com/Jeffrey0117/REVID) | Double-click `.revid` → play the video | [Download](https://github.com/Jeffrey0117/REVID/releases/latest) |

> **Easiest way:** Use the [NSIS installer](#nsis-installer-with-companion-tool-checkboxes) — it bundles REPIC and REVID as checkboxes so everything installs together.
>
> For `.remusic` and `.refile` — no viewer yet. Use MemoryGuy's **Overview** tab to batch restore them back to the originals.

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
git clone https://github.com/Jeffrey0117/MemoryGuy.git
cd MemoryGuy
npm install
npm start
```

Requires: Node.js 18+, Windows 10/11, PowerShell 5.1+

## Building

### Default (Squirrel)

```bash
npm run package        # Package app → out/MemoryGuy-win32-x64/
npm run make           # Build Squirrel.Windows installer
```

### NSIS Installer (with companion tool checkboxes)

The NSIS build creates an installer with optional checkboxes for REPIC and REVID:

1. Install [NSIS 3.x](https://nsis.sourceforge.io/Download) (or `choco install nsis`)
2. Package the app: `npm run package`
3. (Optional) Place companion installers in `installer/companions/`:
   - `REPIC-Setup.exe` — from [REPIC Releases](https://github.com/Jeffrey0117/REPIC/releases/latest)
   - `REVID-Setup.exe` — from [REVID Releases](https://github.com/Jeffrey0117/REVID/releases/latest)
4. Run: `installer\build.bat`
5. Output: `installer/MemoryGuy-Setup.exe`

The installer shows three components:
- **MemoryGuy** (required)
- **REPIC Image Viewer** (optional, checked by default)
- **REVID Video Player** (optional, checked by default)

---

## Ecosystem

MemoryGuy is the safety net for a developer toolkit that covers your entire workflow:

| Tool | What It Does | Repo |
|------|-------------|------|
| [**DevUp**](https://github.com/Jeffrey0117/DevUp) | New machine? One command rebuilds your entire workspace | `npx devup-cli` |
| [**ZeroSetup**](https://github.com/Jeffrey0117/ZeroSetup) | Any GitHub project, double-click to run. Zero setup steps | `npx zerosetup` |
| [**ClaudeBot**](https://github.com/Jeffrey0117/ClaudeBot) | Write code from your phone via AI. Voice-to-code, live streaming | Telegram bot |
| [**CloudPipe**](https://github.com/Jeffrey0117/CloudPipe) | Self-hosted Vercel. Auto-deploys, Telegram control, 31+ MCP tools | `npm i -g @jeffrey0117/cloudpipe` |
| **MemoryGuy** | Memory guardian, dev server dashboard, AI safety hooks | *you are here* |
| [**REPIC**](https://github.com/Jeffrey0117/REPIC) | Double-click `.repic` to view images — streams from cloud, no restore needed | MemoryGuy companion |
| [**REVID**](https://github.com/Jeffrey0117/REVID) | Double-click `.revid` to play videos — streams from cloud, no restore needed | MemoryGuy companion |

**The full loop:** DevUp sets up your machine → ClaudeBot writes code from your phone → CloudPipe auto-deploys → MemoryGuy keeps it all running and prevents AI from breaking things.

## License

MIT
