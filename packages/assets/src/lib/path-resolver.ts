import * as path from 'node:path'
import picomatch from 'picomatch'

// Convert a path to posix-style (forward slashes)
export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/')
}

// Check if a posix path matches any glob pattern in the list
export function matchesPatterns(posixPath: string, patterns: string[]): boolean {
  for (let pattern of patterns) {
    let matcher = picomatch(pattern, { dot: true })
    if (matcher(posixPath)) {
      return true
    }
  }
  return false
}

// Check if a path is allowed to be served
export function isPathAllowed(posixPath: string, allow: string[], deny: string[]): boolean {
  // Deny takes precedence
  if (deny.length > 0 && matchesPatterns(posixPath, deny)) {
    return false
  }
  // Must match at least one allow pattern (or allow is empty, which means deny everything)
  if (allow.length === 0) {
    return false
  }
  return matchesPatterns(posixPath, allow)
}
