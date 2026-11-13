import * as fs from 'node:fs'
import { IfNoneMatch } from '@remix-run/headers/if-none-match'

import type { EmittedAsset } from './fingerprint.ts'
import { isNoEntityError } from './fs-errors.ts'
import { normalizeFilePath } from './paths.ts'

type CompiledAsset = {
  code: EmittedAsset
  sourceMap: EmittedAsset | null
}

type VersionedRecord = {
  identityPath: string
  invalidationVersion: number
}

export function getCacheKey(identityPath: string, version: number): string {
  return `${identityPath}\0${version}`
}

export function isFresh(record: VersionedRecord, version: number): boolean {
  return record.invalidationVersion === version
}

export function getEmittedAssetForRequest(
  emitted: CompiledAsset,
  isSourceMapRequest: boolean,
): EmittedAsset | null {
  return isSourceMapRequest ? emitted.sourceMap : emitted.code
}

export function getNotModifiedResult(
  asset: { etag: string; fingerprint: string | null } | null | undefined,
  options: { ifNoneMatch: string | null; requestedFingerprint: string | null },
): { etag: string; type: 'not-modified' } | null {
  if (!asset || options.ifNoneMatch === null) return null

  if (options.requestedFingerprint !== null && asset.fingerprint !== options.requestedFingerprint) {
    return null
  }

  if (!IfNoneMatch.from(options.ifNoneMatch).matches(asset.etag)) return null
  return { etag: asset.etag, type: 'not-modified' }
}

export function createCompiledAssetResponse(
  result: CompiledAsset,
  contentType: string,
  options: {
    cacheControl: string
    ifNoneMatch: string | null
    isSourceMapRequest: boolean
    method: string
  },
): Response {
  let asset = getEmittedAssetForRequest(result, options.isSourceMapRequest)
  if (!asset) {
    return new Response('Not found', { status: 404 })
  }

  if (IfNoneMatch.from(options.ifNoneMatch).matches(asset.etag)) {
    return new Response(null, { status: 304, headers: { ETag: asset.etag } })
  }

  return new Response(options.method === 'HEAD' ? null : asset.content, {
    headers: {
      'Cache-Control': options.cacheControl,
      'Content-Type': options.isSourceMapRequest ? 'application/json; charset=utf-8' : contentType,
      ETag: asset.etag,
    },
  })
}

export function appendTimestampQuery(pathname: string, timestamp: number): string {
  return `${pathname}${pathname.includes('?') ? '&' : '?'}t=${timestamp}`
}

export function getFileSnapshot(filePath: string): { mtimeNs: bigint; size: bigint } | null {
  try {
    let stats = fs.statSync(filePath, { bigint: true })
    if (!stats.isFile()) return null
    return {
      mtimeNs: stats.mtimeNs,
      size: stats.size,
    }
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

export function resolveRealFilePath(filePath: string): string | null {
  try {
    return normalizeFilePath(fs.realpathSync(filePath))
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

export async function mapWithConcurrency<item, result>(
  items: item[],
  concurrency: number,
  mapper: (item: item, index: number) => Promise<result>,
): Promise<result[]> {
  if (items.length === 0) return []

  let results = new Array<result>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      let index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}
