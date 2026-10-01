export function createModuleStore() {
    let modulesByUrl = new Map();
    let modulesByFilePath = new Map();
    let dependenciesByImporterUrl = new Map();
    let importersByDependencyUrl = new Map();
    return {
        addDependency(importerUrl, dependencyUrl) {
            addToIndexedSet(dependenciesByImporterUrl, importerUrl, dependencyUrl);
            addToIndexedSet(importersByDependencyUrl, dependencyUrl, importerUrl);
        },
        findHotUpdateBoundaries(url, timestamp) {
            return findPropagation(url, timestamp);
        },
        findHotUpdateBoundariesFromImporters(url, timestamp) {
            return findPropagationFromImporters(url, timestamp, new Set([url]), [url]);
        },
        getModule(url) {
            return modulesByUrl.get(url);
        },
        getModulesForFile(filePath) {
            return [...(modulesByFilePath.get(filePath)?.values() ?? [])];
        },
        getReachableFilePaths(entryUrl) {
            let reachableFilePaths = new Set();
            let visitedUrls = new Set();
            visit(entryUrl);
            return reachableFilePaths;
            function visit(url) {
                if (visitedUrls.has(url))
                    return;
                let module = modulesByUrl.get(url);
                if (module === undefined)
                    return;
                visitedUrls.add(url);
                reachableFilePaths.add(module.filePath);
                for (let dependencyUrl of dependenciesByImporterUrl.get(url) ?? []) {
                    visit(dependencyUrl);
                }
            }
        },
        reset() {
            modulesByUrl = new Map();
            modulesByFilePath = new Map();
            dependenciesByImporterUrl = new Map();
            importersByDependencyUrl = new Map();
        },
        setAcceptedDependencies(url, acceptedDependencies) {
            let module = modulesByUrl.get(url);
            if (module !== undefined) {
                module.hmr.acceptedDeps = acceptedDependencies;
            }
        },
        setModule(module) {
            let previousModule = modulesByUrl.get(module.url);
            if (previousModule !== undefined) {
                removeModuleFromFileIndex(previousModule);
            }
            removeImporterDependencies(module.url);
            modulesByUrl.set(module.url, module);
            let fileModules = modulesByFilePath.get(module.filePath) ?? new Map();
            fileModules.set(module.url, module);
            modulesByFilePath.set(module.filePath, fileModules);
        },
    };
    function removeModuleFromFileIndex(module) {
        let fileModules = modulesByFilePath.get(module.filePath);
        if (fileModules === undefined)
            return;
        fileModules.delete(module.url);
        if (fileModules.size === 0) {
            modulesByFilePath.delete(module.filePath);
        }
    }
    function removeImporterDependencies(importerUrl) {
        let dependencies = dependenciesByImporterUrl.get(importerUrl);
        if (dependencies === undefined)
            return;
        for (let dependencyUrl of dependencies) {
            removeFromIndexedSet(importersByDependencyUrl, dependencyUrl, importerUrl);
        }
        dependenciesByImporterUrl.delete(importerUrl);
    }
    function findPropagation(url, timestamp, traversedUrls = new Set(), invalidatedUrls = [url]) {
        if (traversedUrls.has(url))
            return null;
        let nextTraversedUrls = new Set(traversedUrls);
        nextTraversedUrls.add(url);
        let module = modulesByUrl.get(url);
        if (module === undefined)
            return null;
        if (module.hmr.selfAccepting) {
            return [createHotUpdateBoundary(url, url, invalidatedUrls, timestamp)];
        }
        return findPropagationFromImporters(url, timestamp, nextTraversedUrls, invalidatedUrls);
    }
    function findPropagationFromImporters(url, timestamp, traversedUrls, invalidatedUrls) {
        let importerUrls = importersByDependencyUrl.get(url);
        if (importerUrls === undefined || importerUrls.size === 0)
            return null;
        let importers = [...importerUrls]
            .map((importerUrl) => modulesByUrl.get(importerUrl))
            .filter((importer) => importer !== undefined);
        if (importers.length === 0)
            return null;
        let boundaries = [];
        for (let importer of importers) {
            if (importer.hmr.acceptedDeps.includes(url)) {
                boundaries.push(createHotUpdateBoundary(url, importer.url, invalidatedUrls, timestamp));
                continue;
            }
            let importerUpdates = findPropagation(importer.url, timestamp, traversedUrls, [
                ...invalidatedUrls,
                importer.url,
            ]);
            if (importerUpdates === null)
                return null;
            boundaries.push(...importerUpdates);
        }
        return deduplicateHotUpdateBoundaries(boundaries);
    }
}
function createHotUpdateBoundary(acceptedDependencyUrl, updateHandlerUrl, invalidatedUrls, timestamp) {
    let invalidationTimestamps = {};
    for (let invalidatedUrl of invalidatedUrls) {
        invalidationTimestamps[invalidatedUrl] = timestamp;
    }
    return {
        acceptedDependencyUrl,
        invalidatedUrls: invalidationTimestamps,
        updateHandlerUrl,
    };
}
function deduplicateHotUpdateBoundaries(boundaries) {
    let boundaryByKey = new Map();
    let result = [];
    for (let boundary of boundaries) {
        let key = `${boundary.updateHandlerUrl}\0${boundary.acceptedDependencyUrl}`;
        let existingBoundary = boundaryByKey.get(key);
        if (existingBoundary !== undefined) {
            Object.assign(existingBoundary.invalidatedUrls, boundary.invalidatedUrls);
            continue;
        }
        boundaryByKey.set(key, boundary);
        result.push(boundary);
    }
    return result;
}
function addToIndexedSet(map, key, value) {
    let values = map.get(key) ?? new Set();
    values.add(value);
    map.set(key, values);
}
function removeFromIndexedSet(map, key, value) {
    let values = map.get(key);
    if (values === undefined)
        return;
    values.delete(value);
    if (values.size === 0) {
        map.delete(key);
    }
}
