import chokidar from 'chokidar'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { getFilePathDirectory, normalizeFilePath } from './paths.ts'

type AssetServerWatcherOptions = {
  ignore?: readonly string[]
  onChokidarWatcherCreated?: (watcher: ChokidarWatcher) => void
  poll?: boolean
  pollInterval?: number
  onFileEvent(filePath: string, event: AssetServerWatchEvent): Promise<void>
  rootDir: string
}

type AssetServerWatchEvent = 'add' | 'change' | 'unlink'
export type ChokidarWatcher = ReturnType<typeof chokidar.watch>

type DebugTarget = {
  dirname: string
  exists?: boolean
  native: string
  normalized: string
  realpath?: string
}

export type AssetServerWatcher = {
  close(): Promise<void>
  getWatchedTargets(): readonly string[]
  updateWatchedDirectories(
    delta: { add: readonly string[]; remove: readonly string[] },
    options?: { includeAncestors?: boolean },
  ): void
}

export function createAssetServerWatcher(options: AssetServerWatcherOptions): AssetServerWatcher {
  let chokidarOptions = {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ...resolveChokidarWatchOptions(options),
  }
  logWatchDebug('create', {
    chokidarOptions,
    cwd: process.cwd(),
    platform: process.platform,
    rootDir: options.rootDir,
    rootDirTarget: getDebugTarget(options.rootDir),
  })
  let watcher = chokidar.watch([], {
    ...chokidarOptions,
  })
  options.onChokidarWatcherCreated?.(watcher)
  let watchedResolutionDirectories = new Set<string>()
  let watchedFileDirectories = new Set<string>()
  let watchedTargets = new Set<string>()

  for (let event of ['add', 'change', 'unlink'] as const) {
    watcher.on(event, (filePath) => {
      logWatchDebug('event', {
        event,
        filePath,
        target: getDebugTarget(filePath),
      })
      options.onFileEvent(filePath, event)
    })
  }
  watcher.on('error', (error) => {
    logWatchDebug('error', {
      error: getErrorDetails(error),
      watched: watcher.getWatched(),
      watchedTargets: [...watchedTargets],
    })
    console.error('Asset server file system watcher encountered an error.', error)
  })

  return {
    async close() {
      await watcher.close()
    },
    getWatchedTargets() {
      return [...watchedTargets]
    },
    updateWatchedDirectories(delta, updateOptions = {}) {
      let includeAncestors = updateOptions.includeAncestors ?? true
      let previousDirectories = includeAncestors
        ? watchedResolutionDirectories
        : watchedFileDirectories
      let nextWatchedDirectories = new Set(previousDirectories)

      for (let directory of delta.add) {
        nextWatchedDirectories.add(directory)
      }
      for (let directory of delta.remove) {
        nextWatchedDirectories.delete(directory)
      }

      if (includeAncestors) {
        watchedResolutionDirectories = nextWatchedDirectories
      } else {
        watchedFileDirectories = nextWatchedDirectories
      }

      let nextTargets = getWatchTargets({
        rootDir: options.rootDir,
        fileDirectories: [...watchedFileDirectories],
        resolutionDirectories: [...watchedResolutionDirectories],
      })
      let targetsToAdd = [...nextTargets].filter((target) => !watchedTargets.has(target))
      let targetsToRemove = [...watchedTargets].filter((target) => !nextTargets.has(target))
      targetsToAdd.sort(compareFilePathDepth)
      targetsToRemove.sort(compareFilePathDepth).reverse()
      logWatchDebug('update', {
        delta,
        includeAncestors,
        nextTargets: [...nextTargets].map(getDebugTarget),
        rootDir: getDebugTarget(options.rootDir),
        targetsToAdd: targetsToAdd.map(getDebugTarget),
        targetsToRemove: targetsToRemove.map(getDebugTarget),
        watchedBefore: watcher.getWatched(),
        watchedFileDirectories: [...watchedFileDirectories].map(getDebugTarget),
        watchedResolutionDirectories: [...watchedResolutionDirectories].map(getDebugTarget),
      })

      if (targetsToRemove.length > 0) {
        logWatchDebug('unwatch:before', {
          targets: targetsToRemove.map(getDebugTarget),
          watched: watcher.getWatched(),
        })
        watcher.unwatch(targetsToRemove)
        logWatchDebug('unwatch:after', {
          targets: targetsToRemove.map(getDebugTarget),
          watched: watcher.getWatched(),
        })
      }
      if (targetsToAdd.length > 0) {
        logWatchDebug('add:before', {
          targets: targetsToAdd.map(getDebugTarget),
          watched: watcher.getWatched(),
        })
        watcher.add(targetsToAdd)
        logWatchDebug('add:after', {
          targets: targetsToAdd.map(getDebugTarget),
          watched: watcher.getWatched(),
        })
      }

      watchedTargets = nextTargets
    },
  }
}

