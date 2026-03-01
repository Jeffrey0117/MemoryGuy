const isWin = process.platform === 'win32'

// System-critical processes: never kill or trim
export const SYSTEM_PROTECTED: ReadonlySet<string> = new Set(
  isWin
    ? [
        'System',
        'System Idle Process',
        'Registry',
        'Memory Compression',
        'explorer.exe',
        'csrss.exe',
        'winlogon.exe',
        'lsass.exe',
        'services.exe',
        'svchost.exe',
        'smss.exe',
        'wininit.exe',
        'dwm.exe',
        'fontdrvhost.exe',
        'sihost.exe',
        'taskhostw.exe',
        'electron.exe',
      ]
    : [
        'kernel_task',
        'launchd',
        'WindowServer',
        'loginwindow',
        'opendirectoryd',
        'mds',
        'mds_stores',
        'diskarbitrationd',
        'fseventsd',
        'cfprefsd',
        'coreservicesd',
        'Electron',
        'Electron Helper',
      ],
)

// Known multi-process apps (don't treat sub-processes as duplicates)
export const MULTI_PROCESS_APPS: ReadonlySet<string> = new Set(
  isWin
    ? [
        'chrome.exe',
        'msedge.exe',
        'firefox.exe',
        'Code.exe',
        'electron.exe',
        'slack.exe',
        'discord.exe',
        'teams.exe',
        'brave.exe',
        'opera.exe',
        'vivaldi.exe',
        'spotify.exe',
      ]
    : [
        'Google Chrome',
        'Google Chrome Helper',
        'Microsoft Edge',
        'Firefox',
        'Code Helper',
        'Electron',
        'Electron Helper',
        'Slack',
        'Slack Helper',
        'Discord',
        'Discord Helper',
        'Brave Browser',
        'Opera',
        'Vivaldi',
        'Spotify',
      ],
)

// Dev server detection: process names that indicate dev servers
export const DEV_PROCESS_NAMES: ReadonlySet<string> = new Set(
  isWin
    ? [
        'node.exe',
        'bun.exe',
        'deno.exe',
        'python.exe',
        'python3.exe',
        'ruby.exe',
        'java.exe',
        'go.exe',
        'php.exe',
        'dotnet.exe',
      ]
    : [
        'node',
        'bun',
        'deno',
        'python',
        'python3',
        'ruby',
        'java',
        'go',
        'php',
        'dotnet',
      ],
)

// Trim / idle thresholds (PowerShell timeout only relevant on Windows)
export const TRIM_POWERSHELL_TIMEOUT_MS = 15_000
