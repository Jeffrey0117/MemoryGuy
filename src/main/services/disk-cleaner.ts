import { EventEmitter } from 'events';
import path from 'path';
import { createHash } from 'crypto';
import { getPlatform } from './platform';
import type { CleanupCategory, DiskCleanupItem, DiskScanResult, DiskCleanResult } from '@shared/types';

const SCAN_DEPTH = 6;

const DEV_DEP_DIRS = new Set(['node_modules']);
const DEV_BUILD_DIRS = new Set(['.next', 'dist', 'out', '__pycache__', '.gradle', 'build', '.parcel-cache', '.turbo']);
const ALL_ALLOWED_DIRS = new Set([...DEV_DEP_DIRS, ...DEV_BUILD_DIRS]);

const ALL_TARGET_DIRS = [...DEV_DEP_DIRS, ...DEV_BUILD_DIRS];

function makeId(category: CleanupCategory, filePath: string): string {
  const hash = createHash('md5').update(filePath).digest('hex').slice(0, 8);
  return `${category}:${hash}`;
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
    const platform = getPlatform();

    try {
      // Phase 1: Get fixed-volume drives
      const drives = await platform.diskOps.getFixedDrives();
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

      // Phase 4: Scan recycle bin / trash
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
    const platform = getPlatform();
    const fixedPathTargets = platform.diskOps.getFixedPathTargets();

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
      const isFixedPath = fixedPathTargets.some((t) => path.resolve(t.path) === resolvedPath);
      const isRecycleBin = filePath === '$Recycle.Bin';

      if (!isDevDir && !isFixedPath && !isRecycleBin) {
        failed.push({ path: filePath, error: 'Path not in whitelist' });
        continue;
      }

      if (!isRecycleBin && !platform.pathUtils.isPathSafe(filePath, isDevDir ? (DEV_DEP_DIRS.has(basename) ? 'dev-deps' : 'dev-build') : 'temp')) {
        failed.push({ path: filePath, error: 'Path failed safety check' });
        continue;
      }

      try {
        if (isRecycleBin) {
          await platform.diskOps.cleanRecycleBin();
        } else {
          await platform.diskOps.removeDirectory(filePath);
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

  private async scanDriveForDevDirs(drive: string): Promise<DiskCleanupItem[]> {
    this.checkAborted();
    const items: DiskCleanupItem[] = [];
    const platform = getPlatform();

    const rawEntries = await platform.diskOps.scanDriveForDevDirs(drive, SCAN_DEPTH, ALL_TARGET_DIRS);

    for (const entry of rawEntries) {
      this.checkAborted();

      const fullPath = entry.fullPath;
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
        const hasPackageJson = await platform.diskOps.fileExists(path.join(parentDir, 'package.json'));
        if (!hasPackageJson) {
          const grandparent = path.dirname(parentDir);
          const hasGrandParentPkg = await platform.diskOps.fileExists(path.join(grandparent, 'package.json'));
          if (!hasGrandParentPkg) continue;
        }
      }

      if (!platform.pathUtils.isPathSafe(fullPath, category)) continue;

      const projectName = path.basename(path.dirname(fullPath));
      const lastModified = entry.lastWriteTime ? new Date(entry.lastWriteTime).getTime() : 0;

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
    const platform = getPlatform();
    const targets = platform.diskOps.getFixedPathTargets();

    for (const target of targets) {
      this.checkAborted();

      const resolvedPath = path.resolve(target.path);
      const exists = await platform.diskOps.directoryExists(resolvedPath);
      if (!exists) continue;

      const sizeBytes = await platform.diskOps.getDirectorySize(resolvedPath);
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
    const platform = getPlatform();
    try {
      const sizeBytes = await platform.diskOps.scanRecycleBin();
      if (sizeBytes <= 0) return null;

      return {
        id: makeId('recycle-bin', '$Recycle.Bin'),
        path: '$Recycle.Bin',
        category: 'recycle-bin',
        label: platform.capabilities.trashLabel,
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
    const platform = getPlatform();

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      this.checkAborted();
      const batch = items.slice(i, i + BATCH_SIZE);

      const sized = await Promise.all(
        batch.map(async (item) => {
          const sizeBytes = await platform.diskOps.getDirectorySize(item.path);
          return { ...item, sizeBytes };
        }),
      );

      result.push(...sized.filter((item) => item.sizeBytes > 0));
      this.emitProgress(0, result.length, result.reduce((s, it) => s + it.sizeBytes, 0));
    }

    return result;
  }
}
