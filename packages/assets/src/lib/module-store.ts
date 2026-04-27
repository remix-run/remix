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

type ModuleRecordState<transformed, resolved, emitted> = {
  identityPath: string
  invalidationVersion: number
  transformed?: transformed
  resolved?: resolved
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
  identityPath: string
  invalidationVersion: number
  transformed?: transformed
  resolved?: resolved
  emitted?: emitted
  emittedSnapshot?: ModuleSnapshot
  staleEmitted?: emitted
  staleEmittedSnapshot?: ModuleSnapshot
  trackedFiles: Set<string>
  trackedDirectories: Set<string>
}

export type ModuleStore<transformed, resolved, emitted> = {
  get(identityPath: string): ModuleRecord<transformed, resolved, emitted>
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
    onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
  } = {},
): ModuleStore<transformed, resolved, emitted> {
  let recordsByIdentityPath = new Map<string, MutableModuleRecord<transformed, resolved, emitted>>()
  let recordsByTrackedFile = new Map<string, Set<string>>()
  let watchDirectoryRefCountByPath = new Map<string, number>()

  return {
    get(identityPath) {
      let existing = recordsByIdentityPath.get(identityPath)
      if (existing) return existing

      let record: MutableModuleRecord<transformed, resolved, emitted> = {
        identityPath,
        invalidationVersion: 0,
        trackedFiles: new Set(),
        trackedDirectories: new Set(),
      }
      recordsByIdentityPath.set(identityPath, record)
      return record
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
      record.resolved = resolved
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, tracking)
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
        if (record) invalidateRecord(record, { retainStale: event === 'change' })
      }

      if (event === 'unlink') {
        let deletedRecord = recordsByIdentityPath.get(filePath)
        if (deletedRecord) {
          clearTracking(deletedRecord)
        }
      }
    },

    invalidateAll() {
      for (let record of recordsByIdentityPath.values()) {
        invalidateRecord(record, { retainStale: false })
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
      trackedFiles: new Set(),
      trackedDirectories: new Set(),
    }
    recordsByIdentityPath.set(identityPath, record)
    return record
  }

  function invalidateRecord(
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
