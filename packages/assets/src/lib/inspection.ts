import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AccessPolicy, AssetAccessDetails } from './access.ts'
import { parseFingerprintSuffix } from './fingerprint.ts'
import { getInjectedPackageRoots } from './injected-packages.ts'
import { isAbsoluteFilePath, normalizeFilePath, resolveFilePath } from './paths.ts'
import type { AssetRouteMatch, CompiledRoutes } from './routes.ts'
import { supportedScriptExtensions } from './scripts/resolve.ts'
import { isStyleFilePath } from './styles/compiler.ts'

const scriptExtensions = new Set<string>(supportedScriptExtensions)
const globSyntaxPattern = /[*?[\]{}()!+@]/

/** How the asset server handles an inspected file. */
export type AssetKind = 'file' | 'script' | 'style' | 'unsupported'

/** Browser-reachability result for an inspected asset. */
export type AssetStatus =
  | 'denied'
  | 'missing'
  | 'not-allowed'
  | 'reachable'
  | 'unmapped'
  | 'unsupported'

/** Diagnostic information about a configured asset URL or file path. */
export interface AssetDetails {
  /** Access-control decision and the rules responsible for it. */
  access?: AssetAccessDetails
  /** Absolute mapped file path. */
  filePath?: string
  /** Configured file pattern that matched the asset. */
  filePattern?: string
  /** Browser-reachability result. */
  status: AssetStatus
  /** How the asset server handles the file. */
  type?: AssetKind
  /** Stable public URL pathname for the asset. */
  url?: string
  /** Configured URL pattern that matched the asset. */
  urlPattern?: string
}

interface AssetInspectorOptions {
  accessPolicy: AccessPolicy
  allowFiles: readonly string[]
  fileExtensions: readonly string[]
  rootDir: string
  routes: CompiledRoutes
}

export interface AssetInspector {
  /** Returns diagnostic information for a public URL or file path. */
  getAssetDetails(input: string): Promise<AssetDetails>
  /** Returns every file currently reachable through the configured asset server. */
  getAssets(): Promise<AssetDetails[]>
}

export function createAssetInspector(options: AssetInspectorOptions): AssetInspector {
  let fileExtensions = new Set(options.fileExtensions.map((extension) => extension.toLowerCase()))

  return {
    async getAssetDetails(input) {
      let routeMatch = await resolveInput(input, options)
      if (routeMatch === null) return { status: 'unmapped' }
      return inspectRouteMatch(routeMatch, options, fileExtensions)
    },
    async getAssets() {
      let filePaths = await discoverFilePaths(options)
      let assets: AssetDetails[] = []

      for (let filePath of filePaths) {
        let routeMatch = options.routes.matchFilePath(filePath)
        if (routeMatch === null) continue

        let details = await inspectRouteMatch(routeMatch, options, fileExtensions)
        if (details.status === 'reachable') assets.push(details)
      }

      assets.sort((left, right) => {
        let urlOrder = (left.url ?? '').localeCompare(right.url ?? '')
        return urlOrder === 0 ? (left.filePath ?? '').localeCompare(right.filePath ?? '') : urlOrder
      })
      return assets
    },
  }
}

async function resolveInput(
  input: string,
  options: Pick<AssetInspectorOptions, 'rootDir' | 'routes'>,
): Promise<AssetRouteMatch | null> {
  if (input.startsWith('file://')) {
    return options.routes.matchFilePath(fileURLToPath(input))
  }

  if (/^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(input)) {
    let pathname = parseFingerprintSuffix(new URL(input).pathname).pathname
    return options.routes.matchUrlPathname(pathname)
  }

  let filePath = resolveFilePath(options.rootDir, input)
  if (!input.startsWith('/') || isAbsoluteFilePath(input)) {
    if (await pathExists(filePath)) return options.routes.matchFilePath(filePath)
    if (!input.startsWith('/')) return options.routes.matchFilePath(filePath)
  }

  let pathname = parseFingerprintSuffix(new URL(input, 'http://remix.run').pathname).pathname
  return options.routes.matchUrlPathname(pathname)
}

async function inspectRouteMatch(
  routeMatch: AssetRouteMatch,
  options: Pick<AssetInspectorOptions, 'accessPolicy' | 'rootDir'>,
  fileExtensions: ReadonlySet<string>,
): Promise<AssetDetails> {
  let exists = await pathExists(routeMatch.filePath)
  let identityPath = exists ? fs.realpathSync(routeMatch.filePath) : routeMatch.filePath
  let normalizedIdentityPath = normalizeFilePath(identityPath)
  let access = options.accessPolicy.inspect(normalizedIdentityPath)

  let type = getAssetKind(routeMatch.filePath, fileExtensions)
  let details = {
    access,
    filePath: routeMatch.filePath,
    filePattern: routeMatch.filePattern,
    type,
    url: routeMatch.urlPathname,
    urlPattern: routeMatch.urlPattern,
  }

  if (!exists) return { ...details, status: 'missing' }
  if (!access.allowed) {
    return { ...details, status: access.deniedBy === undefined ? 'not-allowed' : 'denied' }
  }
  if (type === 'unsupported') return { ...details, status: 'unsupported' }
  return { ...details, status: 'reachable' }
}

function getAssetKind(filePath: string, fileExtensions: ReadonlySet<string>): AssetKind {
  let extension = path.extname(filePath).toLowerCase()
  if (scriptExtensions.has(extension)) return 'script'
  if (isStyleFilePath(filePath)) return 'style'
  if (fileExtensions.has(extension)) return 'file'
  return 'unsupported'
}

async function discoverFilePaths(options: AssetInspectorOptions): Promise<string[]> {
  let roots = new Set<string>()

  for (let pattern of options.allowFiles) {
    roots.add(resolveDiscoveryRoot(options.rootDir, pattern))
  }
  for (let packageRoot of options.accessPolicy.getAllowedPackageRoots()) {
    roots.add(packageRoot)
  }
  for (let packageRoot of getInjectedPackageRoots()) {
    roots.add(packageRoot)
  }

  let filePaths = new Set<string>()
  for (let root of roots) {
    await collectFiles(root, filePaths)
  }

  return [...filePaths]
}

function resolveDiscoveryRoot(rootDir: string, pattern: string): string {
  let dynamicIndex = pattern.search(globSyntaxPattern)
  if (dynamicIndex === -1) return resolveFilePath(rootDir, pattern)

  let rawStaticPrefix = pattern.slice(0, dynamicIndex)
  let staticPrefix = rawStaticPrefix.replace(/[/\\]+$/, '')
  if (staticPrefix.length === 0) return rootDir
  return resolveFilePath(
    rootDir,
    /[/\\]$/.test(rawStaticPrefix) ? staticPrefix : path.dirname(staticPrefix),
  )
}

async function collectFiles(root: string, filePaths: Set<string>): Promise<void> {
  let stat
  try {
    stat = await fsPromises.stat(root)
  } catch (error) {
    if (isPathNotFoundError(error)) return
    throw error
  }

  if (stat.isFile()) {
    filePaths.add(normalizeFilePath(root))
    return
  }
  if (!stat.isDirectory()) return

  let entries = await fsPromises.readdir(root, { withFileTypes: true })
  for (let entry of entries) {
    let entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(entryPath, filePaths)
    } else if (entry.isFile()) {
      filePaths.add(normalizeFilePath(entryPath))
    }
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath)
    return true
  } catch (error) {
    if (isPathNotFoundError(error)) return false
    throw error
  }
}

function isPathNotFoundError(
  error: unknown,
): error is NodeJS.ErrnoException & { code: 'ENOENT' | 'ENOTDIR' } {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}
