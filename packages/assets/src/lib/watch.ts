import * as fs from 'node:fs'
import * as path from 'node:path'
import type { FSWatcher } from 'chokidar'
import chokidar from 'chokidar'

import { resolveFilePath } from './paths.ts'
import type { AssetRouteDefinition } from './routes.ts'

type AssetServerWatcherOptions = {
  ignore?: readonly string[]
  poll?: boolean
  pollInterval?: number
  onFileEvent(filePath: string, event: AssetServerWatchEvent): Promise<void>
  root: string
  routes: readonly AssetRouteDefinition[]
}

type AssetServerWatchEvent = 'add' | 'change' | 'unlink'

export type AssetServerWatcher = {
  close(): Promise<void>
  getWatchedDirectories(): string[]
  whenReady(): Promise<void>
}

export function createAssetServerWatcher(options: AssetServerWatcherOptions): AssetServerWatcher {
  let watcher = chokidar.watch(getWatchTargets(options.root, options.routes), {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ...resolveChokidarWatchOptions(options),
  })
  let readyPromise = createWatcherReadyPromise(watcher)

  for (let event of ['add', 'change', 'unlink'] as const) {
    watcher.on(event, (filePath) => {
      void options.onFileEvent(filePath, event)
    })
  }

  return {
    async close() {
      await watcher.close()
    },
    getWatchedDirectories() {
      return Object.keys(watcher.getWatched())
    },
    whenReady() {
      return readyPromise
    },
  }
}

function resolveChokidarWatchOptions(
  options: AssetServerWatcherOptions,
): Exclude<Parameters<typeof chokidar.watch>[1], undefined> {
  return {
    ignored: ['**/.git/**', ...(options.ignore ?? [])],
    interval: options.pollInterval ?? 100,
    usePolling: options.poll ?? false,
  }
}

function createWatcherReadyPromise(watcher: FSWatcher): Promise<void> {
  let activeWatcher = watcher

  return new Promise<void>((resolve, reject) => {
    function handleReady() {
      activeWatcher.off('error', handleError)
      resolve()
    }

    function handleError(error: unknown) {
      activeWatcher.off('ready', handleReady)
      reject(error)
    }

    activeWatcher.once('ready', handleReady)
    activeWatcher.once('error', handleError)
  })
}

function getWatchTargets(root: string, routes: readonly AssetRouteDefinition[]): string[] {
  let targets = new Set<string>()
  let configRoots = new Set<string>()

  for (let route of routes) {
    let resolvedPatternPath = resolveFilePath(root, route.filePattern)
    let watchTarget = containsGlobSyntax(route.filePattern)
      ? getGlobParentPath(resolvedPatternPath)
      : resolvedPatternPath
    targets.add(watchTarget)

    let configRoot = getWatchConfigRoot(watchTarget)
    if (configRoot) {
      configRoots.add(configRoot)
    }
  }

  for (let configRoot of configRoots) {
    for (let ancestor of getAncestorPaths(configRoot, root)) {
      for (let configPath of getExistingConfigFileTargets(ancestor)) {
        targets.add(configPath)
      }
    }
  }

  return [...targets]
}

function getAncestorPaths(directoryPath: string, root: string): string[] {
  let ancestors: string[] = []
  let currentDirectory = directoryPath

  while (isSameOrDescendantPath(currentDirectory, root)) {
    ancestors.push(currentDirectory)
    if (currentDirectory === root) break
    let parentDirectory = path.posix.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) break
    currentDirectory = parentDirectory
  }

  return ancestors
}

function getGlobParentPath(pattern: string): string {
  let firstGlobIndex = pattern.search(/[*?[\]{}()!+@]/)
  if (firstGlobIndex === -1) return pattern

  let prefix = pattern.slice(0, firstGlobIndex)
  return prefix.replace(/\/+$/, '') || '/'
}

function getWatchConfigRoot(filePath: string): string | null {
  try {
    if (fs.statSync(filePath).isDirectory()) {
      return filePath
    }
  } catch {
    // Missing exact paths fall back to parent directory watch roots.
  }

  return path.posix.dirname(filePath)
}

function getExistingConfigFileTargets(directoryPath: string): string[] {
  let targets: string[] = []

  try {
    let entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    for (let entry of entries) {
      if (!entry.isFile()) continue
      if (entry.name === 'package.json' || /^tsconfig(?:\..+)?\.json$/.test(entry.name)) {
        targets.push(`${directoryPath}/${entry.name}`)
      }
    }
  } catch {
    // Ignore missing or unreadable directories when building watch targets.
  }

  return targets
}

function containsGlobSyntax(pattern: string): boolean {
  return /[*?[\]{}()!+@]/.test(pattern)
}

function isSameOrDescendantPath(filePath: string, directoryPath: string): boolean {
  let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '')

  return filePath === normalizedDirectoryPath || filePath.startsWith(`${normalizedDirectoryPath}/`)
}
