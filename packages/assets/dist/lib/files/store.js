export function createSourceFileStore() {
    let recordsByIdentityPath = new Map();
    let invalidationVersionByIdentityPath = new Map();
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
    function getOrCreateRecord(identityPath) {
        let existing = recordsByIdentityPath.get(identityPath);
        if (existing)
            return existing;
        let record = {
            identityPath,
            invalidationVersion: invalidationVersionByIdentityPath.get(identityPath) ?? 0,
        };
        recordsByIdentityPath.set(identityPath, record);
        return record;
    }
}
