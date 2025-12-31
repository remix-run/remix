import * as os from 'node:os'
import * as path from 'node:path'
import { createFsFileStorage } from 'remix/file-storage/fs'

let cacheDir = path.join(os.tmpdir(), 'unpkg-cache')

export let tarballCache = createFsFileStorage(cacheDir)

/**
 * Get a cache key for a package tarball.
 */
export function getTarballCacheKey(packageName: string, version: string): string {
  // Replace @ and / in scoped package names to make valid cache keys
  let safeName = packageName.replace(/\//g, '-').replace(/^@/, '')
  return `${safeName}@${version}.tgz`
}
