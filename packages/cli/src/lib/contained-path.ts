import * as path from 'node:path'

export function resolveContainedPath(rootDir: string, relativePath: string): string {
  let resolvedRootDir = path.resolve(rootDir)
  let resolvedPath = path.resolve(resolvedRootDir, relativePath)
  let pathFromRoot = path.relative(resolvedRootDir, resolvedPath)

  if (pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !path.isAbsolute(pathFromRoot))) {
    return resolvedPath
  }

  throw new Error(`Resolved path escapes the allowed root: ${relativePath}`)
}
