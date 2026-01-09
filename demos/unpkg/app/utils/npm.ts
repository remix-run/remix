import * as zlib from 'node:zlib'
import { parseTar, type TarEntry } from 'remix/tar-parser'
import * as semver from 'semver'

import { tarballCache, getTarballCacheKey } from './cache.ts'

const NPM_REGISTRY = 'https://registry.npmjs.org'

export interface PackageMetadata {
  name: string
  'dist-tags': Record<string, string>
  versions: Record<string, PackageVersionMetadata>
}

export interface PackageVersionMetadata {
  name: string
  version: string
  dist: {
    tarball: string
    shasum: string
  }
}

export interface PackageFile {
  name: string
  path: string
  size: number
  type: 'file' | 'directory'
}

export interface PackageContents {
  metadata: PackageVersionMetadata
  files: Map<string, PackageFile>
  getFileContent: (path: string) => Promise<Uint8Array | null>
}

/**
 * Fetch package metadata from npm registry.
 */
export async function fetchPackageMetadata(packageName: string): Promise<PackageMetadata> {
  let url = `${NPM_REGISTRY}/${encodeURIComponent(packageName).replace('%40', '@')}`
  let response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new PackageNotFoundError(packageName)
    }
    throw new Error(`Failed to fetch package metadata: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Check if a version specifier is fully resolved (an exact version that exists).
 */
export function isFullyResolvedVersion(metadata: PackageMetadata, specifier: string): boolean {
  return specifier in metadata.versions
}

/**
 * Resolve a version specifier to a concrete version.
 * Supports:
 * - Exact versions: "1.2.3"
 * - Partial versions: "1", "1.2" -> matches highest in range
 * - Semver ranges: "^1.2.0", "~1.2.0", ">=1.0.0 <2.0.0"
 * - Dist tags: "latest", "beta"
 */
export function resolveVersion(metadata: PackageMetadata, specifier: string): string {
  // Check if it's a dist-tag
  if (specifier in metadata['dist-tags']) {
    return metadata['dist-tags'][specifier]
  }

  // Check if it's an exact version
  if (specifier in metadata.versions) {
    return specifier
  }

  let versions = Object.keys(metadata.versions)

  // Try to match as a semver range (^1.2.0, ~1.0.0, >=1.0.0, etc.)
  if (semver.validRange(specifier)) {
    let match = semver.maxSatisfying(versions, specifier)
    if (match) {
      return match
    }
  }

  // Try to match as a partial version (e.g., "18" matches "18.3.1")
  // Convert partial version to a range: "18" -> "18.x", "18.2" -> "18.2.x"
  let partialRange = specifier + '.x'
  if (semver.validRange(partialRange)) {
    let match = semver.maxSatisfying(versions, partialRange)
    if (match) {
      return match
    }
  }

  throw new VersionNotFoundError(metadata.name, specifier)
}

/**
 * Fetch and parse a package tarball, returning its contents.
 */
export async function fetchPackageContents(
  packageName: string,
  version: string,
): Promise<PackageContents> {
  let metadata = await fetchPackageMetadata(packageName)
  let resolvedVersion = resolveVersion(metadata, version)
  let versionMetadata = metadata.versions[resolvedVersion]

  if (!versionMetadata) {
    throw new VersionNotFoundError(packageName, version)
  }

  let tarballData = await fetchTarball(packageName, resolvedVersion, versionMetadata.dist.tarball)
  let { files, contents } = await parseTarball(tarballData)

  return {
    metadata: versionMetadata,
    files,
    async getFileContent(path: string): Promise<Uint8Array | null> {
      return contents.get(path) ?? null
    },
  }
}

/**
 * Fetch a tarball, using cache if available.
 */
async function fetchTarball(
  packageName: string,
  version: string,
  tarballUrl: string,
): Promise<Uint8Array> {
  let cacheKey = getTarballCacheKey(packageName, version)

  // Check cache first
  let cached = await tarballCache.get(cacheKey)
  if (cached) {
    return new Uint8Array(await cached.arrayBuffer())
  }

  // Fetch from npm
  let response = await fetch(tarballUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch tarball: ${response.status} ${response.statusText}`)
  }

  let compressedData = new Uint8Array(await response.arrayBuffer())

  // Decompress using node:zlib (faster than DecompressionStream)
  let decompressed = await gunzip(compressedData)

  // Cache the decompressed tarball
  let file = new File([decompressed.buffer as ArrayBuffer], `${packageName}@${version}.tar`, {
    type: 'application/x-tar',
  })
  await tarballCache.set(cacheKey, file)

  return decompressed
}

/**
 * Decompress gzip data using node:zlib.
 */
function gunzip(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zlib.gunzip(data, (err, result) => {
      if (err) reject(err)
      else resolve(new Uint8Array(result))
    })
  })
}

/**
 * Parse a tarball and extract file information and contents.
 */
