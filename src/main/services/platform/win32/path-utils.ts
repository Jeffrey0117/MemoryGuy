import path from 'path'
import type { PathUtils } from '../types'
import type { CleanupCategory } from '@shared/types'

const DEV_DEP_DIRS = new Set(['node_modules'])
const DEV_BUILD_DIRS = new Set(['.next', 'dist', 'out', '__pycache__', '.gradle', 'build', '.parcel-cache', '.turbo'])
const ALL_ALLOWED_DIRS = new Set([...DEV_DEP_DIRS, ...DEV_BUILD_DIRS])

export function createWin32PathUtils(): PathUtils {
  return {
    inferCwd(commandLine: string): string {
      // Prefer node_modules parent directory (handles quoted paths)
      const nmMatch = commandLine.match(/([A-Za-z]:\\[^"]*?)\\node_modules/i)
      if (nmMatch) return nmMatch[1]
      // Fallback: last quoted or unquoted absolute path
      const quotedPaths = commandLine.match(/"([A-Za-z]:\\[^"]+)"/g)
      if (quotedPaths?.length) {
        const last = quotedPaths[quotedPaths.length - 1].replace(/"/g, '')
        return path.dirname(last)
      }
      const paths = commandLine.match(/([A-Za-z]:\\[^\s"]+)/g)
      if (paths?.length) return path.dirname(paths[paths.length - 1])
      return process.cwd()
    },

    isPathSafe(filePath: string, category: CleanupCategory): boolean {
      const normalized = path.resolve(filePath)
      const basename = path.basename(normalized).toLowerCase()

      // Never delete drive roots or top-level folders
      if (normalized.match(/^[A-Z]:\\[^\\]*$/i)) return false
      if (normalized.match(/^[A-Z]:\\$/i)) return false

      // For dev-deps/dev-build categories, basename must be in whitelist
      if (category === 'dev-deps' || category === 'dev-build') {
        if (!ALL_ALLOWED_DIRS.has(basename)) {
          return false
        }
      }

      // Never touch system directories
      const lowerPath = normalized.toLowerCase()
      if (lowerPath.includes('\\windows\\') && !lowerPath.includes('\\windows\\temp')) return false
      if (lowerPath.includes('\\program files')) return false

      return true
    },
  }
}