function logWatchDebug(label: string, details: Record<string, unknown>): void {
  console.error(`[asset-watch:${label}] ${JSON.stringify(details)}`)
}

function getDebugTarget(filePath: string): DebugTarget {
  let normalized = normalizeFilePath(filePath).replace(/\/+$/, '')
  let native = process.platform === 'win32' ? normalized.replace(/\//g, path.win32.sep) : normalized
  let dirname = path.dirname(normalized)
  let target: DebugTarget = {
    dirname,
    native,
    normalized,
  }

  target.exists = fs.existsSync(native)
  if (target.exists) {
    try {
      target.realpath = normalizeFilePath(fs.realpathSync(native))
    } catch (error) {
      target.realpath = getErrorMessage(error)
    }
  }

  return target
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getErrorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error }
  }

  let details: Record<string, unknown> = {
    message: error.message,
    name: error.name,
    stack: error.stack,
  }

  if ('code' in error) details.code = error.code
  if ('errno' in error) details.errno = error.errno
  if ('filename' in error) details.filename = error.filename
  if ('path' in error) details.path = error.path
  if ('syscall' in error) details.syscall = error.syscall

  return details
}

function compareFilePathDepth(a: string, b: string): number {
  return getPathDepth(a) - getPathDepth(b)
}

function getPathDepth(filePath: string): number {
  return normalizeFilePath(filePath).split('/').length
}

function resolveChokidarWatchOptions(
  options: AssetServerWatcherOptions,
): Exclude<Parameters<typeof chokidar.watch>[1], undefined> {
  return {
    awaitWriteFinish: {
      pollInterval: 10,
      stabilityThreshold: 10,
    },
    depth: 0,
    ignored: ['**/.git/**', ...(options.ignore ?? [])],
    interval: options.pollInterval ?? 100,
    usePolling: options.poll ?? false,
  }
}

function getWatchTargets(options: {
  fileDirectories: readonly string[]
  resolutionDirectories: readonly string[]
  rootDir: string
}): Set<string> {
  let normalizedRootDir = normalizeFilePath(options.rootDir)
  let targets = new Set<string>()
  let configAncestors = new Set<string>()

  for (let directory of options.fileDirectories) {
    targets.add(normalizeFilePath(directory).replace(/\/+$/, ''))
  }

  for (let directory of options.resolutionDirectories) {
    let normalizedDirectory = normalizeFilePath(directory).replace(/\/+$/, '')

    targets.add(normalizedDirectory)
    if (!isSameOrDescendantPath(normalizedDirectory, normalizedRootDir)) continue

    for (let ancestor of getAncestorPaths(normalizedDirectory, normalizedRootDir)) {
      configAncestors.add(ancestor)
    }
  }

  for (let ancestor of configAncestors) {
    targets.add(ancestor)
  }

  return targets
}

function getAncestorPaths(directoryPath: string, rootDir: string): string[] {
  let ancestors: string[] = []
  let currentDirectory = directoryPath

  while (isSameOrDescendantPath(currentDirectory, rootDir)) {
    ancestors.push(currentDirectory)
    if (currentDirectory === rootDir) break
    let parentDirectory = getFilePathDirectory(currentDirectory)
    if (parentDirectory === currentDirectory) break
    currentDirectory = parentDirectory
  }

  return ancestors
}

function isSameOrDescendantPath(filePath: string, directoryPath: string): boolean {
  let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '')

  return filePath === normalizedDirectoryPath || filePath.startsWith(`${normalizedDirectoryPath}/`)
}
