import * as path from 'node:path'
import picomatch from 'picomatch'
import type { CreateDevAssetsHandlerOptions } from './options.ts'

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

export type DevPathResolution =
  | { kind: 'app'; filePath: string }
  | { kind: 'workspace'; filePath: string }

/**
 * Creates a function that resolves a request pathname to an absolute file path and kind (app vs workspace).
 * Returns null if the path is not allowed or not found.
 *
 * @param options Handler options for root, allow, deny, workspaceRoot, workspaceAllow, workspaceDeny.
 * @returns Resolver function (pathname) => { kind, filePath } or null.
 */
export function createDevPathResolver(
  options: CreateDevAssetsHandlerOptions,
): (pathname: string) => DevPathResolution | null {
  let root = path.resolve(process.cwd(), options.root ?? '.')
  let appAllow = options.allow ?? []
  let appDeny = options.deny ?? []
  let workspaceRoot = options.workspaceRoot ? path.resolve(options.workspaceRoot) : null
  let workspaceAllow = options.workspaceAllow ?? appAllow
  let workspaceDeny = options.workspaceDeny ?? appDeny

  return function resolvePathname(pathname: string): DevPathResolution | null {
    if (pathname.startsWith('/__@workspace/')) {
      if (!workspaceRoot) return null
      let posixPath = pathname.slice('/__@workspace/'.length)
      if (!isPathAllowed(posixPath, workspaceAllow, workspaceDeny)) return null
      let filePath = path.join(workspaceRoot, ...posixPath.split('/'))
      return { kind: 'workspace', filePath }
    }

    let relativePath = pathname.replace(/^\/+/, '')
    let posixPath = toPosixPath(relativePath)
    if (!isPathAllowed(posixPath, appAllow, appDeny)) return null
    let filePath = path.join(root, relativePath)
    return { kind: 'app', filePath }
  }
}
