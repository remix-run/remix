import chokidar from 'chokidar'

import { getFilePathDirectory, normalizeFilePath, isSameOrDescendantPath } from './paths.ts'

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

export type AssetServerWatcher = {
  close(): Promise<void>
  getWatchedTargets(): readonly string[]
  updateWatchedDirectories(
    delta: { add: readonly string[]; remove: readonly string[] },
    options?: { includeAncestors?: boolean },
  ): void
}

export function createAssetServerWatcher(options: AssetServerWatcherOptions): AssetServerWatcher {
  let watcher = chokidar.watch([], {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ...resolveChokidarWatchOptions(options),
  })
  options.onChokidarWatcherCreated?.(watcher)
  let normalizedRootDir = normalizeFilePath(options.rootDir)
  let watchedResolutionDirectories = new Set<string>()
  let watchedFileDirectories = new Set<string>()
  let targetRefCountByPath = new Map<string, number>()

  for (let event of ['add', 'change', 'unlink'] as const) {
    watcher.on(event, (filePath) => {
      options.onFileEvent(filePath, event)
    })
  }
  watcher.on('error', (error) => {
    console.error('Asset server file system watcher encountered an error.', error)
  })

  return {
    async close() {
      await watcher.close()
    },
    getWatchedTargets() {
      return [...targetRefCountByPath.keys()]
    },
    updateWatchedDirectories(delta, updateOptions = {}) {
      let includeAncestors = updateOptions.includeAncestors ?? true
      let watchedDirectories = includeAncestors
        ? watchedResolutionDirectories
        : watchedFileDirectories
      let targetsToAdd: string[] = []
      let targetsToRemove: string[] = []

      for (let directory of delta.remove) {
        if (!watchedDirectories.delete(directory)) continue
        for (let target of getDirectoryWatchTargets(
          directory,
          normalizedRootDir,
          includeAncestors,
        )) {
          let previousCount = targetRefCountByPath.get(target)
          if (!previousCount) continue
          if (previousCount === 1) {
            targetRefCountByPath.delete(target)
            targetsToRemove.push(target)
          } else {
            targetRefCountByPath.set(target, previousCount - 1)
          }
        }
      }

      for (let directory of delta.add) {
        if (watchedDirectories.has(directory)) continue
        watchedDirectories.add(directory)
        for (let target of getDirectoryWatchTargets(
          directory,
          normalizedRootDir,
          includeAncestors,
        )) {
          let previousCount = targetRefCountByPath.get(target) ?? 0
          targetRefCountByPath.set(target, previousCount + 1)
          if (previousCount === 0) {
            targetsToAdd.push(target)
          }
        }
      }

      if (targetsToRemove.length > 0 && targetsToAdd.length > 0) {
        let addedSet = new Set(targetsToAdd)
        let removedSet = new Set(targetsToRemove)
        targetsToRemove = targetsToRemove.filter((target) => !addedSet.has(target))
        targetsToAdd = targetsToAdd.filter((target) => !removedSet.has(target))
      }

      if (targetsToRemove.length > 0) {
        watcher.unwatch(targetsToRemove)
      }
      if (targetsToAdd.length > 0) {
        watcher.add(targetsToAdd)
      }
    },
  }
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
    usePolling: options.poll ?? process.platform === 'win32',
  }
}

function getDirectoryWatchTargets(
  directory: string,
  normalizedRootDir: string,
  includeAncestors: boolean,
): string[] {
  let normalizedDirectory = normalizeFilePath(directory).replace(/\/+$/, '')
  if (!includeAncestors || !isSameOrDescendantPath(normalizedDirectory, normalizedRootDir)) {
    return [normalizedDirectory]
  }
  return getAncestorPaths(normalizedDirectory, normalizedRootDir)
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
