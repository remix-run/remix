import type { EmittedModule } from './emit.ts'
import type { ResolutionFailureState, ResolvedModule, TrackedResolution } from './resolve.ts'
import type { TransformFailureState, TransformedModule } from './transform.ts'

export type ModuleWatchEvent = 'change' | 'add' | 'delete'

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
}

type ModuleStore = {
  get(identityPath: string): ModuleRecord
  setTransformFailure(identityPath: string, failure: TransformFailureState): void
  setTransformed(identityPath: string, transformed: TransformedModule): void
  setResolved(identityPath: string, resolved: ResolvedModule): void
  setResolveFailure(identityPath: string, failure: ResolutionFailureState): void
  setEmitted(identityPath: string, emitted: EmittedModule): void
  invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void
  invalidateAll(): void
}

export function createModuleStore(): ModuleStore {
  let recordsByIdentityPath = new Map<string, MutableModuleRecord>()
  let recordsByTrackedFile = new Map<string, Set<string>>()

  return {
    get(identityPath) {
      let existing = recordsByIdentityPath.get(identityPath)
      if (existing) return existing

      let record: MutableModuleRecord = {
        identityPath,
        lastInvalidatedAt: 0,
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
      setTracking(record, {
        trackedFiles: transformed.trackedFiles,
        trackedResolutions: [],
      })
    },

    setResolved(identityPath, resolved) {
      let record = getOrCreateMutableRecord(identityPath)
      record.resolved = resolved
      record.emitted = undefined
      setTracking(record, {
        trackedFiles: resolved.trackedFiles,
        trackedResolutions: resolved.trackedResolutions,
      })
    },

    setResolveFailure(identityPath, failure) {
      let record = getOrCreateMutableRecord(identityPath)
      record.resolved = undefined
      record.emitted = undefined
      setTracking(record, {
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
    }
    recordsByIdentityPath.set(identityPath, record)
    return record
  }

  function invalidateRecord(record: MutableModuleRecord) {
    removeIndexes(record)
    record.emitted = undefined
    record.resolved = undefined
    record.trackedFiles.clear()
    record.trackedResolutions = []
    record.transformed = undefined
    record.lastInvalidatedAt = Date.now()
  }

  function setTracking(
    record: MutableModuleRecord,
    tracking: {
      trackedFiles: readonly string[]
      trackedResolutions: readonly TrackedResolution[]
    },
  ) {
    removeIndexes(record)

    record.trackedFiles = new Set(tracking.trackedFiles)
    record.trackedResolutions = [...tracking.trackedResolutions]

    for (let trackedFile of record.trackedFiles) {
      addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }
  }

  function removeIndexes(record: MutableModuleRecord) {
    for (let trackedFile of record.trackedFiles) {
      removeFromIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }
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
