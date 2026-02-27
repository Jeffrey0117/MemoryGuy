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

**The full loop:** DevUp sets up your machine → ClaudeBot writes code from your phone → CloudPipe auto-deploys → MemoryGuy keeps it all running and prevents AI from breaking things.

## License

MIT
