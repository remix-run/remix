export function createStyleStore() {
    let recordsByIdentityPath = new Map();
    let recordsByTrackedFile = new Map();
    return {
        get(identityPath) {
            let existing = recordsByIdentityPath.get(identityPath);
            if (existing)
                return existing;
            let record = {
                identityPath,
                lastInvalidatedAt: 0,
                trackedFiles: new Set(),
            };
            recordsByIdentityPath.set(identityPath, record);
            return record;
        },
        invalidateAll() {
            for (let record of recordsByIdentityPath.values()) {
                invalidateRecord(record);
            }
        },
        invalidateForFileEvent(filePath, event) {
            let affected = new Set(recordsByTrackedFile.get(filePath) ?? []);
            for (let identityPath of affected) {
                let record = recordsByIdentityPath.get(identityPath);
                if (record)
                    invalidateRecord(record);
            }
        },
        setEmitted(identityPath, emitted) {
            getOrCreateMutableRecord(identityPath).emitted = emitted;
        },
        setResolveFailure(identityPath, failure) {
            let record = getOrCreateMutableRecord(identityPath);
            record.emitted = undefined;
            record.resolved = undefined;
            setTracking(record, {
                trackedFiles: failure.trackedFiles,
            });
        },
        setResolved(identityPath, resolved) {
            let record = getOrCreateMutableRecord(identityPath);
            record.emitted = undefined;
            record.resolved = resolved;
            setTracking(record, {
                trackedFiles: resolved.trackedFiles,
            });
        },
        setTransformFailure(identityPath, failure) {
            let record = getOrCreateMutableRecord(identityPath);
            record.emitted = undefined;
            record.resolved = undefined;
            record.transformed = undefined;
            setTracking(record, {
                trackedFiles: failure.trackedFiles,
            });
        },
        setTransformed(identityPath, transformed) {
            let record = getOrCreateMutableRecord(identityPath);
            record.emitted = undefined;
            record.resolved = undefined;
            record.transformed = transformed;
            setTracking(record, {
                trackedFiles: transformed.trackedFiles,
            });
        },
    };
    function getOrCreateMutableRecord(identityPath) {
        let existing = recordsByIdentityPath.get(identityPath);
        if (existing)
            return existing;
        let record = {
            identityPath,
            lastInvalidatedAt: 0,
            trackedFiles: new Set(),
        };
        recordsByIdentityPath.set(identityPath, record);
        return record;
    }
    function invalidateRecord(record) {
        removeIndexes(record);
        record.emitted = undefined;
        record.resolved = undefined;
        record.trackedFiles.clear();
        record.transformed = undefined;
        record.lastInvalidatedAt = Date.now();
    }
    function setTracking(record, tracking) {
        removeIndexes(record);
        record.trackedFiles = new Set(tracking.trackedFiles);
        for (let trackedFile of record.trackedFiles) {
            addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath);
        }
    }
    function removeIndexes(record) {
        for (let trackedFile of record.trackedFiles) {
            removeFromIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath);
        }
    }
}
function addToIndexedSet(map, key, value) {
    let existing = map.get(key) ?? new Set();
    existing.add(value);
    map.set(key, existing);
}
function removeFromIndexedSet(map, key, value) {
    let existing = map.get(key);
    if (!existing)
        return;
    existing.delete(value);
    if (existing.size === 0) {
        map.delete(key);
    }
}
