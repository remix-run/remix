import * as path from 'node:path'

export interface ResolvedScriptRoot {
  prefix: string | null
  directory: string
}

interface ResolvedRootMatch<root extends ResolvedScriptRoot = ResolvedScriptRoot> {
  resolvedRoot: root
  relativePath: string
  publicPath: string
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join('/')
}

export function normalizeRootPrefix(prefix?: string): string | null {
  if (prefix == null) return null

  let normalized = prefix.trim().replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/')
  if (normalized === '') return null
  if (normalized.includes('\\')) {
    throw new Error(`Invalid root prefix "${prefix}". Prefixes must use "/" separators.`)
  }

  let segments = normalized.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(
      `Invalid root prefix "${prefix}". Prefixes cannot contain "." or ".." segments.`,
    )
  }

  return normalized
}

function joinPublicPath(prefix: string | null, relativePath: string): string {
  let normalizedRelativePath = toPosixPath(relativePath)
  if (prefix == null) return normalizedRelativePath
  return normalizedRelativePath === '' ? prefix : `${prefix}/${normalizedRelativePath}`
}

function isPathInsideDirectory(absolutePath: string, directory: string): boolean {
  return absolutePath === directory || absolutePath.startsWith(directory + path.sep)
}

function matchesPrefixBoundary(publicPath: string, prefix: string): boolean {
  return publicPath === prefix || publicPath.startsWith(`${prefix}/`)
}

export function resolveAbsolutePathFromResolvedRoots<root extends ResolvedScriptRoot>(
  absolutePath: string,
  roots: readonly root[],
): ResolvedRootMatch<root> | null {
  for (let resolvedRoot of roots) {
    if (!isPathInsideDirectory(absolutePath, resolvedRoot.directory)) continue

    let relativePath = toPosixPath(path.relative(resolvedRoot.directory, absolutePath))
    return {
      resolvedRoot,
      relativePath,
      publicPath: joinPublicPath(resolvedRoot.prefix, relativePath),
    }
  }

  return null
}

export function resolvePublicPathFromResolvedRoots<root extends ResolvedScriptRoot>(
  publicPath: string,
  roots: readonly root[],
): ResolvedRootMatch<root> | null {
  let normalizedPublicPath = publicPath.replace(/^\/+/, '')

  for (let resolvedRoot of roots) {
    if (resolvedRoot.prefix == null) continue
    if (!matchesPrefixBoundary(normalizedPublicPath, resolvedRoot.prefix)) continue

    return {
      resolvedRoot,
      relativePath:
        normalizedPublicPath === resolvedRoot.prefix
          ? ''
          : normalizedPublicPath.slice(resolvedRoot.prefix.length + 1),
      publicPath: normalizedPublicPath,
    }
  }

  let fallbackRoot = roots.find((resolvedRoot) => resolvedRoot.prefix == null)
  if (!fallbackRoot) return null

  return {
    resolvedRoot: fallbackRoot,
    relativePath: normalizedPublicPath,
    publicPath: normalizedPublicPath,
  }
}
