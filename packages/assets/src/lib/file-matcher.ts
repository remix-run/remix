import * as fs from 'node:fs'
import picomatch from 'picomatch'

import { normalizeFilePath, resolveFilePath } from './paths.ts'

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

  let globMatcher = picomatch(resolvedPatternPath, { dot: true })
  return (filePath) => globMatcher(filePath)
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
