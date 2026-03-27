import * as path from 'node:path'

import { getRuntimeCwd } from './runtime-context.ts'

export function getDisplayPath(filePath: string, cwd: string = getRuntimeCwd()): string {
  let relativePath = path.relative(path.resolve(cwd), path.resolve(filePath))

  if (relativePath.length === 0) {
    return '.'
  }

  if (path.isAbsolute(relativePath)) {
    return filePath
  }

  return relativePath
}
