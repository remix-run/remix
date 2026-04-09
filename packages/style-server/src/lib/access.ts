import * as fs from 'node:fs'
import * as path from 'node:path'

import { normalizeFilePath, resolveFilePath } from './paths.ts'

type FileMatcher = (filePath: string) => boolean

export type AccessPolicy = {
  isAllowed(filePath: string): boolean
}

export function createAccessPolicy(options: {
  allow: readonly string[]
  deny?: readonly string[]
  root: string
}): AccessPolicy {
  let allowMatchers = options.allow.map((pattern) => createFileMatcher(pattern, options.root))
  let denyMatchers = (options.deny ?? []).map((pattern) => createFileMatcher(pattern, options.root))

  return {
    isAllowed(filePath) {
      if (!allowMatchers.some((matcher) => matcher(filePath))) return false
      if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath))) return false
      return true
    },
  }
}

function createFileMatcher(
  pattern: string,
  root: string,
  options: {
    allowDirectories?: boolean
    allowMissing?: boolean
  } = {},
): FileMatcher {
  let resolvedPatternPath = resolveFilePath(root, pattern)
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
        if (fs.statSync(resolveFilePath(root, pattern)).isDirectory()) {
          return (filePath) => isSameOrDescendantPath(filePath, resolvedPatternPath)
        }
      } catch {
        // Missing exact paths fall back to exact-file matching until they exist on disk.
      }
    }

    return (filePath) => filePath === resolvedPatternPath
  }

  return (filePath) => path.posix.matchesGlob(filePath, resolvedPatternPath)
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
