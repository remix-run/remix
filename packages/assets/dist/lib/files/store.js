import { getFilePathDirectory } from "../paths.js";
export function createSourceFileStore(options = {}) {
    let recordsByIdentityPath = new Map();
    let invalidationVersionByIdentityPath = new Map();
    let watchDirectoryRefCountByPath = new Map();
    return {
        get(identityPath) {
            return getOrCreateRecord(identityPath);
        },
        invalidate(identityPath, options = { retainStale: false }) {
            let record = recordsByIdentityPath.get(identityPath);
            if (!record)
                return;
            invalidateRecord(record, options);
        },
        invalidateForFileEvent(filePath, event) {
            let record = recordsByIdentityPath.get(filePath);
            if (!record)
                return;
            invalidateRecord(record, { retainStale: event === 'change' });
            if (event === 'unlink') {
                recordsByIdentityPath.delete(filePath);
                removeWatchDirectory(record.watchedDirectory);
            }
        },
        set(identityPath, metadata, snapshot) {
            let record = recordsByIdentityPath.get(identityPath);
            if (!record) {
                record = getOrCreateRecord(identityPath);
            }
            record.metadata = metadata;
            record.metadataSnapshot = snapshot ?? undefined;
            record.staleMetadata = undefined;
            record.staleMetadataSnapshot = undefined;
        },
    };
    function invalidateRecord(record, options) {
        if (!options.retainStale) {
            record.staleMetadata = undefined;
            record.staleMetadataSnapshot = undefined;
        }
        else if (record.metadata && record.metadataSnapshot) {
            record.staleMetadata = record.metadata;
            record.staleMetadataSnapshot = record.metadataSnapshot;
        }
        else if (!record.staleMetadata || !record.staleMetadataSnapshot) {
            record.staleMetadata = undefined;
            record.staleMetadataSnapshot = undefined;
        }
        record.metadata = undefined;
        record.metadataSnapshot = undefined;
        record.invalidationVersion += 1;
        invalidationVersionByIdentityPath.set(record.identityPath, record.invalidationVersion);
    }
    function addWatchDirectory(directory) {
        let previousCount = watchDirectoryRefCountByPath.get(directory) ?? 0;
        watchDirectoryRefCountByPath.set(directory, previousCount + 1);
        if (previousCount === 0) {
            options.onWatchDirectoriesChange?.({ add: [directory], remove: [] });
        }
    }
    function removeWatchDirectory(directory) {
        let previousCount = watchDirectoryRefCountByPath.get(directory);
        if (!previousCount)
            return;
        if (previousCount === 1) {
            watchDirectoryRefCountByPath.delete(directory);
            options.onWatchDirectoriesChange?.({ add: [], remove: [directory] });
            return;
        }
        watchDirectoryRefCountByPath.set(directory, previousCount - 1);
    }
    function getOrCreateRecord(identityPath) {
        let existing = recordsByIdentityPath.get(identityPath);
        if (existing)
            return existing;
        let watchedDirectory = getFilePathDirectory(identityPath);
        let record = {
            identityPath,
            invalidationVersion: invalidationVersionByIdentityPath.get(identityPath) ?? 0,
            watchedDirectory,
        };
        recordsByIdentityPath.set(identityPath, record);
        addWatchDirectory(watchedDirectory);
        return record;
    }
}