async function parseTarball(
  data: Uint8Array,
): Promise<{ files: Map<string, PackageFile>; contents: Map<string, Uint8Array> }> {
  let files = new Map<string, PackageFile>()
  let contents = new Map<string, Uint8Array>()
  let directories = new Set<string>()

  await parseTar(data, async (entry: TarEntry) => {
    // npm tarballs have a "package/" prefix
    let name = entry.name.replace(/^package\//, '')
    if (!name) return

    // Track directories from file paths
    let parts = name.split('/')
    for (let i = 1; i < parts.length; i++) {
      let dirPath = parts.slice(0, i).join('/')
      directories.add(dirPath)
    }

    if (entry.header.type === 'directory') {
      // Remove trailing slash from directory name
      name = name.replace(/\/$/, '')
      directories.add(name)
    } else if (entry.header.type === 'file') {
      files.set(name, {
        name: parts[parts.length - 1],
        path: name,
        size: entry.size,
        type: 'file',
      })

      // Store file contents
      let bytes = await entry.bytes()
      contents.set(name, bytes)
    }
  })

  // Add directories to files map
  for (let dirPath of directories) {
    let parts = dirPath.split('/')
    files.set(dirPath, {
      name: parts[parts.length - 1],
      path: dirPath,
      size: 0,
      type: 'directory',
    })
  }

  return { files, contents }
}

/**
 * Get files at a specific directory level.
 */
export function getFilesAtPath(files: Map<string, PackageFile>, dirPath: string): PackageFile[] {
  let normalizedDir = dirPath.replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
  let result: PackageFile[] = []
  let seen = new Set<string>()

  for (let [filePath, file] of files) {
    // Skip if we've already seen this entry
    if (seen.has(filePath)) continue

    // Calculate the depth of this file
    let fileDepth = filePath.split('/').length - 1

    if (normalizedDir) {
      // Looking inside a directory
      if (!filePath.startsWith(normalizedDir + '/')) continue

      // Get relative path from the directory
      let relativePath = filePath.slice(normalizedDir.length + 1)
      if (!relativePath) continue

      // Only include direct children (no more slashes in relative path, except for dir trailing)
      if (relativePath.includes('/') && file.type === 'file') continue
      if (relativePath.includes('/')) continue
    } else {
      // Root level - only show top-level entries
      if (fileDepth !== 0) continue
    }

    seen.add(filePath)
    result.push(file)
  }

  // Sort: directories first, then alphabetically
  result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  return result
}

/**
 * Parse a package path from the URL.
 * Examples:
 *   "lodash" -> { name: "lodash", version: "latest", filePath: "" }
 *   "lodash@4.17.21" -> { name: "lodash", version: "4.17.21", filePath: "" }
 *   "lodash@4/package.json" -> { name: "lodash", version: "4", filePath: "package.json" }
 *   "@remix-run/cookie" -> { name: "@remix-run/cookie", version: "latest", filePath: "" }
 *   "@remix-run/cookie@1.0.0/src/index.ts" -> { name: "@remix-run/cookie", version: "1.0.0", filePath: "src/index.ts" }
 *   "react@^18.2" -> { name: "react", version: "^18.2", filePath: "" } (semver range)
 */
export function parsePackagePath(path: string): {
  name: string
  version: string
  filePath: string
} {
  // Decode URL-encoded characters (e.g., %5E -> ^, %7E -> ~)
  let decodedPath = decodeURIComponent(path)
  let parts = decodedPath.split('/')
  let name: string
  let rest: string[]

  // Handle scoped packages (@scope/name)
  if (path.startsWith('@')) {
    if (parts.length < 2) {
      throw new InvalidPathError(path)
    }
    name = parts[0] + '/' + parts[1]
    rest = parts.slice(2)
  } else {
    name = parts[0]
    rest = parts.slice(1)
  }

  // Extract version from name if present (name@version)
  let version = 'latest'
  let atIndex = name.lastIndexOf('@')
  if (atIndex > 0) {
    // Not at position 0 (which would be scoped package start)
    version = name.slice(atIndex + 1)
    name = name.slice(0, atIndex)
  }

  let filePath = rest.join('/')

  return { name, version, filePath }
}

export class PackageNotFoundError extends Error {
  packageName: string

  constructor(packageName: string) {
    super(`Package not found: ${packageName}`)
    this.name = 'PackageNotFoundError'
    this.packageName = packageName
  }
}

export class VersionNotFoundError extends Error {
  packageName: string
  version: string

  constructor(packageName: string, version: string) {
    super(`Version not found: ${packageName}@${version}`)
    this.name = 'VersionNotFoundError'
    this.packageName = packageName
    this.version = version
  }
}

export class InvalidPathError extends Error {
  path: string

  constructor(path: string) {
    super(`Invalid package path: ${path}`)
    this.name = 'InvalidPathError'
    this.path = path
  }
}
