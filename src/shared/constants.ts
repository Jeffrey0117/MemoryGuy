export const IPC = {
  GET_SYSTEM_STATS: 'get-system-stats',
  GET_PROCESS_LIST: 'get-process-list',
  GET_MEMORY_HISTORY: 'get-memory-history',
  GET_LEAK_SUSPECTS: 'get-leak-suspects',
  KILL_PROCESS: 'kill-process',
  KILL_PROCESS_GROUP: 'kill-process-group',
  ANALYZE_OPTIMIZE: 'analyze-optimize',
  EXECUTE_OPTIMIZE: 'execute-optimize',
  GET_AUTO_PROTECT: 'get-auto-protect',
  SET_AUTO_PROTECT: 'set-auto-protect',

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
