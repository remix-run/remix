import * as fs from 'node:fs'
import picomatch from 'picomatch'

import { normalizeFilePath, resolveFilePath, isSameOrDescendantPath } from './paths.ts'
import { isNoEntityError } from './fs-errors.ts'

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
      if (!allowMissing || !isNoEntityError(error)) throw error
    }

    if (allowDirectories) {
      try {
        if (fs.statSync(resolveFilePath(rootDir, pattern)).isDirectory()) {
          return (filePath) => isSameOrDescendantPath(filePath, resolvedPatternPath)
        }
      } catch (error) {
        if (!isNoEntityError(error)) throw error
      }
    }

    return (filePath) => filePath === resolvedPatternPath
  }

  let globMatcher = picomatch(resolvedPatternPath, { dot: true })
  return (filePath) => globMatcher(filePath)
}

function containsGlobSyntax(pattern: string): boolean {
  return /[*?[\]{}()!+@]/.test(pattern)
}
