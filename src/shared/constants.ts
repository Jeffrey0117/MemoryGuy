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
  SET_AUTO_RESTART: 'set-auto-restart',
  GET_AUTO_RESTART_PORTS: 'get-auto-restart-ports',
  ENABLE_GROUP_AUTO_RESTART: 'enable-group-auto-restart',

  // Push events — auto-restart
  ON_SERVER_RESTARTED: 'on-server-restarted',

  // Hook generator
  GENERATE_HOOK: 'generate-hook',

  // Startup programs
  GET_STARTUP_ITEMS: 'get-startup-items',
  TOGGLE_STARTUP_ITEM: 'toggle-startup-item',
  REMOVE_STARTUP_ITEM: 'remove-startup-item',

  // Environment variables
  GET_ENV_VARS: 'get-env-vars',
  COPY_TO_CLIPBOARD: 'copy-to-clipboard',

  // Disk cleanup
  SCAN_DISK_CLEANUP: 'scan-disk-cleanup',
  EXECUTE_DISK_CLEANUP: 'execute-disk-cleanup',
  CANCEL_DISK_SCAN: 'cancel-disk-scan',
  ON_DISK_SCAN_PROGRESS: 'on-disk-scan-progress',

  // Disk virtualization
  VIRT_GET_USER_FOLDERS: 'virt-get-user-folders',
  VIRT_SCAN: 'virt-scan',
  VIRT_SCAN_FOLDER: 'virt-scan-folder',
  VIRT_SELECT_FOLDER: 'virt-select-folder',
  VIRT_PUSH: 'virt-push',
  VIRT_PULL: 'virt-pull',
  VIRT_STATUS: 'virt-status',
  VIRT_CANCEL: 'virt-cancel',
  VIRT_CONFIG_LOAD: 'virt-config-load',
  VIRT_CONFIG_SAVE: 'virt-config-save',
  ON_VIRT_PROGRESS: 'on-virt-progress',

  // Watch folders
  VIRT_GET_WATCH_FOLDERS: 'virt-get-watch-folders',
  VIRT_ADD_WATCH_FOLDER: 'virt-add-watch-folder',
  VIRT_REMOVE_WATCH_FOLDER: 'virt-remove-watch-folder',
  VIRT_TOGGLE_WATCH_FOLDER: 'virt-toggle-watch-folder',
  VIRT_GET_WATCH_EVENTS: 'virt-get-watch-events',
  VIRT_CLEAR_WATCH_EVENTS: 'virt-clear-watch-events',
  VIRT_SELECT_WATCH_FOLDER: 'virt-select-watch-folder',
  ON_VIRT_WATCH_EVENT: 'on-virt-watch-event',

  // Registry
  VIRT_REGISTRY_LIST: 'virt-registry-list',
  VIRT_REGISTRY_STATS: 'virt-registry-stats',
  VIRT_REGISTRY_SCAN_FOLDERS: 'virt-registry-scan-folders',
  VIRT_REGISTRY_REBUILD: 'virt-registry-rebuild',

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
