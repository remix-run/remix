import { getFilePathDirectory } from '../paths.ts'

export type FileSnapshot = {
  filePath: string
  mtimeNs: bigint
  size: bigint
}

export type SourceFileMetadata = {
  contentType: string
  etag: string
  extension: string
  fingerprint: string | null
}

type SourceFileRecordState = {
  metadata?: SourceFileMetadata
  metadataSnapshot?: FileSnapshot
  identityPath: string
  invalidationVersion: number
  staleMetadata?: SourceFileMetadata
  staleMetadataSnapshot?: FileSnapshot
  watchedDirectory: string
}

export type SourceFileRecord = Readonly<SourceFileRecordState>

type MutableSourceFileRecord = {
  metadata?: SourceFileMetadata
  metadataSnapshot?: FileSnapshot
  identityPath: string
  invalidationVersion: number
  staleMetadata?: SourceFileMetadata
  staleMetadataSnapshot?: FileSnapshot
  watchedDirectory: string
}

export type SourceFileStore = {
  get(identityPath: string): SourceFileRecord
  invalidate(identityPath: string, options?: { retainStale: boolean }): void
  invalidateForFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): void
  set(identityPath: string, metadata: SourceFileMetadata, snapshot: FileSnapshot | null): void
}

export function createSourceFileStore(
  options: {
    onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
  } = {},
): SourceFileStore {
  let recordsByIdentityPath = new Map<string, MutableSourceFileRecord>()
  let invalidationVersionByIdentityPath = new Map<string, number>()
  let watchDirectoryRefCountByPath = new Map<string, number>()

  return {
    get(identityPath) {
      return getOrCreateRecord(identityPath)
    },

    invalidate(identityPath, options = { retainStale: false }) {
      let record = recordsByIdentityPath.get(identityPath)
      if (!record) return
      invalidateRecord(record, options)
    },

    invalidateForFileEvent(filePath, event) {
      let record = recordsByIdentityPath.get(filePath)
      if (!record) return

      invalidateRecord(record, { retainStale: event === 'change' })

      if (event === 'unlink') {
        recordsByIdentityPath.delete(filePath)
        removeWatchDirectory(record.watchedDirectory)
      }
    },

    set(identityPath, metadata, snapshot) {
      let record = recordsByIdentityPath.get(identityPath)
      if (!record) {
        record = getOrCreateRecord(identityPath)
      }

      record.metadata = metadata
      record.metadataSnapshot = snapshot ?? undefined
      record.staleMetadata = undefined
      record.staleMetadataSnapshot = undefined
    },
  }

  function invalidateRecord(record: MutableSourceFileRecord, options: { retainStale: boolean }) {
    if (!options.retainStale) {
      record.staleMetadata = undefined
      record.staleMetadataSnapshot = undefined
    } else if (record.metadata && record.metadataSnapshot) {
      record.staleMetadata = record.metadata
      record.staleMetadataSnapshot = record.metadataSnapshot
    } else if (!record.staleMetadata || !record.staleMetadataSnapshot) {
      record.staleMetadata = undefined
      record.staleMetadataSnapshot = undefined
    }

    record.metadata = undefined
    record.metadataSnapshot = undefined
    record.invalidationVersion += 1
    invalidationVersionByIdentityPath.set(record.identityPath, record.invalidationVersion)
  }

  function addWatchDirectory(directory: string): void {
    let previousCount = watchDirectoryRefCountByPath.get(directory) ?? 0
    watchDirectoryRefCountByPath.set(directory, previousCount + 1)
    if (previousCount === 0) {
      options.onWatchDirectoriesChange?.({ add: [directory], remove: [] })
    }
  }

  function removeWatchDirectory(directory: string): void {
    let previousCount = watchDirectoryRefCountByPath.get(directory)
    if (!previousCount) return

    if (previousCount === 1) {
      watchDirectoryRefCountByPath.delete(directory)
      options.onWatchDirectoriesChange?.({ add: [], remove: [directory] })
      return
    }

    watchDirectoryRefCountByPath.set(directory, previousCount - 1)
  }

  function getOrCreateRecord(identityPath: string): MutableSourceFileRecord {
    let existing = recordsByIdentityPath.get(identityPath)
    if (existing) return existing

    let watchedDirectory = getFilePathDirectory(identityPath)
    let record: MutableSourceFileRecord = {
      identityPath,
      invalidationVersion: invalidationVersionByIdentityPath.get(identityPath) ?? 0,
      watchedDirectory,
    }
    recordsByIdentityPath.set(identityPath, record)
    addWatchDirectory(watchedDirectory)
    return record
  }
}
