import type { EmittedModule } from './emit.ts'
import { getFilePathDirectory } from '../paths.ts'
import type { ResolutionFailureState, ResolvedModule, TrackedResolution } from './resolve.ts'
import type { TransformFailureState, TransformedModule } from './transform.ts'

export type ModuleWatchEvent = 'change' | 'add' | 'unlink'

type ModuleRecordState = {
  identityPath: string
  lastInvalidatedAt: number
  transformed?: TransformedModule
  resolved?: ResolvedModule
  emitted?: EmittedModule
  trackedFiles: ReadonlySet<string>
  trackedResolutions: readonly TrackedResolution[]
}

export type ModuleRecord = Readonly<ModuleRecordState>

type MutableModuleRecord = {
  identityPath: string
  lastInvalidatedAt: number
  transformed?: TransformedModule
  resolved?: ResolvedModule
  emitted?: EmittedModule
  trackedFiles: Set<string>
  trackedResolutions: TrackedResolution[]
  watchedDirectories: Set<string>
}

type ModuleStore = {
  get(identityPath: string): ModuleRecord
  setTransformFailure(identityPath: string, failure: TransformFailureState): Promise<void>
  setTransformed(identityPath: string, transformed: TransformedModule): Promise<void>
  setResolved(identityPath: string, resolved: ResolvedModule): Promise<void>
  setResolveFailure(identityPath: string, failure: ResolutionFailureState): Promise<void>
  setEmitted(identityPath: string, emitted: EmittedModule): void
  invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void
  invalidateAll(): void
}

export function createModuleStore(
  options: {
    onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => Promise<void> | void
  } = {},
): ModuleStore {
  let recordsByIdentityPath = new Map<string, MutableModuleRecord>()
  let recordsByTrackedFile = new Map<string, Set<string>>()
  let watchDirectoryRefCountByPath = new Map<string, number>()
  let watchDirectorySyncPromise = Promise.resolve()

  return {
    get(identityPath) {
      let existing = recordsByIdentityPath.get(identityPath)
      if (existing) return existing

      let record: MutableModuleRecord = {
        identityPath,
        lastInvalidatedAt: 0,
        trackedFiles: new Set(),
        trackedResolutions: [],
        watchedDirectories: new Set(),
      }
      recordsByIdentityPath.set(identityPath, record)
      return record
    },
    async setTransformFailure(identityPath, failure) {
      let record = getOrCreateMutableRecord(identityPath)
      record.transformed = undefined
      record.resolved = undefined
      record.emitted = undefined
      await setTracking(record, {
        trackedFiles: failure.trackedFiles,
        trackedResolutions: [],
      })
    },

    async setTransformed(identityPath, transformed) {
      let record = getOrCreateMutableRecord(identityPath)
      record.transformed = transformed
      record.resolved = undefined
      record.emitted = undefined
      await setTracking(record, {
        trackedFiles: transformed.trackedFiles,
        trackedResolutions: [],
      })
    },

    async setResolved(identityPath, resolved) {
      let record = getOrCreateMutableRecord(identityPath)
      record.resolved = resolved
      record.emitted = undefined
      await setTracking(record, {
        trackedFiles: resolved.trackedFiles,
        trackedResolutions: resolved.trackedResolutions,
      })
    },

    async setResolveFailure(identityPath, failure) {
      let record = getOrCreateMutableRecord(identityPath)
      record.resolved = undefined
      record.emitted = undefined
      await setTracking(record, {
        trackedFiles: failure.trackedFiles,
        trackedResolutions: failure.trackedResolutions,
      })
    },

    setEmitted(identityPath, emitted) {
      getOrCreateMutableRecord(identityPath).emitted = emitted
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
        if (record) invalidateRecord(record)
      }
    },

    invalidateAll() {
      for (let record of recordsByIdentityPath.values()) {
        invalidateRecord(record)
      }
    },
  }

  function getOrCreateMutableRecord(identityPath: string): MutableModuleRecord {
    let existing = recordsByIdentityPath.get(identityPath)
    if (existing) return existing

    let record: MutableModuleRecord = {
      identityPath,
      lastInvalidatedAt: 0,
      trackedFiles: new Set(),
      trackedResolutions: [],
      watchedDirectories: new Set(),
    }
    recordsByIdentityPath.set(identityPath, record)
    return record
  }

  function invalidateRecord(record: MutableModuleRecord) {
    record.emitted = undefined
    record.resolved = undefined
    record.transformed = undefined
    record.lastInvalidatedAt = Date.now()
  }

  async function setTracking(
    record: MutableModuleRecord,
    tracking: {
      trackedFiles: readonly string[]
      trackedResolutions: readonly TrackedResolution[]
    },
  ) {
    let previousWatchedDirectories = new Set(record.watchedDirectories)
    removeIndexes(record)

    record.trackedFiles = new Set(tracking.trackedFiles)
    record.trackedResolutions = [...tracking.trackedResolutions]
    record.watchedDirectories = getWatchedDirectories(record)

    for (let trackedFile of record.trackedFiles) {
      addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }

    let delta = updateWatchDirectoryRefCounts(previousWatchedDirectories, record.watchedDirectories)
    await emitWatchDirectoryDelta(delta)
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

  async function emitWatchDirectoryDelta(delta: {
    add: string[]
    remove: string[]
  }): Promise<void> {
    if (!options.onWatchDirectoriesChange) return
    if (delta.add.length === 0 && delta.remove.length === 0) return

    watchDirectorySyncPromise = watchDirectorySyncPromise.then(() =>
      options.onWatchDirectoriesChange?.(delta),
    )

    await watchDirectorySyncPromise
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
