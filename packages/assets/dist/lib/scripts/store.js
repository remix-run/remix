import { getFilePathDirectory } from "../paths.js";
export function createModuleStore(options = {}) {
    let recordsByIdentityPath = new Map();
    let recordsByTrackedFile = new Map();
    let watchDirectoryRefCountByPath = new Map();
    return {
        get(identityPath) {
            let existing = recordsByIdentityPath.get(identityPath);
            if (existing)
                return existing;
            let record = {
                identityPath,
                invalidationVersion: 0,
                trackedFiles: new Set(),
                trackedResolutions: [],
            };
            recordsByIdentityPath.set(identityPath, record);
            return record;
        },
        setTransformFailure(identityPath, failure) {
            let record = getOrCreateMutableRecord(identityPath);
            record.transformed = undefined;
            record.resolved = undefined;
            record.emitted = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, {
                trackedFiles: failure.trackedFiles,
                trackedResolutions: [],
            });
        },
        setTransformed(identityPath, transformed) {
            let record = getOrCreateMutableRecord(identityPath);
            record.transformed = transformed;
            record.resolved = undefined;
            record.emitted = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, {
                trackedFiles: transformed.trackedFiles,
                trackedResolutions: [],
            });
        },
        setResolved(identityPath, resolved) {
            let record = getOrCreateMutableRecord(identityPath);
            record.resolved = resolved;
            record.emitted = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, {
                trackedFiles: resolved.trackedFiles,
                trackedResolutions: resolved.trackedResolutions,
            });
        },
        setResolveFailure(identityPath, failure) {
            let record = getOrCreateMutableRecord(identityPath);
            record.resolved = undefined;
            record.emitted = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, {
                trackedFiles: failure.trackedFiles,
                trackedResolutions: failure.trackedResolutions,
            });
        },
        setEmitted(identityPath, emitted, snapshot) {
            let record = getOrCreateMutableRecord(identityPath);
            record.emitted = emitted;
            record.emittedSnapshot = snapshot ?? undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
        },
        invalidateForFileEvent(filePath, event) {
            let affected = new Set(recordsByTrackedFile.get(filePath) ?? []);
            if (event !== 'change') {
                for (let record of recordsByIdentityPath.values()) {
                    if (record.trackedResolutions.some((tracked) => mayAffectTrackedResolution(tracked, filePath))) {
                        affected.add(record.identityPath);
                    }
                }
            }
            for (let identityPath of affected) {
                let record = recordsByIdentityPath.get(identityPath);
                if (record)
                    invalidateRecord(record, { retainStale: event === 'change' });
            }
            if (event === 'unlink') {
                let deletedRecord = recordsByIdentityPath.get(filePath);
                if (deletedRecord) {
                    clearTracking(deletedRecord);
                }
            }
        },
        invalidateAll() {
            for (let record of recordsByIdentityPath.values()) {
                invalidateRecord(record, { retainStale: false });
            }
        },
    };
    function getOrCreateMutableRecord(identityPath) {
        let existing = recordsByIdentityPath.get(identityPath);
        if (existing)
            return existing;
        let record = {
            identityPath,
            invalidationVersion: 0,
            trackedFiles: new Set(),
            trackedResolutions: [],
        };
        recordsByIdentityPath.set(identityPath, record);
        return record;
    }
    function invalidateRecord(record, options) {
        if (!options.retainStale) {
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
        }
        else if (record.emitted && record.emittedSnapshot) {
            record.staleEmitted = record.emitted;
            record.staleEmittedSnapshot = record.emittedSnapshot;
        }
        else if (!record.staleEmitted || !record.staleEmittedSnapshot) {
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
        }
        record.emitted = undefined;
        record.emittedSnapshot = undefined;
        record.resolved = undefined;
        record.transformed = undefined;
        record.invalidationVersion += 1;
    }
    function setTracking(record, tracking) {
        let previousWatchedDirectories = getWatchedDirectories(record);
        removeIndexes(record);
        record.trackedFiles = new Set(tracking.trackedFiles);
        record.trackedResolutions = [...tracking.trackedResolutions];
        for (let trackedFile of record.trackedFiles) {
            addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath);
        }
        let nextWatchedDirectories = getWatchedDirectories(record);
        let delta = updateWatchDirectoryRefCounts(previousWatchedDirectories, nextWatchedDirectories);
        emitWatchDirectoryDelta(delta);
    }
    function clearTracking(record) {
        setTracking(record, {
            trackedFiles: [],
            trackedResolutions: [],
        });
    }
    function removeIndexes(record) {
        for (let trackedFile of record.trackedFiles) {
            removeFromIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath);
        }
    }
    function updateWatchDirectoryRefCounts(previousWatchedDirectories, nextWatchedDirectories) {
        let add = [];
        let remove = [];
        for (let directory of previousWatchedDirectories) {
            if (nextWatchedDirectories.has(directory))
                continue;
            let previousCount = watchDirectoryRefCountByPath.get(directory);
            if (!previousCount)
                continue;
            if (previousCount === 1) {
                watchDirectoryRefCountByPath.delete(directory);
                remove.push(directory);
            }
            else {
                watchDirectoryRefCountByPath.set(directory, previousCount - 1);
            }
        }
        for (let directory of nextWatchedDirectories) {
            if (previousWatchedDirectories.has(directory))
                continue;
            let previousCount = watchDirectoryRefCountByPath.get(directory) ?? 0;
            watchDirectoryRefCountByPath.set(directory, previousCount + 1);
            if (previousCount === 0) {
                add.push(directory);
            }
        }
        return { add, remove };
    }
    function emitWatchDirectoryDelta(delta) {
        if (!options.onWatchDirectoriesChange)
            return;
        if (delta.add.length === 0 && delta.remove.length === 0)
            return;
        options.onWatchDirectoriesChange(delta);
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
function mayAffectTrackedResolution(trackedResolution, filePath) {
    return (trackedResolution.candidatePaths.includes(filePath) ||
        trackedResolution.candidatePrefixes.some((prefix) => filePath.startsWith(prefix)));
}
function getWatchedDirectories(record) {
    let watchedDirectories = new Set();
    for (let trackedFile of record.trackedFiles) {
        watchedDirectories.add(getFilePathDirectory(trackedFile));
    }
    for (let trackedResolution of record.trackedResolutions) {
        for (let candidatePath of trackedResolution.candidatePaths) {
            watchedDirectories.add(getFilePathDirectory(candidatePath));
        }
        for (let candidatePrefix of trackedResolution.candidatePrefixes) {
            let directoryPath = candidatePrefix.replace(/\/+$/, '') || '/';
            watchedDirectories.add(directoryPath);
        }
    }
    return watchedDirectories;
}
