import * as path from 'node:path'
import * as fs from 'node:fs'

export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/')
}

export function absolutePathToUrlSegmentFromResolvedRoots(
  absolutePath: string,
  root: string,
  workspaceRoot: string | null,
): { segment: string; namespace: 'root' | 'workspace' } | null {
  if (absolutePath.startsWith(root + path.sep) || absolutePath === root) {
    let relative = path.relative(root, absolutePath)
    return { segment: toPosixPath(relative), namespace: 'root' }
  }

  if (
    workspaceRoot &&
    (absolutePath.startsWith(workspaceRoot + path.sep) || absolutePath === workspaceRoot)
  ) {
    let relative = path.relative(workspaceRoot, absolutePath)
    return { segment: toPosixPath(relative), namespace: 'workspace' }
  }

  return null
}

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

  return absolutePathToUrlSegmentFromResolvedRoots(realPath, realRoot, realWorkspaceRoot)
}
