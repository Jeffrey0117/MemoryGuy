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

  // Protection rules
  GET_PROTECTION_RULES: 'get-protection-rules',
  ADD_PROTECTION_RULE: 'add-protection-rule',
  REMOVE_PROTECTION_RULE: 'remove-protection-rule',
  UPDATE_PROTECTION_RULE: 'update-protection-rule',

  // Guardian
  GET_WATCHED_PROCESSES: 'get-watched-processes',
  GET_GUARDIAN_LOG: 'get-guardian-log',
  CLEAR_GUARDIAN_LOG: 'clear-guardian-log',

  // Dev servers
  GET_DEV_SERVERS: 'get-dev-servers',
  SCAN_DEV_SERVERS: 'scan-dev-servers',
  OPEN_EXTERNAL_URL: 'open-external-url',

  // Hook generator
  GENERATE_HOOK: 'generate-hook',

  // Push events (main -> renderer)
  ON_SYSTEM_UPDATE: 'on-system-update',
  ON_PROCESS_UPDATE: 'on-process-update',
  ON_LEAK_DETECTED: 'on-leak-detected',
  ON_PROCESS_TERMINATED: 'on-process-terminated',
  ON_DEV_SERVERS_UPDATE: 'on-dev-servers-update',
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

// Guardian
export const GUARDIAN_EVENT_LOG_MAX = 100;

// Dev server detection
export const PORT_SCAN_MS = 5_000;
export const DEV_PORT_RANGE_MIN = 3000;
export const DEV_PORT_RANGE_MAX = 9999;
export const DEV_PROCESS_NAMES = new Set([
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
]);
