import type { EmittedStyle } from './emit.ts'
import type { ResolutionFailureState, ResolvedStyle } from './resolve.ts'
import type { TransformFailureState, TransformedStyle } from './transform.ts'

export type StyleWatchEvent = 'change' | 'add' | 'delete'

type StyleRecordState = {
  emitted?: EmittedStyle
  identityPath: string
  lastInvalidatedAt: number
  resolved?: ResolvedStyle
  trackedFiles: ReadonlySet<string>
  transformed?: TransformedStyle
}

export type StyleRecord = Readonly<StyleRecordState>

type MutableStyleRecord = {
  emitted?: EmittedStyle
  identityPath: string
  lastInvalidatedAt: number
  resolved?: ResolvedStyle
  trackedFiles: Set<string>
  transformed?: TransformedStyle
}

type StyleStore = {
  get(identityPath: string): StyleRecord
  invalidateAll(): void
  invalidateForFileEvent(filePath: string, event: StyleWatchEvent): void
  setEmitted(identityPath: string, emitted: EmittedStyle): void
  setResolveFailure(identityPath: string, failure: ResolutionFailureState): void
  setResolved(identityPath: string, resolved: ResolvedStyle): void
  setTransformFailure(identityPath: string, failure: TransformFailureState): void
  setTransformed(identityPath: string, transformed: TransformedStyle): void
}

export function createStyleStore(): StyleStore {
  let recordsByIdentityPath = new Map<string, MutableStyleRecord>()
  let recordsByTrackedFile = new Map<string, Set<string>>()

  return {
    get(identityPath) {
      let existing = recordsByIdentityPath.get(identityPath)
      if (existing) return existing

      let record: MutableStyleRecord = {
        identityPath,
        lastInvalidatedAt: 0,
        trackedFiles: new Set(),
      }
      recordsByIdentityPath.set(identityPath, record)
      return record
    },

    invalidateAll() {
      for (let record of recordsByIdentityPath.values()) {
        invalidateRecord(record)
      }
    },

    invalidateForFileEvent(filePath, event) {
      let affected = new Set<string>(recordsByTrackedFile.get(filePath) ?? [])

      for (let identityPath of affected) {
        let record = recordsByIdentityPath.get(identityPath)
        if (record) invalidateRecord(record)
      }
    },

    setEmitted(identityPath, emitted) {
      getOrCreateMutableRecord(identityPath).emitted = emitted
    },

    setResolveFailure(identityPath, failure) {
      let record = getOrCreateMutableRecord(identityPath)
      record.emitted = undefined
      record.resolved = undefined
      setTracking(record, {
        trackedFiles: failure.trackedFiles,
      })
    },

    setResolved(identityPath, resolved) {
      let record = getOrCreateMutableRecord(identityPath)
      record.emitted = undefined
      record.resolved = resolved
      setTracking(record, {
        trackedFiles: resolved.trackedFiles,
      })
    },

    setTransformFailure(identityPath, failure) {
      let record = getOrCreateMutableRecord(identityPath)
      record.emitted = undefined
      record.resolved = undefined
      record.transformed = undefined
      setTracking(record, {
        trackedFiles: failure.trackedFiles,
      })
    },

    setTransformed(identityPath, transformed) {
      let record = getOrCreateMutableRecord(identityPath)
      record.emitted = undefined
      record.resolved = undefined
      record.transformed = transformed
      setTracking(record, {
        trackedFiles: transformed.trackedFiles,
      })
    },
  }

  function getOrCreateMutableRecord(identityPath: string): MutableStyleRecord {
    let existing = recordsByIdentityPath.get(identityPath)
    if (existing) return existing

    let record: MutableStyleRecord = {
      identityPath,
      lastInvalidatedAt: 0,
      trackedFiles: new Set(),
    }
    recordsByIdentityPath.set(identityPath, record)
    return record
  }

  function invalidateRecord(record: MutableStyleRecord) {
    removeIndexes(record)
    record.emitted = undefined
    record.resolved = undefined
    record.trackedFiles.clear()
    record.transformed = undefined
    record.lastInvalidatedAt = Date.now()
  }

  function setTracking(
    record: MutableStyleRecord,
    tracking: {
      trackedFiles: readonly string[]
    },
  ) {
    removeIndexes(record)

    record.trackedFiles = new Set(tracking.trackedFiles)

    for (let trackedFile of record.trackedFiles) {
      addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }
  }

  function removeIndexes(record: MutableStyleRecord) {
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
