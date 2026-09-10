import { formatFingerprintedPathname, hashContent } from '../fingerprint.js';
export function createFingerprintedImportEmitter(emitModule) {
    let nextModuleId = 0;
    let moduleIds = new WeakMap();
    let cachedEmissionsByFirstModule = new WeakMap();
    return async function emitScriptsWithFingerprintedImports(modules) {
        let fingerprints = new Map();
        let emissions = new Map();
        for (let modulesToEmit of getModulesToEmitTogether(modules)) {
            let firstModule = modulesToEmit.modules[0];
            if (!firstModule)
                continue;
            let cacheKey = getEmissionCacheKey(modulesToEmit, fingerprints);
            let cached = cachedEmissionsByFirstModule.get(firstModule);
            let moduleEmissions = cached?.cacheKey === cacheKey ? cached.promise : undefined;
            if (moduleEmissions === undefined) {
                moduleEmissions = emitModulesTogether(modulesToEmit, modules, fingerprints, emitModule);
                cachedEmissionsByFirstModule.set(firstModule, { cacheKey, promise: moduleEmissions });
            }
            try {
                for (let [identityPath, emitted] of await moduleEmissions) {
                    if (!emitted.fingerprint) {
                        throw new Error(`Expected a fingerprint for script ${identityPath}`);
                    }
                    fingerprints.set(identityPath, emitted.fingerprint);
                    emissions.set(identityPath, emitted);
                }
            }
            catch (error) {
                if (cachedEmissionsByFirstModule.get(firstModule)?.promise === moduleEmissions) {
                    cachedEmissionsByFirstModule.delete(firstModule);
                }
                throw error;
            }
        }
        return emissions;
    };
    function getEmissionCacheKey(modulesToEmit, fingerprints) {
        let emittedTogetherPaths = new Set(modulesToEmit.modules.map((module) => module.identityPath));
        let dependencyFingerprints = new Map();
        for (let resolvedModule of modulesToEmit.modules) {
            for (let depPath of resolvedModule.deps) {
                if (emittedTogetherPaths.has(depPath))
                    continue;
                let fingerprint = fingerprints.get(depPath);
                if (!fingerprint)
                    throw new Error(`Script dependency was not emitted: ${depPath}`);
                dependencyFingerprints.set(depPath, fingerprint);
            }
        }
        let moduleKey = modulesToEmit.modules
            .map((resolvedModule) => {
            let id = moduleIds.get(resolvedModule);
            if (id === undefined) {
                id = nextModuleId++;
                moduleIds.set(resolvedModule, id);
            }
            return id;
        })
            .join(',');
        let dependencyKey = [...dependencyFingerprints]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([identityPath, fingerprint]) => `${identityPath}\0${fingerprint}`)
            .join('\0');
        return `${moduleKey}\0${dependencyKey}`;
    }
}
async function emitModulesTogether(modulesToEmit, modules, fingerprints, emitModule) {
    let emittedTogetherPaths = new Set(modulesToEmit.modules.map((module) => module.identityPath));
    if (!modulesToEmit.hasCircularImports) {
        let resolvedModule = modulesToEmit.modules[0];
        if (!resolvedModule)
            return new Map();
        let emitted = await emitModule(resolvedModule, (identityPath) => getRewrittenImportUrl(modules, fingerprints, emittedTogetherPaths, identityPath));
        return new Map([[resolvedModule.identityPath, emitted]]);
    }
    let fingerprintInputs = await settleAllOrThrow(modulesToEmit.modules.map(async (resolvedModule) => {
        let emitted = await emitModule(resolvedModule, (identityPath) => getRewrittenImportUrl(modules, fingerprints, emittedTogetherPaths, identityPath));
        return { content: emitted.code.content, pathname: resolvedModule.stableUrlPathname };
    }));
    let cycleFingerprint = await getCircularImportFingerprint(fingerprintInputs);
    let fingerprintsWithCycle = new Map(fingerprints);
    for (let resolvedModule of modulesToEmit.modules) {
        fingerprintsWithCycle.set(resolvedModule.identityPath, cycleFingerprint);
    }
    let finalEmissions = await settleAllOrThrow(modulesToEmit.modules.map((resolvedModule) => emitModule(resolvedModule, (identityPath) => getRewrittenImportUrl(modules, fingerprintsWithCycle, new Set(), identityPath))));
    return new Map(modulesToEmit.modules.map((resolvedModule, index) => {
        let emitted = finalEmissions[index];
        if (!emitted)
            throw new Error(`Failed to emit script ${resolvedModule.identityPath}`);
        return [resolvedModule.identityPath, { ...emitted, fingerprint: cycleFingerprint }];
    }));
}
async function settleAllOrThrow(promises) {
    let results = await Promise.allSettled(promises);
    let values = [];
    let failed = false;
    let failure;
    for (let result of results) {
        if (result.status === 'fulfilled') {
            values.push(result.value);
        }
        else if (!failed) {
            failed = true;
            failure = result.reason;
        }
    }
    if (failed)
        throw failure;
    return values;
}
// Find mutually importing modules with two iterative graph traversals. First walk from each
// dependency to its importers and record finishing order. Then walk imports in reverse finishing
// order; each traversal produces modules that must share a fingerprint. Results are
// dependency-first, and iteration avoids overflowing the call stack for deep import chains.
function getModulesToEmitTogether(modules) {
    let importers = new Map();
    for (let identityPath of modules.keys())
        importers.set(identityPath, []);
    for (let resolvedModule of modules.values()) {
        for (let depPath of resolvedModule.deps) {
            if (modules.has(depPath))
                importers.get(depPath)?.push(resolvedModule.identityPath);
        }
    }
    for (let importerPaths of importers.values())
        importerPaths.sort();
    let visited = new Set();
    let finished = [];
    for (let identityPath of [...modules.keys()].sort()) {
        if (visited.has(identityPath))
            continue;
        visitPostorder(identityPath, importers, visited, finished);
    }
    visited.clear();
    let result = [];
    for (let index = finished.length - 1; index >= 0; index--) {
        let identityPath = finished[index];
        if (!identityPath || visited.has(identityPath))
            continue;
        let modulesToEmit = [];
        let stack = [identityPath];
        visited.add(identityPath);
        while (stack.length > 0) {
            let memberPath = stack.pop();
            if (!memberPath)
                continue;
            let member = modules.get(memberPath);
            if (!member)
                continue;
            modulesToEmit.push(member);
            for (let depPath of member.deps) {
                if (!modules.has(depPath) || visited.has(depPath))
                    continue;
                visited.add(depPath);
                stack.push(depPath);
            }
        }
        modulesToEmit.sort((left, right) => left.identityPath.localeCompare(right.identityPath));
        let hasCircularImports = modulesToEmit.length > 1 ||
            modulesToEmit[0]?.deps.includes(modulesToEmit[0].identityPath) === true;
        result.push({ hasCircularImports, modules: modulesToEmit });
    }
    return result;
}
function visitPostorder(root, edges, visited, finished) {
    let stack = [
        { expanded: false, identityPath: root },
    ];
    while (stack.length > 0) {
        let next = stack.pop();
        if (!next)
            continue;
        if (next.expanded) {
            finished.push(next.identityPath);
            continue;
        }
        if (visited.has(next.identityPath))
            continue;
        visited.add(next.identityPath);
        stack.push({ expanded: true, identityPath: next.identityPath });
        let adjacent = edges.get(next.identityPath) ?? [];
        for (let index = adjacent.length - 1; index >= 0; index--) {
            let identityPath = adjacent[index];
            if (identityPath && !visited.has(identityPath)) {
                stack.push({ expanded: false, identityPath });
            }
        }
    }
}
function getCircularImportFingerprint(inputs) {
    return hashContent(JSON.stringify(inputs.map(({ content, pathname }) => [pathname, content])));
}
function getRewrittenImportUrl(modules, fingerprints, stableImportPaths, identityPath) {
    let resolvedModule = modules.get(identityPath);
    if (!resolvedModule)
        throw new Error(`Script dependency was not resolved: ${identityPath}`);
    if (stableImportPaths.has(identityPath))
        return resolvedModule.stableUrlPathname;
    let fingerprint = fingerprints.get(identityPath);
    if (!fingerprint)
        throw new Error(`Script dependency was not emitted: ${identityPath}`);
    return formatFingerprintedPathname(resolvedModule.stableUrlPathname, fingerprint);
}
