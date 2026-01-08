import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readJson } from './fs.ts'
import { getFileAtRef } from './git.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const packagesDir = path.relative(
  process.cwd(),
  path.resolve(__dirname, '..', '..', 'packages'),
)

export function getAllPackageNames(): string[] {
  return fs.readdirSync(packagesDir).filter((name) => {
    let dir = getPackageDir(name)
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
  })
}

export function getPackageDir(packageName: string): string {
  return path.resolve(packagesDir, packageName)
}

export function getPackageFile(packageName: string, filename: string): string {
  return path.join(getPackageDir(packageName), filename)
}

interface VersionedPackage {
  packageName: string
  version: string
  tag: string
}

/**
 * Get packages that have version changes compared to the parent commit
 */
export function getVersionedPackages(): VersionedPackage[] {
  let packageNames = getAllPackageNames()
  let versioned: VersionedPackage[] = []

  for (let packageName of packageNames) {
    let currentVersion = readJson(getPackageFile(packageName, 'package.json')).version
    let previousContent = getFileAtRef(getPackageFile(packageName, 'package.json'), 'HEAD~1')
    let previousVersion = previousContent ? JSON.parse(previousContent).version : null

    if (previousVersion !== null && currentVersion !== previousVersion) {
      versioned.push({
        packageName,
        version: currentVersion,
        tag: `${packageName}@${currentVersion}`,
      })
    }
  }

  return versioned
}
