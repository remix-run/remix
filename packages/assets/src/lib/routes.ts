import * as fs from 'node:fs'

import {
  isAbsoluteFilePath,
  normalizeFilePath,
  normalizePathname,
  resolveFilePath,
} from './paths.ts'

interface MountConfig {
  mounts: Readonly<Record<string, string>>
  rootDir: string
}

interface CompiledMount {
  fileRoot: string
  fileRootValue: string
  urlRoot: string
  urlRootKey: string
}

export interface CompiledRoutes {
  resolveUrlPathname(pathname: string): string | null
  toUrlPathname(filePath: string): string | null
}

export function compileRoutes(
  basePath: string,
  mountConfigs: readonly MountConfig[],
): CompiledRoutes {
  let compiledMounts = mountConfigs.flatMap((mountConfig) => {
    let configMounts = Object.entries(mountConfig.mounts).map(([urlRoot, fileRoot]) =>
      compileMount(urlRoot, fileRoot, {
        basePath,
        rootDir: mountConfig.rootDir,
      }),
    )
    validateNoOverlappingMounts(configMounts)
    return configMounts
  })
  validateNoOverlappingUrlRoots(compiledMounts)

  return {
    resolveUrlPathname(pathname) {
      let normalizedPathname = normalizePathname(pathname)

      for (let mount of compiledMounts) {
        let relativePathname = getPathWithinRoot(mount.urlRoot, normalizedPathname)
        if (relativePathname === null) continue
        let filePath = resolveFilePath(mount.fileRoot, decodeURIComponent(relativePathname))
        return getPathWithinRoot(mount.fileRoot, filePath) === null ? null : filePath
      }

      return null
    },
    toUrlPathname(filePath) {
      let normalizedFilePath = normalizeFilePath(filePath)

      for (let mount of compiledMounts) {
        let relativeFilePath = getPathWithinRoot(mount.fileRoot, normalizedFilePath)
        if (relativeFilePath === null) continue
        let encodedFilePath = relativeFilePath.split('/').map(encodeURIComponent).join('/')
        return joinUrlPath(mount.urlRoot, encodedFilePath)
      }

      return null
    },
  }
}

function compileMount(
  urlRoot: string,
  fileRoot: string,
  options: {
    basePath: string
    rootDir: string
  },
): CompiledMount {
  if (isAbsoluteFilePath(fileRoot)) {
    throw new TypeError(`mounts values must be relative to rootDir. Received "${fileRoot}".`)
  }

  return {
    fileRoot: resolveMountFileRoot(options.rootDir, fileRoot),
    fileRootValue: fileRoot,
    urlRoot: joinUrlPath(normalizeMountUrlRoot(options.basePath), normalizeMountUrlRoot(urlRoot)),
    urlRootKey: urlRoot,
  }
}

function normalizeMountUrlRoot(urlRoot: string): string {
  let normalizedRoot = normalizePathname(urlRoot).replace(/\/+$/, '') || '/'
  let url = new URL(normalizedRoot, 'http://remix.run')

  if (
    url.search !== '' ||
    url.hash !== '' ||
    getUrlPathSegmentCount(url.pathname) !== getUrlPathSegmentCount(normalizedRoot)
  ) {
    throw new TypeError(
      `mounts keys must be URL pathnames without query strings, fragments, or encoded dot segments. Received "${urlRoot}".`,
    )
  }

  return url.pathname.replace(/\/+$/, '') || '/'
}

function resolveMountFileRoot(rootDir: string, fileRoot: string): string {
  let resolvedRoot = resolveFilePath(rootDir, fileRoot)

  try {
    resolvedRoot = normalizeFilePath(fs.realpathSync(resolvedRoot))
  } catch (error) {
    if (!isUnresolvedPathError(error, resolvedRoot)) throw error
  }

  return resolvedRoot.replace(/\/+$/, '') || '/'
}

function getUrlPathSegmentCount(pathname: string): number {
  return pathname.split('/').filter((segment) => segment !== '').length
}

function joinUrlPath(root: string, path: string): string {
  if (path === '' || path === '/') return normalizeMountUrlRoot(root)
  return normalizePathname(`${root.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`)
}

function getPathWithinRoot(root: string, value: string): string | null {
  if (value === root) return ''
  if (root === '/') return value.slice(1)
  if (!value.startsWith(`${root}/`)) return null
  return value.slice(root.length + 1)
}

function validateNoOverlappingMounts(mounts: readonly CompiledMount[]): void {
  for (let index = 0; index < mounts.length; index++) {
    let mount = mounts[index]

    for (let otherIndex = index + 1; otherIndex < mounts.length; otherIndex++) {
      let otherMount = mounts[otherIndex]

      if (rootsOverlap(mount.fileRoot, otherMount.fileRoot)) {
        throw new TypeError(
          `mounts values must not overlap. Received "${mount.fileRootValue}" and "${otherMount.fileRootValue}", resolving to "${mount.fileRoot}" and "${otherMount.fileRoot}".`,
        )
      }
    }
  }
}

function validateNoOverlappingUrlRoots(mounts: readonly CompiledMount[]): void {
  for (let index = 0; index < mounts.length; index++) {
    let mount = mounts[index]

    for (let otherIndex = index + 1; otherIndex < mounts.length; otherIndex++) {
      let otherMount = mounts[otherIndex]
      if (!rootsOverlap(mount.urlRoot, otherMount.urlRoot)) continue

      throw new TypeError(
        `mounts keys must not overlap. Received "${mount.urlRootKey}" and "${otherMount.urlRootKey}".`,
      )
    }
  }
}

function rootsOverlap(root: string, otherRoot: string): boolean {
  return (
    root === otherRoot ||
    root === '/' ||
    otherRoot === '/' ||
    root.startsWith(`${otherRoot}/`) ||
    otherRoot.startsWith(`${root}/`)
  )
}

function isUnresolvedPathError(error: unknown, filePath: string): boolean {
  // Windows reports UNKNOWN rather than ENOENT when a UNC share cannot be reached.
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' ||
      error.code === 'ENOTDIR' ||
      (error.code === 'UNKNOWN' && filePath.startsWith('//')))
  )
}
