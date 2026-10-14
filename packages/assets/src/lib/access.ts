import * as fs from 'node:fs'
import * as path from 'node:path'
import { createFileMatcher } from './file-matcher.ts'
import { isInjectedPackageFilePath } from './injected-packages.ts'
import { normalizeFilePath } from './paths.ts'

/** Access-policy result for an inspected asset file. */
export interface AssetAccessDetails {
  /** Whether the asset server may serve the file. */
  allowed: boolean
  /** The first configured rule that allowed the file, when one matched. */
  allowedBy?: AssetAccessRule
  /** The first matching `denyFiles` pattern, when access was denied. */
  deniedBy?: string
}

/** Rule that allows an inspected asset file to be served. */
export type AssetAccessRule =
  /** A matching `allowFiles` entry. */
  | { kind: 'file'; value: string }
  /** A runtime file provided internally by the asset server. */
  | { kind: 'injected'; value: string }
  /** A matching `allowPackages` entry. */
  | { kind: 'package'; value: string }

export type AccessPolicy = {
  getAllowedPackageRoots(): readonly string[]
  getPackageWatchDirectories(): readonly string[]
  handleFileEvent(filePath: string): void
  inspect(filePath: string): AssetAccessDetails
  isAllowed(filePath: string): boolean
}

const packageStateFileNames = new Set([
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
])
const packageManagerRootFileNames = packageStateFileNames
const packageNamePartPattern = /^[A-Za-z0-9._~-]+$/

export function createAccessPolicy(options: {
  allowFiles: readonly string[]
  allowPackages?: readonly string[]
  denyFiles?: readonly string[]
  packageSearchRoots?: readonly string[]
  rootDir: string
}): AccessPolicy {
  let allowMatchers = options.allowFiles.map((pattern) => ({
    matcher: createFileMatcher(pattern, options.rootDir),
    pattern,
  }))
  let allowPackageNames = normalizePackageNames(options.allowPackages, 'allowPackages')
  let denyMatchers = (options.denyFiles ?? []).map((pattern) => ({
    matcher: createFileMatcher(pattern, options.rootDir),
    pattern,
  }))
  let packageSearchRoots = [options.rootDir, ...(options.packageSearchRoots ?? [])]
  let packageRootPaths = createPackageRootPaths({
    allowPackageNames,
    searchRoots: packageSearchRoots,
  })
  let allowPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths)
  let packageStateDirectories =
    allowPackageNames.size === 0 ? [] : getPackageStateDirectories(packageSearchRoots)
  let packageRootsDirty = false

  function refreshPackageRootPathTries(): void {
    if (!packageRootsDirty) return

    packageRootPaths = createPackageRootPaths({
      allowPackageNames,
      searchRoots: packageSearchRoots,
    })
    allowPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths)
    packageRootsDirty = false
  }

  function getAllowedPackageName(filePath: string): string | undefined {
    if (allowPackageNames.size === 0) return undefined
    refreshPackageRootPathTries()

    return getPackageNameFromRootPathTrie(filePath, allowPackageRootPathTrie)
  }

  function inspect(filePath: string): AssetAccessDetails {
    if (isInjectedPackageFilePath(filePath)) {
      return { allowed: true, allowedBy: { kind: 'injected', value: '@remix-run/assets' } }
    }

    let allowedBy: AssetAccessRule | undefined
    let allowMatch = allowMatchers.find(({ matcher }) => matcher(filePath))
    if (allowMatch) {
      allowedBy = { kind: 'file', value: allowMatch.pattern }
    } else {
      let packageName = getAllowedPackageName(filePath)
      if (packageName !== undefined) {
        allowedBy = { kind: 'package', value: packageName }
      }
    }

    if (!allowedBy) return { allowed: false }

    let denyMatch = denyMatchers.find(({ matcher }) => matcher(filePath))
    if (denyMatch) {
      return { allowed: false, allowedBy, deniedBy: denyMatch.pattern }
    }

    return { allowed: true, allowedBy }
  }

  return {
    getAllowedPackageRoots() {
      refreshPackageRootPathTries()
      return [...packageRootPaths.keys()]
    },
    getPackageWatchDirectories() {
      if (allowPackageNames.size === 0) return []
      return packageStateDirectories
    },
    handleFileEvent(filePath) {
      if (allowPackageNames.size === 0) return
      if (!isPackageStateFileEvent(filePath, packageStateDirectories)) return

      packageRootsDirty = true
    },
    inspect,
    isAllowed(filePath) {
      return inspect(filePath).allowed
    },
  }
}

