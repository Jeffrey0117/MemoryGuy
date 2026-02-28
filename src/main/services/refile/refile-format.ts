import fs from 'node:fs'
import { z } from 'zod'

const EXTENSIONS = ['.revid', '.remusic', '.repic', '.refile'] as const
type RefileExt = typeof EXTENSIONS[number]

const metaSchema = z.object({
  mode: z.number().optional(),
  mtime: z.number().optional(),
  atime: z.number().optional(),
})

const refileV1Schema = z.object({
  v: z.literal(1),
  type: z.literal('refile'),
  mime: z.string(),
  url: z.string().url(),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  size: z.number().int().nonnegative(),
  name: z.string(),
  createdAt: z.number().int(),
  backend: z.string().optional(),
  meta: metaSchema.optional(),
})

const repicV2Schema = z.object({
  v: z.literal(2),
  type: z.literal('virtual-image'),
  url: z.string().url(),
  name: z.string(),
  createdAt: z.number().int(),
  mime: z.string(),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  size: z.number().int().nonnegative(),
  backend: z.string().optional(),
  meta: metaSchema.optional(),
})

const refileSchema = z.discriminatedUnion('type', [refileV1Schema, repicV2Schema])

export type RefilePointerV1 = z.infer<typeof refileV1Schema>
export type RefilePointerV2 = z.infer<typeof repicV2Schema>
export type RefilePointer = RefilePointerV1 | RefilePointerV2

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
  if (params.mime.startsWith('image/')) {
    return {
      v: 2,
      type: 'virtual-image',
      url: params.url,
      name: params.name,
      createdAt: Date.now(),
      mime: params.mime,
      hash: params.hash,
      size: params.size,
      backend: params.backend,
      meta: params.meta,
    }
  }
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
    if (result.success) return result.data
    // Fallback: try v1 alone (handles old .repic files with type: "refile")
    const v1Result = refileV1Schema.safeParse(data)
    if (!v1Result.success) return null

    const v1 = v1Result.data
    // Auto-migrate v1 .repic with image/* MIME to v2
    if (filePath.endsWith('.repic') && v1.mime.startsWith('image/')) {
      const v2: RefilePointerV2 = {
        v: 2,
        type: 'virtual-image',
        url: v1.url,
        name: v1.name,
        createdAt: v1.createdAt,
        mime: v1.mime,
        hash: v1.hash,
        size: v1.size,
        backend: v1.backend,
        meta: v1.meta,
      }
      try {
        writeRefilePointer(filePath, v2)
      } catch {
        // Migration write failed — still return the v2 shape
      }
      return v2
    }

    return v1
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
