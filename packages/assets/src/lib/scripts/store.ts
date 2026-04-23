import type { EmittedModule } from './emit.ts'
import { getFilePathDirectory } from '../paths.ts'
import type { ResolutionFailureState, ResolvedModule, TrackedResolution } from './resolve.ts'
import type { TransformFailureState, TransformedModule } from './transform.ts'

export type ModuleWatchEvent = 'change' | 'add' | 'unlink'

export type FileSnapshot = {
  mtimeNs: bigint
  size: bigint
}

export type ModuleSnapshot = ReadonlyMap<string, FileSnapshot>

type ModuleRecordState = {
  identityPath: string
  invalidationVersion: number
  transformed?: TransformedModule
  resolved?: ResolvedModule
  emitted?: EmittedModule
  emittedSnapshot?: ModuleSnapshot
  staleEmitted?: EmittedModule
  staleEmittedSnapshot?: ModuleSnapshot
  trackedFiles: ReadonlySet<string>
  trackedResolutions: readonly TrackedResolution[]
}

export type ModuleRecord = Readonly<ModuleRecordState>

type MutableModuleRecord = {
  identityPath: string
  invalidationVersion: number
  transformed?: TransformedModule
  resolved?: ResolvedModule
  emitted?: EmittedModule
  emittedSnapshot?: ModuleSnapshot
  staleEmitted?: EmittedModule
  staleEmittedSnapshot?: ModuleSnapshot
  trackedFiles: Set<string>
  trackedResolutions: TrackedResolution[]
}

type ModuleStore = {
  get(identityPath: string): ModuleRecord
  setTransformFailure(identityPath: string, failure: TransformFailureState): void
  setTransformed(identityPath: string, transformed: TransformedModule): void
  setResolved(identityPath: string, resolved: ResolvedModule): void
  setResolveFailure(identityPath: string, failure: ResolutionFailureState): void
  setEmitted(identityPath: string, emitted: EmittedModule, snapshot: ModuleSnapshot | null): void
  invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void
  invalidateAll(): void
}

export function createModuleStore(
  options: {
    onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
  } = {},
): ModuleStore {
  let recordsByIdentityPath = new Map<string, MutableModuleRecord>()
  let recordsByTrackedFile = new Map<string, Set<string>>()
  let watchDirectoryRefCountByPath = new Map<string, number>()

  return {
    get(identityPath) {
      let existing = recordsByIdentityPath.get(identityPath)
      if (existing) return existing

      let record: MutableModuleRecord = {
        identityPath,
        invalidationVersion: 0,
        trackedFiles: new Set(),
        trackedResolutions: [],
      }
      recordsByIdentityPath.set(identityPath, record)
      return record
    },
    setTransformFailure(identityPath, failure) {
      let record = getOrCreateMutableRecord(identityPath)
      record.transformed = undefined
      record.resolved = undefined
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, {
        trackedFiles: failure.trackedFiles,
        trackedResolutions: [],
      })
    },

    setTransformed(identityPath, transformed) {
      let record = getOrCreateMutableRecord(identityPath)
      record.transformed = transformed
      record.resolved = undefined
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, {
        trackedFiles: transformed.trackedFiles,
        trackedResolutions: [],
      })
    },

    setResolved(identityPath, resolved) {
      let record = getOrCreateMutableRecord(identityPath)
      record.resolved = resolved
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, {
        trackedFiles: resolved.trackedFiles,
        trackedResolutions: resolved.trackedResolutions,
      })
    },

    setResolveFailure(identityPath, failure) {
      let record = getOrCreateMutableRecord(identityPath)
      record.resolved = undefined
      record.emitted = undefined
      record.emittedSnapshot = undefined
      record.staleEmitted = undefined
      record.staleEmittedSnapshot = undefined
      setTracking(record, {
        trackedFiles: failure.trackedFiles,
        trackedResolutions: failure.trackedResolutions,
      })
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
          if (
            record.trackedResolutions.some((tracked) =>
              mayAffectTrackedResolution(tracked, filePath),
            )
          ) {
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

  function getOrCreateMutableRecord(identityPath: string): MutableModuleRecord {
    let existing = recordsByIdentityPath.get(identityPath)
    if (existing) return existing

    let record: MutableModuleRecord = {
      identityPath,
      invalidationVersion: 0,
      trackedFiles: new Set(),
      trackedResolutions: [],
    }
    recordsByIdentityPath.set(identityPath, record)
    return record
  }

  function invalidateRecord(record: MutableModuleRecord, options: { retainStale: boolean }) {
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
    record: MutableModuleRecord,
    tracking: {
      trackedFiles: readonly string[]
      trackedResolutions: readonly TrackedResolution[]
    },
  ) {
    let previousWatchedDirectories = getWatchedDirectories(record)
    removeIndexes(record)

    record.trackedFiles = new Set(tracking.trackedFiles)
    record.trackedResolutions = [...tracking.trackedResolutions]

    for (let trackedFile of record.trackedFiles) {
      addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }

    let nextWatchedDirectories = getWatchedDirectories(record)
    let delta = updateWatchDirectoryRefCounts(previousWatchedDirectories, nextWatchedDirectories)
    emitWatchDirectoryDelta(delta)
  }

  function clearTracking(record: MutableModuleRecord) {
    setTracking(record, {
      trackedFiles: [],
      trackedResolutions: [],
    })
  }

  function removeIndexes(record: MutableModuleRecord) {
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

function mayAffectTrackedResolution(
  trackedResolution: TrackedResolution,
  filePath: string,
): boolean {
  return (
    trackedResolution.candidatePaths.includes(filePath) ||
    trackedResolution.candidatePrefixes.some((prefix) => filePath.startsWith(prefix))
  )
}

function getWatchedDirectories(record: {
  trackedFiles: ReadonlySet<string>
  trackedResolutions: readonly TrackedResolution[]
}): Set<string> {
  let watchedDirectories = new Set<string>()

  for (let trackedFile of record.trackedFiles) {
    watchedDirectories.add(getFilePathDirectory(trackedFile))
  }

  for (let trackedResolution of record.trackedResolutions) {
    for (let candidatePath of trackedResolution.candidatePaths) {
      watchedDirectories.add(getFilePathDirectory(candidatePath))
    }

    for (let candidatePrefix of trackedResolution.candidatePrefixes) {
      let directoryPath = candidatePrefix.replace(/\/+$/, '') || '/'
      watchedDirectories.add(directoryPath)
    }
  }

  return watchedDirectories
}