function normalizePackageNames(
  packageOption: readonly string[] | undefined,
  optionName: 'allowPackages',
): Set<string> {
  let packageNames = new Set<string>()

  for (let packageName of packageOption ?? []) {
    if (typeof packageName !== 'string') {
      throw new TypeError(`${optionName} values must be strings`)
    }

    let normalizedPackageName = packageName.trim()
    if (!isValidPackageName(normalizedPackageName)) {
      throw new TypeError(`${optionName} values must be package names. Received "${packageName}".`)
    }

    packageNames.add(normalizedPackageName)
  }

  return packageNames
}

function validatePackageName(packageName: string, message: string): void {
  if (!isValidPackageName(packageName)) {
    throw new TypeError(message)
  }
}

type PackageJson = {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

type PackageRootPathTrie = {
  children: Map<string, PackageRootPathTrie>
  packageName?: string
}

type PackageRootQueueItem = {
  packageJsonPath: string
  packageName: string
}

function createPackageRootPaths(options: {
  allowPackageNames: ReadonlySet<string>
  searchRoots: readonly string[]
}): Map<string, string> {
  let allowPackageRootPaths = new Map<string, string>()
  let allowQueue: PackageRootQueueItem[] = []
  let seenAllowedPackageRoots = new Set<string>()
  let searchRoots = normalizePackageSearchRoots(options.searchRoots)

  for (let packageName of options.allowPackageNames) {
    let foundPackage = false

    for (let searchRoot of searchRoots) {
      let packageJsonPath = findPackageJsonPath(packageName, searchRoot)
      if (packageJsonPath === null) continue

      foundPackage = true
      allowQueue.push({ packageJsonPath, packageName })
    }

    if (!foundPackage) {
      throw new TypeError(`Could not resolve allowed package "${packageName}".`)
    }
  }

  while (allowQueue.length > 0) {
    let { packageJsonPath, packageName } = allowQueue.shift()!
    let packageRootPath = normalizeFilePath(path.dirname(packageJsonPath))
    if (seenAllowedPackageRoots.has(packageRootPath)) continue
    seenAllowedPackageRoots.add(packageRootPath)

    let packageJson = readPackageJson(packageJsonPath)
    allowPackageRootPaths.set(packageRootPath, packageName)

    for (let dependencyName of Object.keys(packageJson.dependencies ?? {})) {
      validatePackageName(
        dependencyName,
        `Dependency "${dependencyName}" from ${packageJsonPath} must be a package name.`,
      )
      let dependencyPackageJsonPath = findPackageJsonPath(dependencyName, packageRootPath)
      if (dependencyPackageJsonPath === null) {
        throw new TypeError(
          `Could not resolve dependency "${dependencyName}" from ${packageJsonPath}.`,
        )
      }
      allowQueue.push({
        packageJsonPath: dependencyPackageJsonPath,
        packageName: dependencyName,
      })
    }
    for (let dependencyName of Object.keys(packageJson.optionalDependencies ?? {})) {
      validatePackageName(
        dependencyName,
        `Optional dependency "${dependencyName}" from ${packageJsonPath} must be a package name.`,
      )
      let dependencyPackageJsonPath = findPackageJsonPath(dependencyName, packageRootPath)
      if (dependencyPackageJsonPath !== null) {
        allowQueue.push({
          packageJsonPath: dependencyPackageJsonPath,
          packageName: dependencyName,
        })
      }
    }
  }

  return allowPackageRootPaths
}

function createPackageRootPathTrie(
  packageRootPaths: ReadonlyMap<string, string>,
): PackageRootPathTrie {
  let rootNode = createPackageRootPathTrieNode()

  for (let [packageRootPath, packageName] of packageRootPaths) {
    let node = rootNode
    for (let segment of getFilePathSegments(packageRootPath)) {
      let childNode = node.children.get(segment)
      if (!childNode) {
        childNode = createPackageRootPathTrieNode()
        node.children.set(segment, childNode)
      }
      node = childNode
    }
    node.packageName = packageName
  }

  return rootNode
}

function createPackageRootPathTrieNode(): PackageRootPathTrie {
  return {
    children: new Map(),
  }
}

function getPackageNameFromRootPathTrie(
  filePath: string,
  trie: PackageRootPathTrie,
): string | undefined {
  let node = trie
  if (node.packageName !== undefined) return node.packageName

  for (let segment of getFilePathSegments(filePath)) {
    let childNode = node.children.get(segment)
    if (!childNode) return undefined
    if (childNode.packageName !== undefined) return childNode.packageName
    node = childNode
  }

  return undefined
}

function getFilePathSegments(filePath: string): string[] {
  return normalizeFilePath(filePath).split('/')
}

function normalizePackageSearchRoots(searchRoots: readonly string[]): string[] {
  let normalizedSearchRoots = new Set<string>()

  for (let searchRoot of searchRoots) {
    let normalizedSearchRoot = normalizeFilePath(searchRoot)
    normalizedSearchRoots.add(normalizedSearchRoot)

    if (path.basename(normalizedSearchRoot) === 'node_modules') {
      normalizedSearchRoots.add(path.dirname(normalizedSearchRoot))
    }
  }

  return [...normalizedSearchRoots]
}

function getPackageStateDirectories(searchRoots: readonly string[]): string[] {
  let packageStateDirectories = new Set<string>()

  for (let searchRoot of searchRoots) {
    let packageManagerRoot = findPackageManagerRoot(searchRoot)
    if (packageManagerRoot !== null) {
      packageStateDirectories.add(packageManagerRoot)
    }
  }

  return [...packageStateDirectories]
}

function isPackageStateFileEvent(
  filePath: string,
  packageStateDirectories: readonly string[],
): boolean {
  let normalizedFilePath = normalizeFilePath(filePath)
  let fileName = path.basename(normalizedFilePath)
  if (!packageStateFileNames.has(fileName)) return false

  let directory = path.dirname(normalizedFilePath)
  return packageStateDirectories.some(
    (packageStateDirectory) => directory === packageStateDirectory,
  )
}

function findPackageManagerRoot(startDirectory: string): string | null {
  let directory = normalizePackageStateSearchRoot(startDirectory)

  while (true) {
    if (hasPackageManagerRootFile(directory)) return directory

    let parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) return null
    directory = parentDirectory
  }
}

