import chokidar from 'chokidar'

import { getFilePathDirectory, normalizeFilePath } from './paths.ts'

type AssetServerWatcherOptions = {
  ignore?: readonly string[]
  poll?: boolean
  pollInterval?: number
  onFileEvent(filePath: string, event: AssetServerWatchEvent): Promise<void>
  rootDir: string
}

type AssetServerWatchEvent = 'add' | 'change' | 'unlink'

export type AssetServerWatcher = {
  close(): Promise<void>
  updateWatchedDirectories(delta: {
    add: readonly string[]
    remove: readonly string[]
  }): Promise<void>
}

export function createAssetServerWatcher(options: AssetServerWatcherOptions): AssetServerWatcher {
  let watcher = chokidar.watch([], {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ...resolveChokidarWatchOptions(options),
  })
  let watchedDirectories = new Set<string>()
  let watchedTargets = new Set<string>()
  let syncPromise = Promise.resolve()

  for (let event of ['add', 'change', 'unlink'] as const) {
    watcher.on(event, (filePath) => {
      void options.onFileEvent(filePath, event)
    })
  }

  return {
    async close() {
      await watcher.close()
    },
    async updateWatchedDirectories(delta) {
      syncPromise = syncPromise.then(async () => {
        let nextWatchedDirectories = new Set(watchedDirectories)

        for (let directory of delta.add) {
          nextWatchedDirectories.add(directory)
        }
        for (let directory of delta.remove) {
          nextWatchedDirectories.delete(directory)
        }

        let nextTargets = getWatchTargetsForDirectories(options.rootDir, [
          ...nextWatchedDirectories,
        ])
        let targetsToAdd = [...nextTargets].filter((target) => !watchedTargets.has(target))
        let targetsToRemove = [...watchedTargets].filter((target) => !nextTargets.has(target))

        if (targetsToRemove.length > 0) {
          await watcher.unwatch(targetsToRemove)
        }
        if (targetsToAdd.length > 0) {
          await watcher.add(targetsToAdd)
        }
        if (targetsToAdd.length > 0 || targetsToRemove.length > 0) {
          await delay(50)
        }

        watchedDirectories = nextWatchedDirectories
        watchedTargets = nextTargets
      })

      await syncPromise
    },
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function getWatchTargetsForDirectories(
  rootDir: string,
  directories: readonly string[],
): Set<string> {
  let normalizedRootDir = normalizeFilePath(rootDir)
  let targets = new Set<string>()
  let configAncestors = new Set<string>()

  for (let directory of directories) {
    let normalizedDirectory = normalizeFilePath(directory).replace(/\/+$/, '')
    if (!isSameOrDescendantPath(normalizedDirectory, normalizedRootDir)) continue

    targets.add(normalizedDirectory)

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
