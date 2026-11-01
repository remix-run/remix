import * as fs from 'node:fs'
import picomatch from 'picomatch'

import { isAbsoluteFilePath, normalizeFilePath, resolveFilePath } from './paths.ts'

export type FileMatcher = (filePath: string) => boolean

export function createFileMatcher(
  pattern: string,
  rootDir: string,
  options: {
    allowDirectories?: boolean
    allowMissing?: boolean
  } = {},
): FileMatcher {
  let resolvedPatternPath = resolveFilePath(rootDir, pattern)
  let allowDirectories = options.allowDirectories ?? true
  let allowMissing = options.allowMissing ?? true

  if (!containsGlobSyntax(pattern)) {
    try {
      resolvedPatternPath = normalizeFilePath(fs.realpathSync(resolvedPatternPath))
    } catch (error) {
      if (!allowMissing || !isPathNotFoundError(error)) throw error
    }

    if (allowDirectories) {
      try {
        if (fs.statSync(resolveFilePath(rootDir, pattern)).isDirectory()) {
          return (filePath) => isSameOrDescendantPath(filePath, resolvedPatternPath)
        }
      } catch (error) {
        if (!isPathNotFoundError(error)) throw error
      }
    }

    return (filePath) => filePath === resolvedPatternPath
  }

  let globMatcher = picomatch(escapeRootDirGlobSyntax(resolvedPatternPath, pattern, rootDir), {
    dot: true,
  })
  return (filePath) => globMatcher(filePath)
}

// The resolved pattern joins `rootDir` with the user's pattern, so any glob
// syntax in the root directory's own name (e.g. the parentheses in
// `app (copy)`) would otherwise be compiled as part of the glob: a `(copy)`
// group matches `copy` without the parentheses, and the project's own files
// stop matching. Escape the root directory portion so only the
// user-supplied pattern is treated as a glob. Absolute patterns are the
// user's own glob and are used verbatim.
function escapeRootDirGlobSyntax(
  resolvedPatternPath: string,
  pattern: string,
  rootDir: string,
): string {
  if (isAbsoluteFilePath(pattern)) {
    return resolvedPatternPath
  }

  let normalizedRootDir = resolveFilePath(rootDir, '.')
  let rootPrefix = normalizedRootDir === '/' ? '/' : `${normalizedRootDir}/`

  if (resolvedPatternPath !== normalizedRootDir && !resolvedPatternPath.startsWith(rootPrefix)) {
    // The pattern resolves outside the root directory (e.g. `../packages/**`),
    // so there is no root directory portion to escape.
    return resolvedPatternPath
  }

  let escapedRootDir = escapeGlobSyntax(normalizedRootDir)
  return escapedRootDir + resolvedPatternPath.slice(normalizedRootDir.length)
}

function escapeGlobSyntax(value: string): string {
  return value.replace(/[\\*?[\]{}()!+@]/g, '\\$&')
}

function isSameOrDescendantPath(filePath: string, directoryPath: string): boolean {
  let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '')

  return filePath === normalizedDirectoryPath || filePath.startsWith(`${normalizedDirectoryPath}/`)
}

function containsGlobSyntax(pattern: string): boolean {
  return /[*?[\]{}()!+@]/.test(pattern)
}

function isPathNotFoundError(
  error: unknown,
): error is NodeJS.ErrnoException & { code: 'ENOENT' | 'ENOTDIR' } {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  )
}
