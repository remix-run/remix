import * as path from 'node:path'
import * as fs from 'node:fs'

export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/')
}

// Given an absolute file path, return the URL path segment relative to root
// (or workspaceRoot if outside root), along with which namespace it belongs to.
// Returns null if the path is not under root or workspaceRoot.
export function absolutePathToUrlSegment(
  absolutePath: string,
  root: string,
  workspaceRoot: string | null,
): { segment: string; namespace: 'root' | 'workspace' } | null {
  let realPath: string
  let realRoot: string
  let realWorkspaceRoot: string | null

  try {
    realPath = fs.realpathSync(absolutePath)
    realRoot = fs.realpathSync(root)
    realWorkspaceRoot = workspaceRoot ? fs.realpathSync(workspaceRoot) : null
  } catch {
    realPath = path.normalize(absolutePath)
    realRoot = path.normalize(root)
    realWorkspaceRoot = workspaceRoot ? path.normalize(workspaceRoot) : null
  }

  if (realPath.startsWith(realRoot + path.sep) || realPath === realRoot) {
    let relative = path.relative(realRoot, realPath)
    return { segment: toPosixPath(relative), namespace: 'root' }
  }

  if (
    realWorkspaceRoot &&
    (realPath.startsWith(realWorkspaceRoot + path.sep) || realPath === realWorkspaceRoot)
  ) {
    let relative = path.relative(realWorkspaceRoot, realPath)
    return { segment: toPosixPath(relative), namespace: 'workspace' }
  }

  return null
}
