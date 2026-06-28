import { getFilePathDirectory } from "./paths.js";
export function createModuleStore(options = {}) {
    let recordsByIdentityPath = new Map();
    let importersByDepPath = new Map();
    let acceptedImportersByDepPath = new Map();
    let recordsByTrackedFile = new Map();
    let watchDirectoryRefCountByPath = new Map();
    let watchFileRefCountByPath = new Map();
    let emptyImporters = new Set();
    return {
        get(identityPath) {
            let existing = recordsByIdentityPath.get(identityPath);
            if (existing)
                return existing;
            let record = {
                identityPath,
                invalidationVersion: 0,
                links: createEmptyLinks(),
                trackedFiles: new Set(),
                trackedDirectories: new Set(),
            };
            recordsByIdentityPath.set(identityPath, record);
            return record;
        },
        getAcceptedImporters(identityPath) {
            return acceptedImportersByDepPath.get(identityPath) ?? emptyImporters;
        },
        getHmrUpdateTimestamp(identityPath) {
            return recordsByIdentityPath.get(identityPath)?.hmrUpdateTimestamp;
        },
        getImporters(identityPath) {
            return importersByDepPath.get(identityPath) ?? emptyImporters;
        },
        getLastResolved(identityPath) {
            return recordsByIdentityPath.get(identityPath)?.lastResolved;
        },
        isEmittedFresh(record) {
            return record.emittedVersion === record.invalidationVersion;
        },
        isResolvedFresh(record) {
            return record.resolvedVersion === record.invalidationVersion;
        },
        isTransformedFresh(record) {
            return record.transformedVersion === record.invalidationVersion;
        },
        setHmrUpdateTimestamp(identityPath, timestamp) {
            let record = getOrCreateMutableRecord(identityPath);
            record.hmrUpdateTimestamp = timestamp;
        },
        clearTransformed(identityPath, tracking) {
            let record = getOrCreateMutableRecord(identityPath);
            record.transformed = undefined;
            record.transformedVersion = undefined;
            record.resolved = undefined;
            record.resolvedVersion = undefined;
            record.emitted = undefined;
            record.emittedVersion = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, tracking);
        },
        setTransformed(identityPath, transformed, tracking) {
            let record = getOrCreateMutableRecord(identityPath);
            record.transformed = transformed;
            record.transformedVersion = record.invalidationVersion;
            record.resolved = undefined;
            record.resolvedVersion = undefined;
            record.emitted = undefined;
            record.emittedVersion = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, tracking);
        },
        setResolved(identityPath, resolved, tracking) {
            let record = getOrCreateMutableRecord(identityPath);
            removeResolvedIndexes(record);
            record.resolved = resolved;
            record.resolvedVersion = record.invalidationVersion;
            record.lastResolved = resolved;
            record.links = createLinks(resolved);
            record.emitted = undefined;
            record.emittedVersion = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, tracking);
            addResolvedIndexes(record);
        },
        clearResolved(identityPath, tracking) {
            let record = getOrCreateMutableRecord(identityPath);
            record.resolved = undefined;
            record.resolvedVersion = undefined;
            record.emitted = undefined;
            record.emittedVersion = undefined;
            record.emittedSnapshot = undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
            setTracking(record, tracking);
        },
        setEmitted(identityPath, emitted, snapshot) {
            let record = getOrCreateMutableRecord(identityPath);
            record.emitted = emitted;
            record.emittedVersion = record.invalidationVersion;
            record.emittedSnapshot = snapshot ?? undefined;
            record.staleEmitted = undefined;
            record.staleEmittedSnapshot = undefined;
        },
        invalidateForFileEvent(filePath, event) {
            let affected = new Set(recordsByTrackedFile.get(filePath) ?? []);
            if (event !== 'change') {
                for (let record of recordsByIdentityPath.values()) {
                    if (matchesTrackedDirectory(record.trackedDirectories, filePath)) {
                        affected.add(record.identityPath);
                    }
                }
            }
            for (let identityPath of affected) {
                let record = recordsByIdentityPath.get(identityPath);
                if (record) {
                    if (event === 'change') {
                        invalidateContent(record, { retainStale: true });
                    }
                    else {
                        invalidateGraph(record);
                    }
                }
            }
            if (event === 'unlink') {
                let deletedRecord = recordsByIdentityPath.get(filePath);
                if (deletedRecord) {
                    if (!affected.has(filePath)) {
                        invalidateGraph(deletedRecord);
                    }
                    clearTracking(deletedRecord);
                }
            }
        },
        invalidateAll() {
            for (let record of recordsByIdentityPath.values()) {
                invalidateGraph(record);
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
            links: createEmptyLinks(),
            trackedFiles: new Set(),
            trackedDirectories: new Set(),
        };
        recordsByIdentityPath.set(identityPath, record);
        return record;
    }
    function invalidateContent(record, options) {
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
        record.invalidationVersion += 1;
    }
    function invalidateGraph(record) {
        record.hmrUpdateTimestamp = undefined;
        invalidateContent(record, { retainStale: false });
    }
    function createLinks(resolved) {
        return {
            acceptedDependencies: new Set(options.getAcceptedDependencies?.(resolved) ?? []),
            dependencies: new Set(options.getDependencies?.(resolved) ?? []),
        };
    }
    function createEmptyLinks() {
        return {
            acceptedDependencies: new Set(),
            dependencies: new Set(),
        };
    }
    function addResolvedIndexes(record) {
        for (let depPath of record.links.dependencies) {
            addToIndexedSet(importersByDepPath, depPath, record.identityPath);
        }
        for (let depPath of record.links.acceptedDependencies) {
            addToIndexedSet(acceptedImportersByDepPath, depPath, record.identityPath);
        }
    }
    function removeResolvedIndexes(record) {
        removeFromIndexedSets(importersByDepPath, record.identityPath);
        removeFromIndexedSets(acceptedImportersByDepPath, record.identityPath);
    }
    function setTracking(record, tracking) {
        let previousWatchedDirectories = getWatchedDirectories(record);
        let previousWatchedFiles = new Set(record.trackedFiles);
        removeIndexes(record);
        let normalizedTracking = mergeTracking(tracking);
        record.trackedFiles = normalizedTracking.trackedFiles;
        record.trackedDirectories = normalizedTracking.trackedDirectories;
        for (let trackedFile of record.trackedFiles) {
            addToIndexedSet(recordsByTrackedFile, trackedFile, record.identityPath);
        }
        let nextWatchedDirectories = getWatchedDirectories(record);
        let directoryDelta = updateWatchDirectoryRefCounts(previousWatchedDirectories, nextWatchedDirectories);
        let fileDelta = updateWatchFileRefCounts(previousWatchedFiles, record.trackedFiles);
        emitWatchDirectoryDelta(directoryDelta);
        emitWatchFileDelta(fileDelta);
    }
    function clearTracking(record) {
        setTracking(record, []);
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
    function updateWatchFileRefCounts(previousWatchedFiles, nextWatchedFiles) {
        let add = [];
        let remove = [];
        for (let file of previousWatchedFiles) {
            if (nextWatchedFiles.has(file))
                continue;
            let previousCount = watchFileRefCountByPath.get(file);
            if (!previousCount)
                continue;
            if (previousCount === 1) {
                watchFileRefCountByPath.delete(file);
                remove.push(file);
            }
            else {
                watchFileRefCountByPath.set(file, previousCount - 1);
            }
        }
        for (let file of nextWatchedFiles) {
            if (previousWatchedFiles.has(file))
                continue;
            let previousCount = watchFileRefCountByPath.get(file) ?? 0;
            watchFileRefCountByPath.set(file, previousCount + 1);
            if (previousCount === 0) {
                add.push(file);
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
    function emitWatchFileDelta(delta) {
        if (!options.onWatchFilesChange)
            return;
        if (delta.add.length === 0 && delta.remove.length === 0)
            return;
        options.onWatchFilesChange(delta);
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
function removeFromIndexedSets(map, value) {
    for (let [key, values] of map) {
        values.delete(value);
        if (values.size === 0) {
            map.delete(key);
        }
    }
}
function matchesTrackedDirectory(trackedDirectories, filePath) {
    for (let trackedDirectory of trackedDirectories) {
        if (filePath === trackedDirectory || filePath.startsWith(`${trackedDirectory}/`))
            return true;
    }
    return false;
}
function normalizeTrackedDirectory(trackedDirectory) {
    return trackedDirectory.replace(/\/+$/, '') || '/';
}
function mergeTracking(tracking) {
    let trackedFiles = new Set();
    let trackedDirectories = new Set();
    for (let fragment of tracking) {
        for (let trackedFile of fragment.trackedFiles) {
            trackedFiles.add(trackedFile);
        }
        for (let trackedDirectory of fragment.trackedDirectories ?? []) {
            trackedDirectories.add(normalizeTrackedDirectory(trackedDirectory));
        }
    }
    return {
        trackedFiles,
        trackedDirectories,
    };
}
function getWatchedDirectories(record) {
    let watchedDirectories = new Set();
    for (let trackedFile of record.trackedFiles) {
        watchedDirectories.add(getFilePathDirectory(trackedFile));
    }
    for (let trackedDirectory of record.trackedDirectories) {
        watchedDirectories.add(trackedDirectory);
    }
    return watchedDirectories;
}