function normalizePackageStateSearchRoot(searchRoot: string): string {
  let normalizedSearchRoot = normalizeFilePath(searchRoot)
  return path.basename(normalizedSearchRoot) === 'node_modules'
    ? path.dirname(normalizedSearchRoot)
    : normalizedSearchRoot
}

function hasPackageManagerRootFile(directory: string): boolean {
  for (let fileName of packageManagerRootFileNames) {
    try {
      let stat = fs.statSync(path.join(directory, fileName))
      if (stat.isFile()) return true
    } catch (error) {
      if (isPathNotFoundError(error)) continue
      throw error
    }
  }

  return false
}

function findPackageJsonPath(packageName: string, startDirectory: string): string | null {
  let directory = normalizeFilePath(startDirectory)

  while (true) {
    let packageJsonPath = resolvePackageJsonPath(directory, packageName)
    if (packageJsonPath !== null) return packageJsonPath

    let parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) return null
    directory = parentDirectory
  }
}

function resolvePackageJsonPath(directory: string, packageName: string): string | null {
  let packagePath =
    path.basename(directory) === 'node_modules'
      ? path.join(directory, packageName, 'package.json')
      : path.join(directory, 'node_modules', packageName, 'package.json')

  try {
    return normalizeFilePath(fs.realpathSync(packagePath))
  } catch (error) {
    if (isPathNotFoundError(error)) return null
    throw error
  }
}

function readPackageJson(packageJsonPath: string): PackageJson {
  let packageJson: unknown

  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as unknown
  } catch (error) {
    if (isPathNotFoundError(error)) return {}
    throw error
  }

  if (packageJson === null || typeof packageJson !== 'object') {
    return {}
  }

  return {
    dependencies: readDependencyMap(packageJson, 'dependencies'),
    optionalDependencies: readDependencyMap(packageJson, 'optionalDependencies'),
  }
}

function readDependencyMap(packageJson: object, key: string): Record<string, string> | undefined {
  if (!(key in packageJson)) return undefined

  let value = packageJson[key as keyof typeof packageJson]
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  let dependencies: Record<string, string> = {}
  for (let [dependencyName, dependencyVersion] of Object.entries(value)) {
    if (typeof dependencyVersion === 'string') {
      dependencies[dependencyName] = dependencyVersion
    }
  }

  return dependencies
}

function isValidPackageName(packageName: string): boolean {
  if (packageName.length === 0) return false

  let packageNameParts = packageName.startsWith('@')
    ? packageName.slice(1).split('/')
    : packageName.split('/')

  if (packageNameParts.length !== (packageName.startsWith('@') ? 2 : 1)) return false

  return packageNameParts.every(
    (part) => part.length > 0 && part !== '.' && part !== '..' && packageNamePartPattern.test(part),
  )
}

function isPathNotFoundError(
  error: unknown,
): error is NodeJS.ErrnoException & { code: 'ENOENT' | 'ENOTDIR' } {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  )
}
