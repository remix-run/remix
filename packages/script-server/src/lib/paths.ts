import * as path from 'node:path'

const windowsDriveLetterRE = /^[A-Za-z]:\//
const uncPrefixRE = /^\/\/[^/]+\/[^/]+/

export function normalizeWindowsPath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(windowsDriveLetterRE, (prefix) => `${prefix[0]!.toUpperCase()}${prefix.slice(1)}`)
}

export function normalizePathname(pathname: string): string {
  let normalized = path.posix.normalize(normalizeWindowsPath(pathname))

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  return normalized
}

export function isAbsoluteFilePath(filePath: string): boolean {
  let normalized = normalizeWindowsPath(filePath)
  return normalized.startsWith('/') || windowsDriveLetterRE.test(normalized)
}

export function normalizeFilePath(filePath: string): string {
  let normalized = normalizeWindowsPath(filePath)
  let uncRoot = getUncRoot(normalized)

  if (uncRoot) {
    let remainder = normalized.slice(uncRoot.length)
    let normalizedRemainder = path.posix.normalize(remainder || '/')
    return `${uncRoot}${normalizedRemainder === '/' ? '' : normalizedRemainder}`
  }

  if (windowsDriveLetterRE.test(normalized)) {
    return path.posix.normalize(normalized)
  }

  if (normalized.startsWith('/')) {
    return path.posix.normalize(normalized)
  }

  return path.posix.normalize(normalizeWindowsPath(path.resolve(normalized)))
}

export function resolveFilePath(root: string, filePath: string): string {
  if (isAbsoluteFilePath(filePath)) {
    return normalizeFilePath(filePath)
  }

  return normalizeFilePath(`${root.replace(/\/+$/, '')}/${normalizeWindowsPath(filePath)}`)
}

function getUncRoot(filePath: string): string | null {
  return filePath.startsWith('//') ? (filePath.match(uncPrefixRE)?.[0] ?? null) : null
}
