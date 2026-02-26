export const IPC = {
  GET_SYSTEM_STATS: 'get-system-stats',
  GET_PROCESS_LIST: 'get-process-list',
  GET_MEMORY_HISTORY: 'get-memory-history',
  GET_LEAK_SUSPECTS: 'get-leak-suspects',
  KILL_PROCESS: 'kill-process',
  KILL_PROCESS_GROUP: 'kill-process-group',
  ANALYZE_OPTIMIZE: 'analyze-optimize',
  EXECUTE_OPTIMIZE: 'execute-optimize',
  TRIM_WORKING_SETS: 'trim-working-sets',
  TRIM_ALL_WORKING_SETS: 'trim-all-working-sets',
  GET_AUTO_PROTECT: 'get-auto-protect',
  SET_AUTO_PROTECT: 'set-auto-protect',

  // Window controls
  WIN_MINIMIZE: 'win-minimize',
  WIN_MAXIMIZE: 'win-maximize',
  WIN_CLOSE: 'win-close',
  WIN_IS_MAXIMIZED: 'win-is-maximized',

  // Push events (main -> renderer)
  ON_SYSTEM_UPDATE: 'on-system-update',
  ON_PROCESS_UPDATE: 'on-process-update',
  ON_LEAK_DETECTED: 'on-leak-detected',
} as const;

export const SYSTEM_POLL_MS = 1000;
export const PROCESS_POLL_MS = 2000;
export const LEAK_CHECK_MS = 30_000;
export const HISTORY_MAX_SAMPLES = 1800; // 30 min @ 1/sec
export const LEAK_THRESHOLD_MB_MIN = 1;
export const LEAK_CRITICAL_MB_MIN = 5;
export const LEAK_MIN_DURATION_MIN = 5;
export const LEAK_CRITICAL_MIN_DURATION_MIN = 2;

// System-critical processes: never kill or trim
export const SYSTEM_PROTECTED = new Set([
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
  'electron.exe', // don't touch ourselves
]);

// Known multi-process apps (don't treat sub-processes as duplicates)
export const MULTI_PROCESS_APPS = new Set([
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
]);

// Trim / idle thresholds
export const IDLE_CPU_THRESHOLD = 0.5;           // <0.5% CPU = idle
export const IDLE_HIGH_RAM_MB = 200;             // idle + >200MB = recommendation
export const TRIM_POWERSHELL_TIMEOUT_MS = 15_000;
export const TRIM_RAM_MEASURE_DELAY_MS = 2_000;
