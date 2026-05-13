import * as fs from 'node:fs'
import { findPackageJSON } from 'node:module'
import { pathToFileURL } from 'node:url'

export type ModuleFormat = 'commonjs' | 'module'

const packageTypeCache = new Map<string, ModuleFormat>()

export function getModuleFormat(filePath: string): ModuleFormat {
  let packageJsonPath = findPackageJSON(pathToFileURL(filePath))
  if (packageJsonPath == null) {
    return 'commonjs'
  }

  let cachedPackageType = packageTypeCache.get(packageJsonPath)
  if (cachedPackageType != null) {
    return cachedPackageType
  }

  let packageType = readPackageType(packageJsonPath)
  packageTypeCache.set(packageJsonPath, packageType)
  return packageType
}

function readPackageType(packageJsonPath: string): ModuleFormat {
  try {
    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (!isRecord(packageJson)) {
      throw new Error(`Invalid package.json at ${packageJsonPath}. Expected an object.`)
    }

    return packageJson.type === 'module' ? 'module' : 'commonjs'
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT' || nodeError.code === 'ENOTDIR') {
      return 'commonjs'
    }

    throw error
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
