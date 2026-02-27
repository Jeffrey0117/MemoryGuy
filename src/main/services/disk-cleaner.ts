import { EventEmitter } from 'events';
import path from 'path';
import { createHash } from 'crypto';
import { runPs, psEscape } from './powershell';
import type { CleanupCategory, DiskCleanupItem, DiskScanResult, DiskCleanResult } from '@shared/types';

const SCAN_DEPTH = 6;

const DEV_DEP_DIRS = new Set(['node_modules']);
const DEV_BUILD_DIRS = new Set(['.next', 'dist', 'out', '__pycache__', '.gradle', 'build', '.parcel-cache', '.turbo']);
const ALL_ALLOWED_DIRS = new Set([...DEV_DEP_DIRS, ...DEV_BUILD_DIRS]);

const SYSTEM_EXCLUDE_PATTERN = 'Windows|Program Files|Program Files \\(x86\\)|\\.git\\\\|\\$Recycle\\.Bin|ProgramData';

interface FixedPathTarget {
  readonly category: CleanupCategory;
  readonly label: string;
  readonly path: string;
}

function makeId(category: CleanupCategory, filePath: string): string {
  const hash = createHash('md5').update(filePath).digest('hex').slice(0, 8);
  return `${category}:${hash}`;
}

function getFixedPathTargets(): readonly FixedPathTarget[] {
  const appData = process.env.APPDATA ?? '';
  const localAppData = process.env.LOCALAPPDATA ?? '';
  const temp = process.env.TEMP ?? '';
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';

  return [
    // Package caches
    { category: 'pkg-cache', label: 'npm cache', path: path.join(appData, 'npm-cache') },
    { category: 'pkg-cache', label: 'yarn cache', path: path.join(localAppData, 'yarn', 'Cache') },
    { category: 'pkg-cache', label: 'pnpm cache', path: path.join(localAppData, 'pnpm-cache') },
    { category: 'pkg-cache', label: 'pnpm store', path: path.join(localAppData, 'pnpm', 'store') },
    // Temp
    { category: 'temp', label: 'User Temp', path: temp },
    { category: 'temp', label: 'Windows Temp', path: path.join(systemRoot, 'Temp') },
    // Browser cache
    { category: 'browser-cache', label: 'Chrome Cache', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache') },
    { category: 'browser-cache', label: 'Chrome Code Cache', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache') },
    { category: 'browser-cache', label: 'Edge Cache', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache') },
    { category: 'browser-cache', label: 'Edge Code Cache', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache') },
  ];
}

function isPathSafe(filePath: string, category: CleanupCategory): boolean {
  const normalized = path.resolve(filePath);
  const basename = path.basename(normalized).toLowerCase();

  // Never delete drive roots or top-level folders
  if (normalized.match(/^[A-Z]:\\[^\\]*$/i)) return false;
  if (normalized.match(/^[A-Z]:\\$/i)) return false;

  // For dev-deps/dev-build categories, basename must be in whitelist
  if (category === 'dev-deps' || category === 'dev-build') {
    if (!ALL_ALLOWED_DIRS.has(basename)) {
      return false;
    }
  }

  // Never touch system directories
  const lowerPath = normalized.toLowerCase();
  if (lowerPath.includes('\\windows\\') && !lowerPath.includes('\\windows\\temp')) return false;
  if (lowerPath.includes('\\program files')) return false;

  return true;
}

export class DiskCleaner extends EventEmitter {
  private abortController: AbortController | null = null;
  private scanning = false;
  private lastScanPaths = new Set<string>();

  async scan(): Promise<DiskScanResult> {
    if (this.scanning) {
      throw new Error('Scan already in progress');
    }

    this.scanning = true;
    this.abortController = new AbortController();
    const startTime = Date.now();
    const items: DiskCleanupItem[] = [];

    try {
      // Phase 1: Get fixed-volume drives
      const drives = await this.getFixedDrives();
      this.checkAborted();

      // Phase 2: Scan dev directories across all drives
      for (const drive of drives) {
        this.checkAborted();
        const devItems = await this.scanDriveForDevDirs(drive);
        items.push(...devItems);
        this.emitProgress(0, items.length, items.reduce((s, i) => s + i.sizeBytes, 0));
      }

      // Phase 3: Scan fixed paths (caches, temp, etc.)
      const fixedItems = await this.scanFixedPaths();
      items.push(...fixedItems);
      this.emitProgress(0, items.length, items.reduce((s, i) => s + i.sizeBytes, 0));

      // Phase 4: Scan recycle bin
      this.checkAborted();
      const recycleBinItem = await this.scanRecycleBin();
      if (recycleBinItem) {
        items.push(recycleBinItem);
      }

      const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
      this.emitProgress(0, items.length, totalBytes);

      // Store scanned paths for clean() validation
      this.lastScanPaths = new Set(items.map((i) => path.resolve(i.path)));

      return {
        items,
        totalBytes,
        scanDurationMs: Date.now() - startTime,
      };
    } finally {
      this.scanning = false;
      this.abortController = null;
    }
  }

  async clean(paths: readonly string[], itemSizes: ReadonlyMap<string, number>): Promise<DiskCleanResult> {
    const cleaned: { path: string; sizeBytes: number }[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const filePath of paths) {
      const resolvedPath = filePath === '$Recycle.Bin' ? filePath : path.resolve(filePath);

      // Critical: only allow paths from the last scan
      if (!this.lastScanPaths.has(resolvedPath)) {
        failed.push({ path: filePath, error: 'Path not from latest scan' });
        continue;
      }

      // Safety: validate every path
      const basename = path.basename(filePath).toLowerCase();
      const isDevDir = ALL_ALLOWED_DIRS.has(basename);
      const isFixedPath = getFixedPathTargets().some((t) => path.resolve(t.path) === resolvedPath);
      const isRecycleBin = filePath === '$Recycle.Bin';

      if (!isDevDir && !isFixedPath && !isRecycleBin) {
        failed.push({ path: filePath, error: 'Path not in whitelist' });
        continue;
      }

      if (!isRecycleBin && !isPathSafe(filePath, isDevDir ? (DEV_DEP_DIRS.has(basename) ? 'dev-deps' : 'dev-build') : 'temp')) {
        failed.push({ path: filePath, error: 'Path failed safety check' });
        continue;
      }

      try {
        if (isRecycleBin) {
          await this.cleanRecycleBin();
        } else {
          await this.removeDirectory(filePath);
        }
        const sizeBytes = itemSizes.get(filePath) ?? 0;
        cleaned.push({ path: filePath, sizeBytes });
      } catch (err) {
        failed.push({ path: filePath, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return {
      cleaned,
      failed,
      totalFreed: cleaned.reduce((sum, c) => sum + c.sizeBytes, 0),
    };
  }

  cancelScan(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Scan cancelled');
    }
  }

  private emitProgress(scanned: number, found: number, totalBytes: number): void {
    this.emit('scan-progress', { scanned, found, totalBytes });
  }

  private async getFixedDrives(): Promise<string[]> {
    try {
      const script = `Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.FileSystemType -eq 'NTFS' -and $_.DriveLetter } | Select-Object -ExpandProperty DriveLetter`;
      const output = await runPs(script);
      if (!output) return ['C'];
      return output.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[A-Z]$/i.test(l));
    } catch {
      return ['C'];
    }
  }

  private async scanDriveForDevDirs(driveLetter: string): Promise<DiskCleanupItem[]> {
    this.checkAborted();
    const items: DiskCleanupItem[] = [];

    const allTargets = [...DEV_DEP_DIRS, ...DEV_BUILD_DIRS];
    const targetList = allTargets.map((t) => `'${t}'`).join(',');

    const script = [
      `$targets = @(${targetList})`,
      `Get-ChildItem -Path '${driveLetter}:\\' -Directory -Recurse -Depth ${SCAN_DEPTH} -ErrorAction SilentlyContinue |`,
      `  Where-Object { $targets -contains $_.Name -and $_.FullName -notmatch '${SYSTEM_EXCLUDE_PATTERN}' } |`,
      `  Select-Object FullName, LastWriteTime |`,
      `  ConvertTo-Csv -NoTypeInformation`,
    ].join(' ');

    let output: string;
    try {
      output = await runPs(script);
    } catch {
      return items;
    }

    if (!output) return items;

    const lines = output.split(/\r?\n/).filter((l) => l.startsWith('"'));
    // Skip CSV header
    const dataLines = lines.length > 0 && lines[0].includes('FullName') ? lines.slice(1) : lines;

    for (const line of dataLines) {
      this.checkAborted();

      const match = line.match(/^"([^"]+)","?([^"]*)"?$/);
      if (!match) continue;

      const fullPath = match[1];
      const lastWriteStr = match[2];
      const dirName = path.basename(fullPath);
      const dirNameLower = dirName.toLowerCase();

      // Determine category
      let category: CleanupCategory;
      if (DEV_DEP_DIRS.has(dirNameLower)) {
        category = 'dev-deps';
      } else if (DEV_BUILD_DIRS.has(dirNameLower)) {
        category = 'dev-build';
      } else {
        continue;
      }

      // For dist/build/out, verify it's a JS project (package.json exists nearby)
      if (dirNameLower === 'dist' || dirNameLower === 'build' || dirNameLower === 'out') {
        const parentDir = path.dirname(fullPath);
        const hasPackageJson = await this.fileExists(path.join(parentDir, 'package.json'));
        if (!hasPackageJson) {
          const grandparent = path.dirname(parentDir);
          const hasGrandParentPkg = await this.fileExists(path.join(grandparent, 'package.json'));
          if (!hasGrandParentPkg) continue;
        }
      }

      if (!isPathSafe(fullPath, category)) continue;

      const projectName = path.basename(path.dirname(fullPath));
      const lastModified = lastWriteStr ? new Date(lastWriteStr).getTime() : 0;

      items.push({
        id: makeId(category, fullPath),
        path: fullPath,
        category,
        label: `${dirName} (${projectName})`,
        sizeBytes: 0,
        lastModified: isNaN(lastModified) ? 0 : lastModified,
      });
    }

    // Calculate sizes in batches
    const withSizes = await this.calculateSizes(items);
    return withSizes;
  }

  private async scanFixedPaths(): Promise<DiskCleanupItem[]> {
    const items: DiskCleanupItem[] = [];
    const targets = getFixedPathTargets();

    for (const target of targets) {
      this.checkAborted();

      const resolvedPath = path.resolve(target.path);
      const exists = await this.directoryExists(resolvedPath);
      if (!exists) continue;

      const sizeBytes = await this.getDirectorySize(resolvedPath);
      if (sizeBytes <= 0) continue;

      items.push({
        id: makeId(target.category, resolvedPath),
        path: resolvedPath,
        category: target.category,
        label: target.label,
        sizeBytes,
        lastModified: 0,
      });
    }

    return items;
  }

  private async scanRecycleBin(): Promise<DiskCleanupItem | null> {
    try {
      const script = `(New-Object -ComObject Shell.Application).Namespace(0xA).Items() | Measure-Object -Property Size -Sum | Select-Object -ExpandProperty Sum`;
      const output = await runPs(script);
      const sizeBytes = parseInt(output, 10);
      if (isNaN(sizeBytes) || sizeBytes <= 0) return null;

      return {
        id: makeId('recycle-bin', '$Recycle.Bin'),
        path: '$Recycle.Bin',
        category: 'recycle-bin',
        label: 'Recycle Bin',
        sizeBytes,
        lastModified: 0,
      };
    } catch {
      return null;
    }
  }

  private async calculateSizes(items: readonly DiskCleanupItem[]): Promise<DiskCleanupItem[]> {
    const result: DiskCleanupItem[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      this.checkAborted();
      const batch = items.slice(i, i + BATCH_SIZE);

      const sized = await Promise.all(
        batch.map(async (item) => {
          const sizeBytes = await this.getDirectorySize(item.path);
          return { ...item, sizeBytes };
        }),
      );

      result.push(...sized.filter((item) => item.sizeBytes > 0));
      this.emitProgress(0, result.length, result.reduce((s, it) => s + it.sizeBytes, 0));
    }

    return result;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const escaped = psEscape(dirPath);
      const script = `(Get-ChildItem -LiteralPath '${escaped}' -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum`;
      const output = await runPs(script);
      const size = parseInt(output, 10);
      return isNaN(size) ? 0 : size;
    } catch {
      return 0;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const escaped = psEscape(dirPath);
      const output = await runPs(`Test-Path -LiteralPath '${escaped}' -PathType Container`);
      return output.trim().toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const escaped = psEscape(filePath);
      const output = await runPs(`Test-Path -LiteralPath '${escaped}' -PathType Leaf`);
      return output.trim().toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    const escaped = psEscape(dirPath);
    await runPs(`Remove-Item -LiteralPath '${escaped}' -Recurse -Force -ErrorAction Stop`);
  }

  private async cleanRecycleBin(): Promise<void> {
    await runPs(`Clear-RecycleBin -Force -ErrorAction SilentlyContinue`);
  }
}
