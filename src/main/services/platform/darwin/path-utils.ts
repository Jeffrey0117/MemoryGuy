import path from 'path'
import type { PathUtils } from '../types'
import type { CleanupCategory } from '@shared/types'

const DEV_DEP_DIRS = new Set(['node_modules'])
const DEV_BUILD_DIRS = new Set(['.next', 'dist', 'out', '__pycache__', '.gradle', 'build', '.parcel-cache', '.turbo'])
const ALL_ALLOWED_DIRS = new Set([...DEV_DEP_DIRS, ...DEV_BUILD_DIRS])

const SYSTEM_ROOTS = ['/System', '/Library', '/usr', '/bin', '/sbin', '/private', '/dev']

export function createDarwinPathUtils(): PathUtils {
  return {
    inferCwd(commandLine: string): string {
      // Prefer node_modules parent directory
      const nmMatch = commandLine.match(/(\/[^\s"]*?)\/node_modules/i)
      if (nmMatch) return nmMatch[1]
      // Fallback: last quoted or unquoted absolute path
      const quotedPaths = commandLine.match(/"(\/[^"]+)"/g)
      if (quotedPaths?.length) {
        const last = quotedPaths[quotedPaths.length - 1].replace(/"/g, '')
        return path.dirname(last)
      }
      const paths = commandLine.match(/(\/[^\s"]+)/g)
      if (paths?.length) return path.dirname(paths[paths.length - 1])
      return process.cwd()
    },

    isPathSafe(filePath: string, category: CleanupCategory): boolean {
      const normalized = path.resolve(filePath)
      const basename = path.basename(normalized).toLowerCase()

      // Never delete root or top-level system directories
      if (normalized === '/') return false
      const depth = normalized.split('/').filter(Boolean).length
      if (depth <= 1) return false

      // For dev-deps/dev-build categories, basename must be in whitelist
      if (category === 'dev-deps' || category === 'dev-build') {
        if (!ALL_ALLOWED_DIRS.has(basename)) {
          return false
        }
      }

      // Never touch system directories
      for (const root of SYSTEM_ROOTS) {
        if (normalized.startsWith(root + '/') || normalized === root) {
          return false
        }
      }

      return true
    },
  }
}
