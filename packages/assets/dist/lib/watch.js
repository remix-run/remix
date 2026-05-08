import chokidar from 'chokidar';
import { getFilePathDirectory, normalizeFilePath } from "./paths.js";
export function createAssetServerWatcher(options) {
    let watcher = chokidar.watch([], {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ...resolveChokidarWatchOptions(options),
    });
    options.onChokidarWatcherCreated?.(watcher);
    let watchedDirectories = new Set();
    let watchedTargets = new Set();
    for (let event of ['add', 'change', 'unlink']) {
        watcher.on(event, (filePath) => {
            options.onFileEvent(filePath, event);
        });
    }
    watcher.on('error', (error) => {
        console.error('Asset server file system watcher encountered an error.', error);
    });
    return {
        async close() {
            await watcher.close();
        },
        getWatchedTargets() {
            return [...watchedTargets];
        },
        updateWatchedDirectories(delta) {
            let nextWatchedDirectories = new Set(watchedDirectories);
            for (let directory of delta.add) {
                nextWatchedDirectories.add(directory);
            }
            for (let directory of delta.remove) {
                nextWatchedDirectories.delete(directory);
            }
            let nextTargets = getWatchTargetsForDirectories(options.rootDir, [...nextWatchedDirectories]);
            let targetsToAdd = [...nextTargets].filter((target) => !watchedTargets.has(target));
            let targetsToRemove = [...watchedTargets].filter((target) => !nextTargets.has(target));
            if (targetsToRemove.length > 0) {
                watcher.unwatch(targetsToRemove);
            }
            if (targetsToAdd.length > 0) {
                watcher.add(targetsToAdd);
            }
            watchedDirectories = nextWatchedDirectories;
            watchedTargets = nextTargets;
        },
    };
}
function resolveChokidarWatchOptions(options) {
    return {
        awaitWriteFinish: {
            pollInterval: 10,
            stabilityThreshold: 10,
        },
        depth: 0,
        ignored: ['**/.git/**', ...(options.ignore ?? [])],
        interval: options.pollInterval ?? 100,
        usePolling: options.poll ?? false,
    };
}
function getWatchTargetsForDirectories(rootDir, directories) {
    let normalizedRootDir = normalizeFilePath(rootDir);
    let targets = new Set();
    let configAncestors = new Set();
    for (let directory of directories) {
        let normalizedDirectory = normalizeFilePath(directory).replace(/\/+$/, '');
        targets.add(normalizedDirectory);
        if (!isSameOrDescendantPath(normalizedDirectory, normalizedRootDir))
            continue;
        for (let ancestor of getAncestorPaths(normalizedDirectory, normalizedRootDir)) {
            configAncestors.add(ancestor);
        }
    }
    for (let ancestor of configAncestors) {
        targets.add(ancestor);
    }
    return targets;
}
function getAncestorPaths(directoryPath, rootDir) {
    let ancestors = [];
    let currentDirectory = directoryPath;
    while (isSameOrDescendantPath(currentDirectory, rootDir)) {
        ancestors.push(currentDirectory);
        if (currentDirectory === rootDir)
            break;
        let parentDirectory = getFilePathDirectory(currentDirectory);
        if (parentDirectory === currentDirectory)
            break;
        currentDirectory = parentDirectory;
    }
    return ancestors;
}
function isSameOrDescendantPath(filePath, directoryPath) {
    let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '');
    return filePath === normalizedDirectoryPath || filePath.startsWith(`${normalizedDirectoryPath}/`);
}
