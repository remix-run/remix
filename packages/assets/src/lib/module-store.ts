import { getFilePathDirectory } from './paths.ts'

export type ModuleTracking = {
  trackedFiles: readonly string[]
  trackedDirectories?: readonly string[]
}

export type ModuleWatchEvent = 'change' | 'add' | 'unlink'

export type FileSnapshot = {
  mtimeNs: bigint
  size: bigint
}

export type ModuleSnapshot = ReadonlyMap<string, FileSnapshot>

type ModuleLinksState = {
  acceptedDependencies: ReadonlySet<string>
  dependencies: ReadonlySet<string>
}

type MutableModuleLinks = {
  acceptedDependencies: Set<string>
  dependencies: Set<string>
}

type ModuleRecordState<transformed, resolved, emitted> = {
  hmrUpdateTimestamp?: number
  identityPath: string
  invalidationVersion: number
  transformed?: transformed
  resolved?: resolved
  lastResolved?: resolved
  links: ModuleLinksState
  emitted?: emitted
  emittedSnapshot?: ModuleSnapshot
  staleEmitted?: emitted
  staleEmittedSnapshot?: ModuleSnapshot
  trackedFiles: ReadonlySet<string>
  trackedDirectories: ReadonlySet<string>
}

export type ModuleRecord<transformed, resolved, emitted> = Readonly<
  ModuleRecordState<transformed, resolved, emitted>
>

type MutableModuleRecord<transformed, resolved, emitted> = {
  hmrUpdateTimestamp?: number
  identityPath: string
  invalidationVersion: number
  transformed?: transformed
  resolved?: resolved
  lastResolved?: resolved
  links: MutableModuleLinks
  emitted?: emitted
  emittedSnapshot?: ModuleSnapshot
  staleEmitted?: emitted
  staleEmittedSnapshot?: ModuleSnapshot
  trackedFiles: Set<string>
  trackedDirectories: Set<string>
}

export type ModuleStore<transformed, resolved, emitted> = {
  get(identityPath: string): ModuleRecord<transformed, resolved, emitted>
  getAcceptedImporters(identityPath: string): ReadonlySet<string>
  getHmrUpdateTimestamp(identityPath: string): number | undefined
  getImporters(identityPath: string): ReadonlySet<string>
  getLastResolved(identityPath: string): resolved | undefined
  setHmrUpdateTimestamp(identityPath: string, timestamp: number): void
  clearTransformed(identityPath: string, tracking: readonly ModuleTracking[]): void
  setTransformed(
    identityPath: string,
    transformed: transformed,
    tracking: readonly ModuleTracking[],
  ): void
  setResolved(identityPath: string, resolved: resolved, tracking: readonly ModuleTracking[]): void
  clearResolved(identityPath: string, tracking: readonly ModuleTracking[]): void
  setEmitted(identityPath: string, emitted: emitted, snapshot: ModuleSnapshot | null): void
  invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void
  invalidateAll(): void
}

