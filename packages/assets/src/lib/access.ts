import * as fs from 'node:fs'
import * as path from 'node:path'
import { createFileMatcher } from './file-matcher.ts'
import { isInjectedPackageFilePath } from './injected-packages.ts'
import { normalizeFilePath } from './paths.ts'

type AccessPolicy = {
  getPackageWatchDirectories(): readonly string[]
  handleFileEvent(filePath: string): void
  isAllowed(filePath: string): boolean
}

const packageStateFileNames = new Set([
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])
const packageNamePartPattern = /^[A-Za-z0-9._~-]+$/

export function createAccessPolicy(options: {
  allowFiles: readonly string[]
  allowPackages?: readonly string[]
  denyFiles?: readonly string[]
  denyPackages?: readonly string[]
  packageSearchRoots?: readonly string[]
  rootDir: string
}): AccessPolicy {
  let allowMatchers = options.allowFiles.map((pattern) =>
    createFileMatcher(pattern, options.rootDir),
  )
  let allowPackageNames = normalizePackageNames(options.allowPackages, 'allowPackages')
  let denyPackageNames = normalizePackageNames(options.denyPackages, 'denyPackages')
  let denyMatchers = (options.denyFiles ?? []).map((pattern) =>
    createFileMatcher(pattern, options.rootDir),
  )
  let packageSearchRoots = [options.rootDir, ...(options.packageSearchRoots ?? [])]
  let packageRootPaths = createPackageRootPaths({
    allowPackageNames,
    denyPackageNames,
    searchRoots: packageSearchRoots,
  })
  let allowPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths.allow)
  let denyPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths.deny)
  let packageStateDirectories =
    allowPackageNames.size === 0 && denyPackageNames.size === 0
      ? []
      : getPackageStateDirectories(packageSearchRoots)
  let packageRootsDirty = false

  function refreshPackageRootPathTries(): void {
    if (!packageRootsDirty) return

    packageRootPaths = createPackageRootPaths({
      allowPackageNames,
      denyPackageNames,
      searchRoots: packageSearchRoots,
    })
    allowPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths.allow)
    denyPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths.deny)
    packageRootsDirty = false
  }

  function isAllowedPackage(filePath: string): boolean {
    if (allowPackageNames.size === 0) return false
    refreshPackageRootPathTries()

    return isPathInPackageRootPathTrie(filePath, allowPackageRootPathTrie)
  }

  function isDeniedPackage(filePath: string): boolean {
    if (denyPackageNames.size === 0) return false
    refreshPackageRootPathTries()

    return isPathInPackageRootPathTrie(filePath, denyPackageRootPathTrie)
  }

  return {
    getPackageWatchDirectories() {
      if (allowPackageNames.size === 0 && denyPackageNames.size === 0) return []
      return packageStateDirectories
    },
    handleFileEvent(filePath) {
      if (allowPackageNames.size === 0 && denyPackageNames.size === 0) return
      if (!isPackageStateFileEvent(filePath, packageStateDirectories)) return

      packageRootsDirty = true
    },
    isAllowed(filePath) {
      if (isInjectedPackageFilePath(filePath)) return true
      if (!allowMatchers.some((matcher) => matcher(filePath)) && !isAllowedPackage(filePath)) {
        return false
      }
      if (isDeniedPackage(filePath)) return false
      if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath))) return false
      return true
    },
  }
}

function normalizePackageNames(
  packageOption: readonly string[] | undefined,
  optionName: 'allowPackages' | 'denyPackages',
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
  name?: string
}

type PackageRootPathTrie = {
  children: Map<string, PackageRootPathTrie>
  packageRoot: boolean
}

function createPackageRootPaths(options: {
  allowPackageNames: ReadonlySet<string>
  denyPackageNames: ReadonlySet<string>
  searchRoots: readonly string[]
}): { allow: Set<string>; deny: Set<string> } {
  let allowPackageRootPaths = new Set<string>()
  let denyPackageRootPaths = new Set<string>()
  let allowQueue: string[] = []
  let seenAllowedPackageRoots = new Set<string>()
  let searchRoots = normalizePackageSearchRoots(options.searchRoots)

  for (let packageName of options.allowPackageNames) {
    let foundPackage = false

    for (let searchRoot of searchRoots) {
      let packageJsonPath = findPackageJsonPath(packageName, searchRoot)
      if (packageJsonPath === null) continue

      foundPackage = true
      allowQueue.push(packageJsonPath)
    }

    if (!foundPackage) {
      throw new TypeError(`Could not resolve allowed package "${packageName}".`)
    }
  }

  for (let packageName of options.denyPackageNames) {
    for (let searchRoot of searchRoots) {
      let packageJsonPath = findPackageJsonPath(packageName, searchRoot)
      if (packageJsonPath === null) continue

      denyPackageRootPaths.add(normalizeFilePath(path.dirname(packageJsonPath)))
    }
  }

  while (allowQueue.length > 0) {
    let packageJsonPath = allowQueue.shift()!
    let packageRootPath = normalizeFilePath(path.dirname(packageJsonPath))
    if (seenAllowedPackageRoots.has(packageRootPath)) continue
    seenAllowedPackageRoots.add(packageRootPath)
    allowPackageRootPaths.add(packageRootPath)

    let packageJson = readPackageJson(packageJsonPath)
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
      allowQueue.push(dependencyPackageJsonPath)
    }
    for (let dependencyName of Object.keys(packageJson.optionalDependencies ?? {})) {
      validatePackageName(
        dependencyName,
        `Optional dependency "${dependencyName}" from ${packageJsonPath} must be a package name.`,
      )
      let dependencyPackageJsonPath = findPackageJsonPath(dependencyName, packageRootPath)
      if (dependencyPackageJsonPath !== null) {
        allowQueue.push(dependencyPackageJsonPath)
      }
    }
  }

  return {
    allow: allowPackageRootPaths,
    deny: denyPackageRootPaths,
  }
}

function createPackageRootPathTrie(packageRootPaths: ReadonlySet<string>): PackageRootPathTrie {
  let rootNode = createPackageRootPathTrieNode()

  for (let packageRootPath of packageRootPaths) {
    let node = rootNode
    for (let segment of getFilePathSegments(packageRootPath)) {
      let childNode = node.children.get(segment)
      if (!childNode) {
        childNode = createPackageRootPathTrieNode()
        node.children.set(segment, childNode)
      }
      node = childNode
    }
    node.packageRoot = true
  }

  return rootNode
}

function createPackageRootPathTrieNode(): PackageRootPathTrie {
  return {
    children: new Map(),
    packageRoot: false,
  }
}

function isPathInPackageRootPathTrie(filePath: string, trie: PackageRootPathTrie): boolean {
  let node = trie
  if (node.packageRoot) return true

  for (let segment of getFilePathSegments(filePath)) {
    let childNode = node.children.get(segment)
    if (!childNode) return false
    if (childNode.packageRoot) return true
    node = childNode
  }

  return false
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
    let normalizedSearchRoot = normalizeFilePath(searchRoot)
    packageStateDirectories.add(
      path.basename(normalizedSearchRoot) === 'node_modules'
        ? path.dirname(normalizedSearchRoot)
        : normalizedSearchRoot,
    )
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
  if (fileName === 'package.json') return true

  let directory = path.dirname(normalizedFilePath)
  return packageStateDirectories.some(
    (packageStateDirectory) => directory === packageStateDirectory,
  )
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
    name: readStringProperty(packageJson, 'name'),
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

function readStringProperty(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined

  let propertyValue = value[key as keyof typeof value]
  return typeof propertyValue === 'string' ? propertyValue : undefined
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
