import type { FileStorage } from '@remix-run/file-storage'

const maxCacheSlots = 256
const maxCacheFileSize = 4 * 1024 * 1024

export interface TransformCacheKey {
  digest: string
  slot: string
}

interface CachedTransform {
  body: Uint8Array
  extension: string
}

export function isTransformCacheable(output: CachedTransform): boolean {
  // Two SHA-256 hex digests, three newlines, the ASCII extension, and the output bytes.
  return 131 + output.extension.length + output.body.byteLength <= maxCacheFileSize
}

export async function createTransformCacheKey(
  namespace: string,
  identity: string,
): Promise<TransformCacheKey> {
  let digest = await hash(new TextEncoder().encode(identity))
  return {
    digest,
    slot: `${Buffer.from(namespace).toString('base64url')}/v2/${parseInt(digest.slice(0, 8), 16) % maxCacheSlots}`,
  }
}

export async function readCachedTransform(
  cache: FileStorage,
  key: TransformCacheKey,
): Promise<CachedTransform | null> {
  let file = await cache.get(key.slot)
  if (!file || file.size > maxCacheFileSize) return null

  let bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length > maxCacheFileSize || bytes[64] !== 10 || bytes[129] !== 10) return null

  let decoder = new TextDecoder()
  if (decoder.decode(bytes.subarray(65, 129)) !== key.digest) return null

  // Keep the identity and checksum in the body: some stores replace File metadata separately.
  let checksum = decoder.decode(bytes.subarray(0, 64))
  if ((await hash(bytes.subarray(65))) !== checksum) return null

  let extensionEnd = bytes.indexOf(10, 130)
  if (extensionEnd === -1) return null
  let extension = decoder.decode(bytes.subarray(130, extensionEnd))
  if (!/^\.[A-Za-z0-9_-]+$/.test(extension)) return null

  return { body: bytes.subarray(extensionEnd + 1), extension }
}

export async function writeCachedTransform(
  cache: FileStorage,
  key: TransformCacheKey,
  output: CachedTransform,
): Promise<void> {
  if (!isTransformCacheable(output)) return
  let header = new TextEncoder().encode(`${key.digest}\n${output.extension}\n`)

  let content = Buffer.concat([header, output.body])
  let checksum = await hash(content)
  await cache.set(key.slot, new File([`${checksum}\n`, content], 'transform-cache'))
}

async function hash(bytes: Uint8Array): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', Buffer.from(bytes))
  return Buffer.from(digest).toString('hex')
}