export function createModuleStore<transformed, resolved, emitted>(
  options: {
    getAcceptedDependencies?: (resolved: resolved) => readonly string[]
    getDependencies?: (resolved: resolved) => readonly string[]
    onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
  } = {},
): ModuleStore<transformed, resolved, emitted> {
  let recordsByIdentityPath = new Map<string, MutableModuleRecord<transformed, resolved, emitted>>()
  let importersByDepPath = new Map<string, Set<string>>()
  let acceptedImportersByDepPath = new Map<string, Set<string>>()
  let recordsByTrackedFile = new Map<string, Set<string>>()
  let watchDirectoryRefCountByPath = new Map<string, number>()
  let emptyImporters = new Set<string>()

  return {
    get(identityPath) {
      let existing = recordsByIdentityPath.get(identityPath)
      if (existing) return existing

      let record: MutableModuleRecord<transformed, resolved, emitted> = {
        identityPath,
        invalidationVersion: 0,
        links: createEmptyLinks(),
        trackedFiles: new Set(),
        trackedDirectories: new Set(),
      }
      recordsByIdentityPath.set(identityPath, record)
      return record
    },

    getAcceptedImporters(identityPath) {
      return acceptedImportersByDepPath.get(identityPath) ?? emptyImporters
    },

    getHmrUpdateTimestamp(identityPath) {
      return recordsByIdentityPath.get(identityPath)?.hmrUpdateTimestamp
    },

    getImporters(identityPath) {
      return importersByDepPath.get(identityPath) ?? emptyImporters
    },

    getLastResolved(identityPath) {
      return recordsByIdentityPath.get(identityPath)?.lastResolved
    },

    setHmrUpdateTimestamp(identityPath, timestamp) {
      let record = getOrCreateMutableRecord(identityPath)
      record.hmrUpdateTimestamp = timestamp
    },

    clearTransformed(identityPath, tracking) {
      let record = getOrCreateMutableRecord(identityPath)
      record.transformed = undefined
      record.resolved = undefined
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, tracking)
    },

    setTransformed(identityPath, transformed, tracking) {
      let record = getOrCreateMutableRecord(identityPath)
      record.transformed = transformed
      record.resolved = undefined
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, tracking)
    },

    setResolved(identityPath, resolved, tracking) {
      let record = getOrCreateMutableRecord(identityPath)
      removeResolvedIndexes(record)
      record.resolved = resolved
      record.lastResolved = resolved
      record.links = createLinks(resolved)
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, tracking)
      addResolvedIndexes(record)
    },

    clearResolved(identityPath, tracking) {
      let record = getOrCreateMutableRecord(identityPath)
      record.resolved = undefined
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, tracking)
    },

    setEmitted(identityPath, emitted, snapshot) {
      let record = getOrCreateMutableRecord(identityPath)
      record.emitted = emitted
      record.emittedSnapshot = snapshot ?? undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
    },

    invalidateForFileEvent(filePath, event) {
      let affected = new Set<string>(recordsByTrackedFile.get(filePath) ?? [])

      if (event !== 'change') {
        for (let record of recordsByIdentityPath.values()) {
          if (matchesTrackedDirectory(record.trackedDirectories, filePath)) {
            affected.add(record.identityPath)
          }
        }
      }

      for (let identityPath of affected) {
        let record = recordsByIdentityPath.get(identityPath)
        if (record) {
          if (event === 'change') {
            invalidateContent(record, { retainStale: true })
          } else {
            invalidateGraph(record)
          }
        }
      }

      if (event === 'unlink') {
        let deletedRecord = recordsByIdentityPath.get(filePath)
        if (deletedRecord) {
          if (!affected.has(filePath)) {
            invalidateGraph(deletedRecord)
          }
          clearTracking(deletedRecord)
        }
      }
    },

    invalidateAll() {
      for (let record of recordsByIdentityPath.values()) {
        invalidateGraph(record)
      }
    },
  }

  function getOrCreateMutableRecord(
    identityPath: string,
  ): MutableModuleRecord<transformed, resolved, emitted> {
    let existing = recordsByIdentityPath.get(identityPath)
    if (existing) return existing

    let record: MutableModuleRecord<transformed, resolved, emitted> = {
      identityPath,
      invalidationVersion: 0,
      links: createEmptyLinks(),
      trackedFiles: new Set(),
      trackedDirectories: new Set(),
    }
    recordsByIdentityPath.set(identityPath, record)
    return record
  }

  function invalidateContent(
    record: MutableModuleRecord<transformed, resolved, emitted>,
    options: { retainStale: boolean },
  ) {
    if (!options.retainStale) {
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
    } else if (record.emitted && record.emittedSnapshot) {
      record.staleEmitted = record.emitted
      record.staleEmittedSnapshot = record.emittedSnapshot
    } else if (!record.staleEmitted || !record.staleEmittedSnapshot) {
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
    }

    record.emitted = undefined
    record.emittedSnapshot = undefined
    record.resolved = undefined
    record.transformed = undefined
    record.invalidationVersion += 1
  }

  function invalidateGraph(record: MutableModuleRecord<transformed, resolved, emitted>) {
    clearLastResolved(record)
    record.hmrUpdateTimestamp = undefined
    invalidateContent(record, { retainStale: false })
  }

  function createLinks(resolved: resolved): MutableModuleLinks {
    return {
      acceptedDependencies: new Set(options.getAcceptedDependencies?.(resolved) ?? []),
      dependencies: new Set(options.getDependencies?.(resolved) ?? []),
    }
  }

  function createEmptyLinks(): MutableModuleLinks {
    return {
      acceptedDependencies: new Set(),
      dependencies: new Set(),
    }
  }

  function addResolvedIndexes(record: MutableModuleRecord<transformed, resolved, emitted>): void {
    for (let depPath of record.links.dependencies) {
      addToIndexedSet(importersByDepPath, depPath, record.identityPath)
    }

    for (let depPath of record.links.acceptedDependencies) {
      addToIndexedSet(acceptedImportersByDepPath, depPath, record.identityPath)
    }
  }

  function clearLastResolved(record: MutableModuleRecord<transformed, resolved, emitted>): void {
    record.lastResolved = undefined
    record.links = createEmptyLinks()
    removeResolvedIndexes(record)
  }

  function removeResolvedIndexes(
    record: MutableModuleRecord<transformed, resolved, emitted>,
  ): void {
    removeFromIndexedSets(importersByDepPath, record.identityPath)
    removeFromIndexedSets(acceptedImportersByDepPath, record.identityPath)
  }

  function setTracking(
    record: MutableModuleRecord<transformed, resolved, emitted>,
    tracking: readonly ModuleTracking[],
  ) {
    let previousWatchedDirectories = getWatchedDirectories(record)
    removeIndexes(record)

    let normalizedTracking = mergeTracking(tracking)
    record.trackedFiles = normalizedTracking.trackedFiles
    record.trackedDirectories = normalizedTracking.trackedDirectories

    for (let trackedFile of record.trackedFiles) {
      addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }

    let nextWatchedDirectories = getWatchedDirectories(record)
    let delta = updateWatchDirectoryRefCounts(previousWatchedDirectories, nextWatchedDirectories)
    emitWatchDirectoryDelta(delta)
  }

  function clearTracking(record: MutableModuleRecord<transformed, resolved, emitted>) {
    setTracking(record, [])
  }

  function removeIndexes(record: MutableModuleRecord<transformed, resolved, emitted>) {
    for (let trackedFile of record.trackedFiles) {
      removeFromIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }
  }

  function updateWatchDirectoryRefCounts(
    previousWatchedDirectories: ReadonlySet<string>,
    nextWatchedDirectories: ReadonlySet<string>,
  ): { add: string[]; remove: string[] } {
    let add: string[] = []
    let remove: string[] = []

    for (let directory of previousWatchedDirectories) {
      if (nextWatchedDirectories.has(directory)) continue
      let previousCount = watchDirectoryRefCountByPath.get(directory)
      if (!previousCount) continue
      if (previousCount === 1) {
        watchDirectoryRefCountByPath.delete(directory)
        remove.push(directory)
      } else {
        watchDirectoryRefCountByPath.set(directory, previousCount - 1)
      }
    }

    for (let directory of nextWatchedDirectories) {
      if (previousWatchedDirectories.has(directory)) continue
      let previousCount = watchDirectoryRefCountByPath.get(directory) ?? 0
      watchDirectoryRefCountByPath.set(directory, previousCount + 1)
      if (previousCount === 0) {
        add.push(directory)
      }
    }

    return { add, remove }
  }

  function emitWatchDirectoryDelta(delta: { add: string[]; remove: string[] }): void {
    if (!options.onWatchDirectoriesChange) return
    if (delta.add.length === 0 && delta.remove.length === 0) return
    options.onWatchDirectoriesChange(delta)
  }
}

