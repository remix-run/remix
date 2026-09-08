import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Walks up from `startDir` looking for the closest directory that contains
 * `relativeFilePath`.
 *
 * @param startDir Directory the walk starts from.
 * @param relativeFilePath Slash-separated app file path, for example `app/routes.ts`.
 * @returns The closest ancestor directory that contains the file, or `null`
 *          when no ancestor contains it.
 */
export async function findAppRoot(
  startDir: string,
  relativeFilePath: string,
): Promise<string | null> {
  let relativeSegments = relativeFilePath.split('/')
  let currentDir = path.resolve(startDir)

  while (true) {
    if (await pathExists(path.join(currentDir, ...relativeSegments))) {
      return currentDir
    }

    let parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return null
    }

    currentDir = parentDir
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return false
    }

    throw error
  }
}
