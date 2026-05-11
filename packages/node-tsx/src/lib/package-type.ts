import * as fs from 'node:fs'
import * as path from 'node:path'

export type ModuleFormat = 'commonjs' | 'module'

const packageTypeCache = new Map<string, ModuleFormat | null>()

export function getModuleFormat(filePath: string): ModuleFormat {
  let directory = path.dirname(filePath)

  while (true) {
    if (packageTypeCache.has(directory)) {
      let cachedPackageType = packageTypeCache.get(directory)
      if (cachedPackageType != null) {
        return cachedPackageType
      }

      let parentDirectory = path.dirname(directory)
      if (parentDirectory === directory || path.basename(directory) === 'node_modules') {
        return 'commonjs'
      }

      directory = parentDirectory
      continue
    }

    let packageType = readPackageType(path.join(directory, 'package.json'))
    packageTypeCache.set(directory, packageType)
    if (packageType != null) {
      return packageType
    }

    if (path.basename(directory) === 'node_modules') {
      return 'commonjs'
    }

    let parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) {
      return 'commonjs'
    }

    directory = parentDirectory
  }
}

function readPackageType(packageJsonPath: string): ModuleFormat | null {
  try {
    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (!isRecord(packageJson)) {
      throw new Error(`Invalid package.json at ${packageJsonPath}. Expected an object.`)
    }

    return packageJson.type === 'module' ? 'module' : 'commonjs'
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT' || nodeError.code === 'ENOTDIR') {
      return null
    }

    throw error
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
