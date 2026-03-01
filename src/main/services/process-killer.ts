import { getPlatform, SYSTEM_PROTECTED } from './platform'

export function killByPid(
  pid: number,
  processName?: string,
): Promise<{ success: boolean; error?: string }> {
  // Strict PID validation to prevent command injection
  if (!Number.isInteger(pid) || pid <= 4) {
    return Promise.resolve({
      success: false,
      error: `Invalid or protected PID: ${pid}`,
    });
  }

  // Don't kill MemoryGuy itself
  if (pid === process.pid) {
    return Promise.resolve({
      success: false,
      error: 'Cannot kill MemoryGuy process',
    });
  }

  // Block system-critical processes
  if (processName && SYSTEM_PROTECTED.has(processName)) {
    return Promise.resolve({
      success: false,
      error: `Cannot kill system-critical process: ${processName}`,
    });
  }

  return getPlatform().processOps.killByPid(pid);
}

/**
 * Trim working sets of multiple processes.
 * Windows: uses EmptyWorkingSet API (non-destructive).
 * macOS: no-op (no equivalent API).
 */
export function trimWorkingSets(
  pids: readonly number[],
): Promise<{ trimmed: number[]; failed: { pid: number; error: string }[] }> {
  const validPids = pids.filter(
    (pid) => Number.isInteger(pid) && pid > 4 && pid !== process.pid,
  );

  if (validPids.length === 0) {
    return Promise.resolve({ trimmed: [], failed: [] });
  }

  return getPlatform().processOps.trimWorkingSets(validPids);
}
