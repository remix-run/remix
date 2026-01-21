import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const packagesDir = path.relative(
  process.cwd(),
  path.resolve(__dirname, '..', '..', 'packages'),
)

export function getAllPackageDirNames(): string[] {
  return fs.readdirSync(packagesDir).filter((name) => {
    let packagePath = getPackagePath(name)
    return fs.existsSync(packagePath) && fs.statSync(packagePath).isDirectory()
  })
}

export function getPackagePath(packageDirName: string): string {
  return path.resolve(packagesDir, packageDirName)
}

export function getPackageFile(packageDirName: string, filename: string): string {
  return path.join(getPackagePath(packageDirName), filename)
}

/**
 * Builds a mapping from npm package names to directory names by reading
 * all package.json files in the packages directory.
 */
let getNpmPackageNameToDirectoryMap = (() => {
  let map: Map<string, string> | null = null

  return function getNpmPackageNameToDirectoryMap(): Map<string, string> {
    if (map !== null) {
      return map
    }

    map = new Map()
    let dirNames = getAllPackageDirNames()

    for (let dirName of dirNames) {
      let packageJsonPath = getPackageFile(dirName, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        try {
          let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
          if (typeof packageJson.name === 'string') {
            map.set(packageJson.name, dirName)
          }
        } catch {
          // Skip invalid package.json files
        }
      }
    }

    return map
  }
})()

/**
 * Converts an npm package name to the directory name in the packages folder.
 * Returns null if no mapping is found.
 *
 * Examples:
 *   "@remix-run/static-middleware" -> "static-middleware"
 *   "remix" -> "remix"
 */
export function packageNameToDirectoryName(packageName: string): string | null {
  return getNpmPackageNameToDirectoryMap().get(packageName) ?? null
}
