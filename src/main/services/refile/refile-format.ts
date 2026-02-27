import fs from 'node:fs'
import { z } from 'zod'

const EXTENSIONS = ['.revid', '.remusic', '.repic', '.refile'] as const
type RefileExt = typeof EXTENSIONS[number]

const refileSchema = z.object({
  v: z.literal(1),
  type: z.literal('refile'),
  mime: z.string(),
  url: z.string().url(),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  size: z.number().int().nonnegative(),
  name: z.string(),
  createdAt: z.number().int(),
  backend: z.string().optional(),
  meta: z.object({
    mode: z.number().optional(),
    mtime: z.number().optional(),
    atime: z.number().optional(),
  }).optional(),
})

export type RefilePointer = z.infer<typeof refileSchema>

export function getExtensionForMime(mime: string): RefileExt {
  if (mime.startsWith('video/')) return '.revid'
  if (mime.startsWith('audio/')) return '.remusic'
  if (mime.startsWith('image/')) return '.repic'
  return '.refile'
}

export function createRefilePointer(params: {
  mime: string
  url: string
  hash: string
  size: number
  name: string
  backend?: string
  meta?: { mode?: number; mtime?: number; atime?: number }
}): RefilePointer {
  return {
    v: 1,
    type: 'refile',
    mime: params.mime,
    url: params.url,
    hash: params.hash,
    size: params.size,
    name: params.name,
    createdAt: Date.now(),
    backend: params.backend,
    meta: params.meta,
  }
}

export function readRefilePointer(filePath: string): RefilePointer | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    const result = refileSchema.safeParse(data)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function writeRefilePointer(filePath: string, pointer: RefilePointer): void {
  fs.writeFileSync(filePath, JSON.stringify(pointer, null, 2), 'utf-8')
}

export function isRefilePath(filePath: string): boolean {
  return EXTENSIONS.some((ext) => filePath.endsWith(ext))
}

export function getOriginalPath(refilePath: string): string {
  for (const ext of EXTENSIONS) {
    if (refilePath.endsWith(ext)) {
      return refilePath.slice(0, -ext.length)
    }
  }
  return refilePath
}

export function getRefilePath(originalPath: string, mime?: string): string {
  const ext = mime ? getExtensionForMime(mime) : '.refile'
  return `${originalPath}${ext}`
}

export { EXTENSIONS }
