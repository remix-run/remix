import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFsFileStorage } from 'remix/file-storage/fs'

const demoRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cacheDirectoryPath = path.join(demoRootPath, 'tmp', 'tarballs')

fs.mkdirSync(cacheDirectoryPath, { recursive: true })

export const tarballCache = createFsFileStorage(cacheDirectoryPath)

export function getTarballCacheKey(packageName: string, version: string): string {
  let safeName = packageName.replace(/\//g, '-').replace(/^@/, '')
  return `${safeName}@${version}.tgz`
}
