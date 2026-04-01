import type { FailedResolution, ResolvedModule, TrackedResolution } from './resolve.ts'
import type { TransformedModule } from './transform.ts'
import type { EmittedModule } from './emit.ts'

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
  setTransformed(identityPath: string, transformed: TransformedModule): void
  setResolved(identityPath: string, resolved: ResolvedModule): void
  setFailedResolution(identityPath: string, failure: FailedResolution): void
  setEmitted(identityPath: string, emitted: EmittedModule): void
  invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void
  invalidateAll(): void
}

export function createModuleStore(options: { invalidateDirectImporters: boolean }): ModuleStore {
  let recordsByIdentityPath = new Map<string, MutableModuleRecord>()
  let importersByDependency = new Map<string, Set<string>>()
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

    setTransformed(identityPath, transformed) {
      let record = this.get(identityPath)
      recordsByIdentityPath.get(identityPath)!.transformed = transformed
      updateInvalidationInputs(record, {
        depIdentityPaths: [],
        trackedFiles: transformed.trackedFiles,
        trackedResolutions: [],
      })
    },

    setResolved(identityPath, resolved) {
      let record = this.get(identityPath)
      recordsByIdentityPath.get(identityPath)!.resolved = resolved
      updateInvalidationInputs(record, {
        depIdentityPaths: resolved.deps,
        trackedFiles: resolved.trackedFiles,
        trackedResolutions: resolved.trackedResolutions,
      })
    },

    setFailedResolution(identityPath, failure) {
      let record = this.get(identityPath)
      let mutableRecord = recordsByIdentityPath.get(identityPath)!
      mutableRecord.resolved = undefined
      mutableRecord.emitted = undefined
      updateInvalidationInputs(record, {
        depIdentityPaths: [],
        trackedFiles: failure.trackedFiles,
        trackedResolutions: failure.trackedResolutions,
      })
    },

    setEmitted(identityPath, emitted) {
      recordsByIdentityPath.get(identityPath)!.emitted = emitted
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
        invalidateIdentity(identityPath)
      }
    },

    invalidateAll() {
      for (let identityPath of recordsByIdentityPath.keys()) {
        invalidateRecord(this.get(identityPath))
      }
    },
  }

  function invalidateIdentity(identityPath: string) {
    let record = recordsByIdentityPath.get(identityPath)
    if (!record) return
    invalidateRecord(record)

    if (!options.invalidateDirectImporters) return
    for (let importerIdentityPath of importersByDependency.get(identityPath) ?? []) {
      let importer = recordsByIdentityPath.get(importerIdentityPath)
      if (importer) invalidateRecord(importer)
    }
  }

  function invalidateRecord(record: ModuleRecord) {
    let mutableRecord = recordsByIdentityPath.get(record.identityPath)
    if (!mutableRecord) return
    removeIndexes(mutableRecord)
    mutableRecord.emitted = undefined
    mutableRecord.resolved = undefined
    mutableRecord.trackedFiles.clear()
    mutableRecord.trackedResolutions = []
    mutableRecord.transformed = undefined
    mutableRecord.lastInvalidatedAt = Date.now()
  }

  function updateInvalidationInputs(
    record: ModuleRecord,
    nextState: {
      depIdentityPaths: readonly string[]
      trackedFiles: readonly string[]
      trackedResolutions: readonly TrackedResolution[]
    },
  ) {
    let mutableRecord = recordsByIdentityPath.get(record.identityPath)
    if (!mutableRecord) return
    removeIndexes(mutableRecord)

    mutableRecord.trackedFiles = new Set(nextState.trackedFiles)
    mutableRecord.trackedResolutions = [...nextState.trackedResolutions]

    for (let trackedFile of mutableRecord.trackedFiles) {
      addToIndexedSet(recordsByTrackedFile, trackedFile, mutableRecord.identityPath)
    }
    for (let depIdentityPath of nextState.depIdentityPaths) {
      addToIndexedSet(importersByDependency, depIdentityPath, mutableRecord.identityPath)
    }
  }

  function removeIndexes(record: MutableModuleRecord) {
    for (let trackedFile of record.trackedFiles) {
      removeFromIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath)
    }
    for (let depIdentityPath of record.resolved?.deps ?? []) {
      removeFromIndexedSet(importersByDependency, depIdentityPath, record.identityPath)
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
