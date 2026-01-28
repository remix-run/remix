import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const packagesDir = path.relative(
  process.cwd(),
  path.resolve(__dirname, '..', '..', 'packages'),
)

export const GITHUB_REPO_URL = 'https://github.com/remix-run/remix'

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

/**
 * Returns the short name used in git tags for a package.
 * For @remix-run/* packages, strips the scope. For "remix", returns "remix".
 *
 * Examples:
 *   "@remix-run/headers" -> "headers"
 *   "remix" -> "remix"
 */
export function getPackageShortName(packageName: string): string {
  if (packageName.startsWith('@remix-run/')) {
    return packageName.slice('@remix-run/'.length)
  }
  return packageName
}

/**
 * Generates the git tag for a package release.
 *
 * Examples:
 *   ("@remix-run/headers", "0.11.0") -> "headers@0.11.0"
 *   ("remix", "3.0.0") -> "remix@3.0.0"
 */
export function getGitTag(packageName: string, version: string): string {
  return `${getPackageShortName(packageName)}@${version}`
}

/**
 * Generates the GitHub release URL for a package release.
 */
export function getGitHubReleaseUrl(packageName: string, version: string): string {
  let tag = getGitTag(packageName, version)
  return `${GITHUB_REPO_URL}/releases/tag/${tag}`
}

interface PackageInfo {
  name: string
  version: string
  dirName: string
  dependencies: string[] // Only @remix-run/* dependencies
}

/**
 * Gets information about all packages in the monorepo, including their
 * @remix-run/* dependencies.
 */
let getPackageInfoMap = (() => {
  let map: Map<string, PackageInfo> | null = null

  return function getPackageInfoMap(): Map<string, PackageInfo> {
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
          let name = packageJson.name as string
          let version = packageJson.version as string

          // Collect @remix-run/* dependencies from the dependencies field
          let dependencies: string[] = []
          let deps = packageJson.dependencies as Record<string, string> | undefined
          if (deps) {
            for (let depName of Object.keys(deps)) {
              if (depName.startsWith('@remix-run/') || depName === 'remix') {
                dependencies.push(depName)
              }
            }
          }

          map.set(name, { name, version, dirName, dependencies })
        } catch {
          // Skip invalid package.json files
        }
      }
    }

    return map
  }
})()

/**
 * Gets the @remix-run/* dependencies for a package.
 */
export function getPackageDependencies(packageName: string): string[] {
  let info = getPackageInfoMap().get(packageName)
  return info?.dependencies ?? []
}

/**
 * Builds a reverse dependency graph: maps each package to the set of packages
 * that depend on it.
 */
export function buildReverseDependencyGraph(): Map<string, Set<string>> {
  let graph = new Map<string, Set<string>>()
  let packageInfoMap = getPackageInfoMap()

  // Initialize empty sets for all packages
  for (let packageName of packageInfoMap.keys()) {
    graph.set(packageName, new Set())
  }

  // Build reverse edges
  for (let [packageName, info] of packageInfoMap) {
    for (let dep of info.dependencies) {
      let dependents = graph.get(dep)
      if (dependents) {
        dependents.add(packageName)
      }
    }
  }

  return graph
}

/**
 * Gets all packages that transitively depend on any of the given packages.
 * Returns a map from dependent package name to the set of changed packages it depends on.
 */
export function getTransitiveDependents(
  changedPackages: Set<string>,
): Map<string, Set<string>> {
  let reverseGraph = buildReverseDependencyGraph()
  let result = new Map<string, Set<string>>()

  // For each changed package, find all its transitive dependents
  function addDependents(changedPackage: string, originalChangedPackage: string) {
    let directDependents = reverseGraph.get(changedPackage)
    if (!directDependents) return

    for (let dependent of directDependents) {
      // Skip if this is one of the originally changed packages
      if (changedPackages.has(dependent)) continue

      // Track which changed packages this dependent needs
      let changedDeps = result.get(dependent)
      if (!changedDeps) {
        changedDeps = new Set()
        result.set(dependent, changedDeps)
      }
      changedDeps.add(originalChangedPackage)

      // Recursively process dependents
      addDependents(dependent, originalChangedPackage)
    }
  }

  for (let changedPackage of changedPackages) {
    addDependents(changedPackage, changedPackage)
  }

  return result
}
