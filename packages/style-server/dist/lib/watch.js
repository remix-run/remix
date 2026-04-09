import * as fs from 'node:fs';
import * as path from 'node:path';
import chokidar from 'chokidar';
import { resolveFilePath } from "./paths.js";
export function createStyleServerWatcher(options) {
    let watcher = chokidar.watch(getWatchTargets(options.root, options.routes), {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ...resolveChokidarWatchOptions(options),
    });
    let readyPromise = createWatcherReadyPromise(watcher);
    for (let event of ['add', 'change', 'unlink']) {
        watcher.on(event, (filePath) => {
            void options.onFileEvent(filePath, event);
        });
    }
    return {
        async close() {
            await watcher.close();
        },
        getWatchedDirectories() {
            return Object.keys(watcher.getWatched());
        },
        whenReady() {
            return readyPromise;
        },
    };
}
function resolveChokidarWatchOptions(options) {
    return {
        ignored: ['**/.git/**', ...(options.ignore ?? [])],
        interval: options.pollInterval ?? 100,
        usePolling: options.poll ?? false,
    };
}
function createWatcherReadyPromise(watcher) {
    let activeWatcher = watcher;
    return new Promise((resolve, reject) => {
        function handleReady() {
            activeWatcher.off('error', handleError);
            resolve();
        }
        function handleError(error) {
            activeWatcher.off('ready', handleReady);
            reject(error);
        }
        activeWatcher.once('ready', handleReady);
        activeWatcher.once('error', handleError);
    });
}
function getWatchTargets(root, routes) {
    let targets = new Set();
    let configRoots = new Set();
    for (let route of routes) {
        let resolvedPatternPath = resolveFilePath(root, route.filePattern);
        let watchTarget = containsGlobSyntax(route.filePattern)
            ? getGlobParentPath(resolvedPatternPath)
            : resolvedPatternPath;
        targets.add(watchTarget);
        let configRoot = getWatchConfigRoot(watchTarget);
        if (configRoot) {
            configRoots.add(configRoot);
        }
    }
    for (let configRoot of configRoots) {
        for (let ancestor of getAncestorPaths(configRoot, root)) {
            for (let configPath of getExistingConfigFileTargets(ancestor)) {
                targets.add(configPath);
            }
        }
    }
    return [...targets];
}
function getAncestorPaths(directoryPath, root) {
    let ancestors = [];
    let currentDirectory = directoryPath;
    while (isSameOrDescendantPath(currentDirectory, root)) {
        ancestors.push(currentDirectory);
        if (currentDirectory === root)
            break;
        let parentDirectory = path.posix.dirname(currentDirectory);
        if (parentDirectory === currentDirectory)
            break;
        currentDirectory = parentDirectory;
    }
    return ancestors;
}
function getGlobParentPath(pattern) {
    let firstGlobIndex = pattern.search(/[*?[\]{}()!+@]/);
    if (firstGlobIndex === -1)
        return pattern;
    let prefix = pattern.slice(0, firstGlobIndex);
    return prefix.replace(/\/+$/, '') || '/';
}
function getWatchConfigRoot(filePath) {
    try {
        if (fs.statSync(filePath).isDirectory()) {
            return filePath;
        }
    }
    catch {
        // Missing exact paths fall back to parent directory watch roots.
    }
    return path.posix.dirname(filePath);
}
function getExistingConfigFileTargets(directoryPath) {
    let targets = [];
    try {
        let entries = fs.readdirSync(directoryPath, { withFileTypes: true });
        for (let entry of entries) {
            if (!entry.isFile())
                continue;
            if (entry.name === 'package.json') {
                targets.push(`${directoryPath}/${entry.name}`);
            }
        }
    }
    catch {
        // Ignore missing or unreadable directories when building watch targets.
    }
    return targets;
}
function containsGlobSyntax(pattern) {
    return /[*?[\]{}()!+@]/.test(pattern);
}
function isSameOrDescendantPath(filePath, directoryPath) {
    let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '');
    return filePath === normalizedDirectoryPath || filePath.startsWith(`${normalizedDirectoryPath}/`);
}