function addToIndexedSet(map: Map<string, Set<string>>, key: string, value: string) {
  let existing = map.get(key) ?? new Set<string>()
  existing.add(value)
  map.set(key, existing)
}

function removeFromIndexedSet(map: Map<string, Set<string>>, key: string, value: string) {
  let existing = map.get(key)
  if (!existing) return
  existing.delete(value)
  if (existing.size === 0) {
    map.delete(key)
  }
}

function removeFromIndexedSets(map: Map<string, Set<string>>, value: string): void {
  for (let [key, values] of map) {
    values.delete(value)
    if (values.size === 0) {
      map.delete(key)
    }
  }
}

function matchesTrackedDirectory(
  trackedDirectories: ReadonlySet<string>,
  filePath: string,
): boolean {
  for (let trackedDirectory of trackedDirectories) {
    if (filePath === trackedDirectory || filePath.startsWith(`${trackedDirectory}/`)) return true
  }

  return false
}

function normalizeTrackedDirectory(trackedDirectory: string): string {
  return trackedDirectory.replace(/\/+$/, '') || '/'
}

function mergeTracking(tracking: readonly ModuleTracking[]): {
  trackedFiles: Set<string>
  trackedDirectories: Set<string>
} {
  let trackedFiles = new Set<string>()
  let trackedDirectories = new Set<string>()

  for (let fragment of tracking) {
    for (let trackedFile of fragment.trackedFiles) {
      trackedFiles.add(trackedFile)
    }

    for (let trackedDirectory of fragment.trackedDirectories ?? []) {
      trackedDirectories.add(normalizeTrackedDirectory(trackedDirectory))
    }
  }

  return {
    trackedFiles,
    trackedDirectories,
  }
}

function getWatchedDirectories(record: {
  trackedFiles: ReadonlySet<string>
  trackedDirectories: ReadonlySet<string>
}): Set<string> {
  let watchedDirectories = new Set<string>()

  for (let trackedFile of record.trackedFiles) {
    watchedDirectories.add(getFilePathDirectory(trackedFile))
  }

  for (let trackedDirectory of record.trackedDirectories) {
    watchedDirectories.add(trackedDirectory)
  }

  return watchedDirectories
}
