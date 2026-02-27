import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export function hashBuffer(buffer: Buffer): string {
  const hex = createHash('sha256').update(buffer).digest('hex')
  return `sha256:${hex}`
}

export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`))
    stream.on('error', reject)
  })
}

export function verifyHash(buffer: Buffer, expected: string): boolean {
  return hashBuffer(buffer) === expected
}
