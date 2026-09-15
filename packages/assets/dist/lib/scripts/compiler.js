import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { IfNoneMatch } from '@remix-run/headers/if-none-match';
import { getTsconfig } from 'get-tsconfig';
import { createAssetServerCompilationError } from '../compilation-error.js';
import { createFileMatcher } from '../file-matcher.js';
import { formatFingerprintedPathname, getFingerprintRequestCacheControl, parseFingerprintSuffix, } from '../fingerprint.js';
import { emitResolvedModule } from './emit.js';
import { createFingerprintedImportEmitter } from './fingerprinted-imports.js';
import { createBarrelFileImportOptimizer } from './optimize-barrel-file-imports.js';
import { normalizeFilePath, resolveFilePath } from '../paths.js';
import { resolveModule, resolverExtensionAlias, resolverExtensions, supportedScriptExtensions, } from './resolve.js';
import { isBareImportSpecifier } from './specifiers.js';
import { createModuleStore } from '../module-store.js';
import { createTsconfigTransformOptionsResolver, transformModule } from './transform.js';
import { ResolverFactory } from 'oxc-resolver';
const supportedScriptExtensionSet = new Set(supportedScriptExtensions);
const scriptConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1));
const emptyModulePaths = new Set();
export function createScriptCompiler(options) {
    let resolvedOptions = {
        ...options,
        externalSet: new Set(options.external),
        watchIgnoreMatchers: (options.watchIgnore ?? []).map((pattern) => createFileMatcher(pattern, options.rootDir)),
    };
    let scriptStore = createModuleStore({
        getAcceptedDependencies(resolvedModule) {
            return resolvedModule.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath);
        },
        getDependencies(resolvedModule) {
            return resolvedModule.deps;
        },
        invalidateImportersOnFileEvent: resolvedOptions.optimizeBarrelFileImports,
        onWatchDirectoriesChange: options.onWatchDirectoriesChange,
        onWatchFilesChange: options.onWatchFilesChange,
    });
    let tsconfigTransformOptionsResolver = createTsconfigTransformOptionsResolver();
    let resolverOptions = {
        aliasFields: [['browser']],
        conditionNames: ['browser', 'import', 'module', 'default'],
        extensionAlias: resolverExtensionAlias,
        extensions: resolverExtensions,
        mainFields: ['browser', 'module', 'main'],
    };
    let resolverFactory = new ResolverFactory({ ...resolverOptions, tsconfig: 'auto' });
    let directoryResolverByTsconfig = new Map();
    let tsconfigByDirectory = new Map();
    let directoryResolutionIdentityByCacheKey = new Map();
    let resolveInFlightByCacheKey = new Map();
    let emitInFlightByCacheKey = new Map();
    let emitScripts;
    if (resolvedOptions.importMaps) {
        emitScripts = emitScriptsForImportMaps;
    }
    else if (resolvedOptions.fingerprintAssets) {
        let emitFingerprintedImports = createFingerprintedImportEmitter(emitModule);
        emitScripts = (_root, modules) => emitFingerprintedImports(modules);
    }
    else {
        emitScripts = emitScriptsWithStableImports;
    }
    let hasResolvedScripts = false;
    // The compiler has no per-client module registry, so this is a conservative union of script
    // requests across connected browsers. Following static imports from these roots approximates
    // the modules that may currently be evaluated in a browser.
    let requestedScriptPaths = new Set();
    let requestedScriptGraph = null;
    let activeRequestedScriptPaths = new Set();
    let requestedScriptGraphInvalidated = false;
    let requestedScriptGraphUpdate = Promise.resolve();
    let lastHmrTimestamp = 0;
    let barrelFileImportOptimizer = resolvedOptions.optimizeBarrelFileImports
        ? createBarrelFileImportOptimizer()
        : null;
    let transformArgs = {
        define: resolvedOptions.define ?? null,
        externalSet: resolvedOptions.externalSet,
        isWatchIgnored,
        minify: resolvedOptions.minify,
        loaders: resolvedOptions.loaders,
        resolveActualPath,
        routes: resolvedOptions.routes,
        sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
        sourceMaps: resolvedOptions.sourceMaps ?? null,
        target: resolvedOptions.target ?? null,
        tsconfigTransformOptionsResolver,
    };
    let resolveArgs = {
        concurrency: scriptConcurrency,
        isDirectoryResolutionFileIndependent,
        isAllowed: resolvedOptions.isAllowed,
        isWatchIgnored,
        resolveModulePath,
        resolverFactory,
        resolveDirectorySpecifierIdentity,
        routes: resolvedOptions.routes,
        packageJsonSearchRoot: resolvedOptions.rootDir,
        trackPackageSideEffects: resolvedOptions.optimizeBarrelFileImports,
    };
    return {
        async getScript(filePath, getOptions) {
            let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(filePath));
            let record = scriptStore.get(resolvedModule.identityPath);
            let notModified = getOptions.hmrTimestamp !== null ? null : getNotModifiedScript(record, getOptions);
            if (notModified) {
                if (resolvedOptions.hmr && !getOptions.isSourceMapRequest) {
                    await rememberRequestedScript(resolvedModule.identityPath);
                }
                return notModified;
            }
            let emitted = getOptions.hmrTimestamp !== null
                ? await emitHmrScript(record, getOptions.hmrTimestamp)
                : await getOrCreateEmittedScript(record);
            if (resolvedOptions.hmr && !getOptions.isSourceMapRequest) {
                await rememberRequestedScript(resolvedModule.identityPath);
            }
            return {
                script: toScriptCompileResult(emitted),
                type: 'script',
            };
        },
        async getPreloadLayers(filePath) {
            let resolvedEntries = await getOrCreateResolvedScripts(resolveInputScriptRoots(filePath).map((identityPath) => scriptStore.get(identityPath)));
            let { servedModules } = await resolveScriptModuleGraph(resolvedEntries);
            let visited = new Set(resolvedEntries.map((entry) => entry.identityPath));
            let queue = resolvedEntries.map((entry) => entry.identityPath);
            let layers = [];
            while (queue.length > 0) {
                let frontier = queue;
                queue = [];
                let layer = [];
                for (let identityPath of frontier) {
                    let resolvedModule = servedModules.get(identityPath);
                    if (!resolvedModule)
                        continue;
                    layer.push(await getCurrentServedUrl(resolvedModule.identityPath));
                    for (let dep of resolvedModule.staticDeps) {
                        if (visited.has(dep))
                            continue;
                        visited.add(dep);
                        queue.push(dep);
                    }
                }
                layers.push(layer);
            }
            return layers;
        },
        async getImportMap(filePath) {
            let resolvedEntries = await getOrCreateResolvedScripts(resolveInputScriptRoots(filePath).map((identityPath) => scriptStore.get(identityPath)));
            if (!resolvedOptions.importMaps)
                return { imports: {} };
            // Import maps describe stable resolution. HMR versions are encoded in entry, preload, and
            // emitted import URLs because installed import map entries cannot be remapped.
            let { servedModules } = await resolveScriptModuleGraph(resolvedEntries);
            let resolvedEntrySet = new Set(resolvedEntries.map((entry) => entry.identityPath));
            let visited = new Set();
            let queue = resolvedEntries.map((entry) => entry.identityPath);
            let imports = {};
            let scopes = {};
            while (queue.length > 0) {
                let frontier = queue;
                queue = [];
                for (let identityPath of frontier) {
                    let resolvedModule = servedModules.get(identityPath);
                    if (!resolvedModule)
                        continue;
                    if (visited.has(resolvedModule.identityPath))
                        continue;
                    visited.add(resolvedModule.identityPath);
                    if (!resolvedEntrySet.has(resolvedModule.identityPath)) {
                        addImportMapEntry(imports, resolvedModule.stableUrlPathname, await getServedUrl(resolvedModule.identityPath));
                    }
                    for (let rewrite of resolvedModule.importRewrites) {
                        for (let imported of rewrite.imports) {
                            addImportMapEntry(imports, getStableUrl(imported.depPath), await getServedUrl(imported.depPath));
                        }
                    }
                    for (let imported of resolvedModule.runtimeImports) {
                        let depUrl = await getServedUrl(imported.depPath);
                        if (isBareImportSpecifier(imported.specifier)) {
                            let scopePathname = imported.scopePathname;
                            if (!scopePathname) {
                                throw new Error(`Expected import map scope for bare import "${imported.specifier}" in ${resolvedModule.identityPath}`);
                            }
                            let scopeImports = (scopes[scopePathname] ??= {});
                            addImportMapEntry(scopeImports, imported.specifier, depUrl);
                        }
                        else {
                            let browserResolvedSpecifier = resolveImportMapUrlSpecifier(imported.specifier, resolvedModule.stableUrlPathname);
                            addImportMapEntry(imports, browserResolvedSpecifier, depUrl);
                        }
                    }
                    for (let dep of resolvedModule.deps) {
                        if (!visited.has(dep)) {
                            queue.push(dep);
                        }
                    }
                }
            }
            for (let [scopePathname, scopeImports] of Object.entries(scopes)) {
                if (Object.keys(scopeImports).length === 0) {
                    delete scopes[scopePathname];
                }
            }
            return Object.keys(scopes).length > 0 ? { imports, scopes } : { imports };
        },
        async getHref(filePath) {
            let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(filePath));
            return getCurrentServedUrl(resolvedModule.identityPath);
        },
        async resolveSpecifierFromRoot(specifier) {
            let importerPath = path.join(resolvedOptions.rootDir, '__remix_virtual_entry__.js');
            let resolutionResult = await resolverFactory.resolveFileAsync(importerPath, specifier);
            if (resolutionResult.error || !resolutionResult.path) {
                throw createAssetServerCompilationError(`Failed to resolve browser module "${specifier}" from asset server root.`, { code: 'IMPORT_RESOLUTION_FAILED' });
            }
            let resolvedModule = resolveServedScriptOrThrow(resolutionResult.path);
            return {
                href: await getCurrentServedUrl(resolvedModule.identityPath),
                identityPath: resolvedModule.identityPath,
            };
        },
        async classifyHmrFileEvent(filePath, event) {
            let normalizedFilePath = normalizeFilePath(filePath);
            if (isWatchIgnored(normalizedFilePath))
                return [];
            await requestedScriptGraphUpdate;
            let timestamp = Math.max(Date.now(), lastHmrTimestamp + 1);
            lastHmrTimestamp = timestamp;
            let previousResolvedModule = scriptStore.getLastResolved(normalizedFilePath);
            let updatePathname = previousResolvedModule?.stableUrlPathname;
            let resolutionMetadataChanged = isPackageJsonPath(normalizedFilePath) || isTsconfigPath(normalizedFilePath);
            let unlinkedRequestedScript = false;
            if (event === 'unlink') {
                unlinkedRequestedScript = requestedScriptPaths.delete(normalizedFilePath);
                if (previousResolvedModule) {
                    unlinkedRequestedScript =
                        requestedScriptPaths.delete(previousResolvedModule.identityPath) ||
                            unlinkedRequestedScript;
                }
            }
            invalidateScriptFileEvent(normalizedFilePath, event);
            if (resolutionMetadataChanged && hasResolvedScripts) {
                if (resolvedOptions.optimizeBarrelFileImports && requestedScriptGraph) {
                    requestedScriptGraph = (await tryResolveRequestedScriptGraph()) ?? requestedScriptGraph;
                }
                let hmrUpdate = [
                    {
                        accepted: false,
                        filePath: normalizedFilePath,
                        path: normalizedFilePath,
                        timestamp,
                    },
                ];
                resolvedOptions.hmr?.send(hmrUpdate);
                return hmrUpdate;
            }
            if (isSupportedScriptPath(normalizedFilePath) && requestedScriptGraph) {
                let previousGraph = requestedScriptGraph;
                let candidateGraph = await tryResolveRequestedScriptGraph();
                if (candidateGraph) {
                    if (unlinkedRequestedScript) {
                        requestedScriptGraph = candidateGraph;
                        let hmrUpdate = [createRejectedHmrUpdate(normalizedFilePath, timestamp)];
                        resolvedOptions.hmr?.send(hmrUpdate);
                        return hmrUpdate;
                    }
                    let previousServedModules = getActiveModules(requestedScriptPaths, previousGraph.servedModules);
                    let candidateServedModules = getActiveModules(requestedScriptPaths, candidateGraph.servedModules);
                    requestedScriptGraph = candidateGraph;
                    let candidateHmrGraph = createScriptHmrGraph(candidateServedModules);
                    let hmrUpdate = getChangedServedModulePaths(previousServedModules, candidateServedModules).flatMap((identityPath) => {
                        let resolvedModule = candidateServedModules.get(identityPath);
                        if (!resolvedModule)
                            return [];
                        return getHmrUpdatesForChange(resolvedModule, previousServedModules.get(identityPath), resolvedModule.stableUrlPathname, timestamp, candidateHmrGraph);
                    });
                    hmrUpdate = dedupeHmrUpdates(hmrUpdate);
                    if (hmrUpdate.length > 0)
                        resolvedOptions.hmr?.send(hmrUpdate);
                    return hmrUpdate;
                }
                if (event === 'add')
                    return [];
                let previousServedModules = getActiveModules(requestedScriptPaths, previousGraph.servedModules);
                let previousIdentityPath = previousResolvedModule?.identityPath ?? normalizedFilePath;
                if (event === 'change' && !previousServedModules.has(previousIdentityPath))
                    return [];
                if (event !== 'change') {
                    let hmrUpdate = [createRejectedHmrUpdate(normalizedFilePath, timestamp)];
                    resolvedOptions.hmr?.send(hmrUpdate);
                    return hmrUpdate;
                }
            }
            let resolvedModule = event === 'change' && updatePathname
                ? await tryGetOrCreateResolvedScript(scriptStore.get(normalizedFilePath))
                : undefined;
            let hmrUpdate = event === 'change' && updatePathname
                ? getHmrUpdatesForChange(resolvedModule ?? previousResolvedModule, previousResolvedModule, updatePathname, timestamp, requestedScriptGraph
                    ? createScriptHmrGraph(getActiveModules(requestedScriptPaths, requestedScriptGraph.servedModules))
                    : undefined)
                : [];
            if (hmrUpdate.length > 0) {
                resolvedOptions.hmr?.send(hmrUpdate);
            }
            return hmrUpdate;
        },
        invalidateFileEvent(filePath, event) {
            invalidateScriptFileEvent(normalizeFilePath(filePath), event);
        },
        parseRequestPathname(pathname) {
            let parsedPathname = parseServedPathname(pathname);
            let filePath = resolvedOptions.routes.resolveUrlPathname(parsedPathname.stablePathname);
            if (!filePath)
                return null;
            if (resolvedOptions.fingerprintAssets && parsedPathname.requestedFingerprint === null)
                return null;
            return {
                cacheControl: getFingerprintRequestCacheControl(parsedPathname.requestedFingerprint),
                filePath,
                isSourceMapRequest: parsedPathname.isSourceMapRequest,
                requestedFingerprint: parsedPathname.requestedFingerprint,
            };
        },
    };
    function resolveInputFilePath(filePath) {
        if (filePath.startsWith('file://')) {
            return normalizeFilePath(fileURLToPath(new URL(filePath)));
        }
        if (filePath.includes('://')) {
            throw new TypeError(`Expected a file path or file:// URL, received "${filePath}"`);
        }
        return resolveFilePath(resolvedOptions.rootDir, filePath);
    }
    function invalidateScriptFileEvent(normalizedFilePath, event) {
        if (isWatchIgnored(normalizedFilePath))
            return;
        if (requestedScriptGraph &&
            (isSupportedScriptPath(normalizedFilePath) ||
                isPackageJsonPath(normalizedFilePath) ||
                isTsconfigPath(normalizedFilePath))) {
            requestedScriptGraphInvalidated = true;
        }
        if (shouldClearResolverCacheForFileEvent(normalizedFilePath, event)) {
            resolverFactory.clearCache();
            for (let directoryResolver of directoryResolverByTsconfig.values()) {
                directoryResolver.clearCache();
            }
            tsconfigByDirectory.clear();
            directoryResolutionIdentityByCacheKey.clear();
        }
        if (isTsconfigPath(normalizedFilePath)) {
            tsconfigTransformOptionsResolver.clear();
            scriptStore.invalidateAll();
            return;
        }
        if (isPackageJsonPath(normalizedFilePath)) {
            scriptStore.invalidateAll();
            return;
        }
        scriptStore.invalidateForFileEvent(normalizedFilePath, event);
    }
    function isDirectoryResolutionFileIndependent(directory) {
        return getDirectoryTsconfig(directory).fileIndependent;
    }
    function getDirectoryTsconfig(directory) {
        let existing = tsconfigByDirectory.get(directory);
        if (existing)
            return existing;
        let tsconfig = getTsconfig(directory);
        let result = {
            fileIndependent: !tsconfig?.config.references?.length,
            path: tsconfig?.path ?? null,
        };
        tsconfigByDirectory.set(directory, result);
        return result;
    }
    async function resolveDirectorySpecifierIdentity(directory, specifier) {
        let cacheKey = `${directory}\0${specifier}`;
        let existing = directoryResolutionIdentityByCacheKey.get(cacheKey);
        if (existing)
            return existing;
        let promise = (async () => {
            let tsconfigPath = getDirectoryTsconfig(directory).path;
            let directoryResolver = directoryResolverByTsconfig.get(tsconfigPath);
            if (!directoryResolver) {
                directoryResolver = new ResolverFactory({
                    ...resolverOptions,
                    tsconfig: tsconfigPath ? { configFile: tsconfigPath } : undefined,
                });
                directoryResolverByTsconfig.set(tsconfigPath, directoryResolver);
            }
            let result = await directoryResolver.async(directory, specifier);
            if (!result.path || !path.isAbsolute(result.path))
                return null;
            return resolveModulePath(normalizeFilePath(result.path))?.identityPath ?? null;
        })();
        directoryResolutionIdentityByCacheKey.set(cacheKey, promise);
        return promise;
    }
    function resolveServedScriptOrThrow(absolutePath) {
        let resolvedModule = resolveModulePath(absolutePath);
        if (!resolvedModule) {
            throw createAssetServerCompilationError(`File not found: ${absolutePath}`, {
                code: 'FILE_NOT_FOUND',
            });
        }
        if (!resolvedOptions.isAllowed(resolvedModule.identityPath)) {
            throw createAssetServerCompilationError(`File "${resolvedModule.identityPath}" is not allowed by the asset server access configuration. ` +
                `Add a matching allowFiles or allowPackages rule, or remove a conflicting denyFiles rule.`, {
                code: 'FILE_NOT_ALLOWED',
            });
        }
        return resolvedModule;
    }
    function resolveInputScriptRoots(filePath) {
        let resolvedEntries = [];
        let seen = new Set();
        for (let nextPath of Array.isArray(filePath) ? filePath : [filePath]) {
            let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(nextPath));
            if (seen.has(resolvedModule.identityPath))
                continue;
            seen.add(resolvedModule.identityPath);
            resolvedEntries.push(resolvedModule.identityPath);
        }
        return resolvedEntries;
    }
    function getNotModifiedScript(record, options) {
        if (hasHmrTimestampedDependency(record.resolved)) {
            return null;
        }
        if (scriptStore.isEmittedFresh(record)) {
            let current = getNotModifiedResult(record.emitted, options);
            if (current)
                return current;
        }
        if (!record.staleEmittedSnapshot || !isModuleSnapshotFresh(record.staleEmittedSnapshot)) {
            return null;
        }
        return getNotModifiedResult(record.staleEmitted, options);
    }
    async function getOrCreateResolvedScripts(records) {
        return mapWithConcurrency(records, scriptConcurrency, (record) => getOrCreateResolvedScript(record));
    }
    async function getOrCreateResolvedScript(record) {
        if (record.resolved && scriptStore.isResolvedFresh(record))
            return record.resolved;
        let cacheKey = getRecordCacheKey(record);
        let existing = resolveInFlightByCacheKey.get(cacheKey);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedVersion = record.invalidationVersion;
            let transformedModule = await getOrCreateTransformedScript(record);
            if (resolvedOptions.watchMode &&
                transformedModule.unresolvedImports.some((unresolved) => isBareImportSpecifier(unresolved.specifier))) {
                resolverFactory.clearCache();
            }
            let resolveModuleResult = await resolveModule(record, transformedModule, resolveArgs);
            if (!resolveModuleResult.ok) {
                if (isFresh(record, startedVersion)) {
                    scriptStore.clearResolved(record.identityPath, [resolveModuleResult.tracking]);
                }
                throw resolveModuleResult.error;
            }
            if (isFresh(record, startedVersion)) {
                scriptStore.setResolved(record.identityPath, resolveModuleResult.value, [
                    resolveModuleResult.tracking,
                ]);
            }
            hasResolvedScripts = true;
            return resolveModuleResult.value;
        })();
        resolveInFlightByCacheKey.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            if (resolveInFlightByCacheKey.get(cacheKey) === promise) {
                resolveInFlightByCacheKey.delete(cacheKey);
            }
        }
    }
    async function tryGetOrCreateResolvedScript(record) {
        try {
            return await getOrCreateResolvedScript(record);
        }
        catch {
            return undefined;
        }
    }
    async function getOrCreateTransformedScript(record) {
        if (record.transformed && scriptStore.isTransformedFresh(record))
            return record.transformed;
        let startedVersion = record.invalidationVersion;
        let transformModuleResult = await transformModule(record, transformArgs);
        if (!transformModuleResult.ok) {
            if (isFresh(record, startedVersion)) {
                scriptStore.clearTransformed(record.identityPath, [transformModuleResult.tracking]);
            }
            throw transformModuleResult.error;
        }
        if (isFresh(record, startedVersion)) {
            scriptStore.setTransformed(record.identityPath, transformModuleResult.value, [
                transformModuleResult.tracking,
            ]);
        }
        return transformModuleResult.value;
    }
    async function getOrCreateEmittedScript(record) {
        if (record.emitted &&
            scriptStore.isEmittedFresh(record) &&
            !hasHmrTimestampedDependency(record.resolved)) {
            return record.emitted;
        }
        let cacheKey = getRecordCacheKey(record);
        let existing = emitInFlightByCacheKey.get(cacheKey);
        if (existing)
            return existing;
        let promise = (async () => {
            let sourceRoot = await getOrCreateResolvedScript(record);
            let { servedModules, sourceModules } = await resolveScriptModuleGraph([sourceRoot]);
            let root = servedModules.get(sourceRoot.identityPath);
            if (!root)
                throw new Error(`Failed to resolve script graph for ${record.identityPath}`);
            let emissions = await emitScripts(root, servedModules);
            for (let [identityPath, emitted] of emissions) {
                let sourceModule = sourceModules.get(identityPath);
                if (sourceModule)
                    cacheEmission(sourceModule, emitted);
            }
            let emitted = emissions.get(root.identityPath);
            if (!emitted)
                throw new Error(`Failed to emit script ${record.identityPath}`);
            return emitted;
        })();
        emitInFlightByCacheKey.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            if (emitInFlightByCacheKey.get(cacheKey) === promise) {
                emitInFlightByCacheKey.delete(cacheKey);
            }
        }
    }
    async function emitScriptsForImportMaps(root) {
        return new Map([[root.identityPath, await emitModule(root)]]);
    }
    async function emitScriptsWithStableImports(root) {
        return new Map([[root.identityPath, await emitModule(root, getStableUrl)]]);
    }
    async function emitModule(resolvedModule, getRewrittenImportUrl, getImportTimestamp = getHmrImportTimestamp, hmrTimestamp = null) {
        let result = await emitResolvedModule(resolvedModule, {
            fingerprintAssets: resolvedOptions.fingerprintAssets,
            getHmrImportTimestamp: getImportTimestamp,
            getServedUrl,
            getStableUrl,
            hmrClientPathname: resolvedOptions.hmr?.clientPathname,
            hmrTimestamp,
            getRewrittenImportUrl,
            sourceMaps: resolvedOptions.sourceMaps,
        });
        if (!result.ok)
            throw result.error;
        return result.value;
    }
    async function emitHmrScript(record, hmrTimestamp) {
        let sourceRoot = await getOrCreateResolvedScript(record);
        let { servedModules } = await resolveScriptModuleGraph([sourceRoot]);
        let root = servedModules.get(sourceRoot.identityPath);
        if (!root)
            throw new Error(`Failed to resolve script graph for ${record.identityPath}`);
        return emitModule(root, getStableUrl, getHmrImportTimestamp, hmrTimestamp);
    }
    function cacheEmission(resolvedModule, emitted) {
        let record = scriptStore.get(resolvedModule.identityPath);
        if (record.resolved !== resolvedModule || !scriptStore.isResolvedFresh(record))
            return;
        scriptStore.setEmitted(resolvedModule.identityPath, emitted, createModuleSnapshot(resolvedModule.trackedFiles));
    }
    async function resolveScriptGraph(roots) {
        let visited = new Set(roots.map((root) => root.identityPath));
        let graph = new Map(roots.map((root) => [root.identityPath, root]));
        let queue = roots.flatMap((root) => root.deps);
        while (queue.length > 0) {
            let frontier = queue;
            queue = [];
            let resolvedModules = await getOrCreateResolvedScripts(frontier
                .filter((identityPath) => !visited.has(identityPath))
                .map((identityPath) => scriptStore.get(identityPath)));
            for (let resolvedModule of resolvedModules) {
                if (visited.has(resolvedModule.identityPath))
                    continue;
                visited.add(resolvedModule.identityPath);
                graph.set(resolvedModule.identityPath, resolvedModule);
                for (let dep of resolvedModule.deps) {
                    if (!visited.has(dep))
                        queue.push(dep);
                }
            }
        }
        return graph;
    }
    async function resolveScriptModuleGraph(roots) {
        let sourceModules = await resolveScriptGraph(roots);
        if (!barrelFileImportOptimizer) {
            return { servedModules: sourceModules, sourceModules };
        }
        let rewrittenModules = barrelFileImportOptimizer(sourceModules);
        let servedModules = getReachableServedModules(roots.map((root) => root.identityPath), sourceModules, rewrittenModules);
        return { servedModules, sourceModules };
    }
    async function rememberRequestedScript(identityPath) {
        if (!requestedScriptGraphInvalidated && activeRequestedScriptPaths.has(identityPath))
            return;
        requestedScriptPaths.add(identityPath);
        await tryResolveRequestedScriptGraph();
    }
    function updateRequestedScriptGraph() {
        let update = requestedScriptGraphUpdate.then(async () => {
            let graph = await resolveRequestedScriptGraph();
            requestedScriptGraph = graph;
            activeRequestedScriptPaths = new Set(getActiveModules(requestedScriptPaths, graph.servedModules).keys());
            requestedScriptGraphInvalidated = false;
            return graph;
        });
        requestedScriptGraphUpdate = update.then(() => { }, () => { });
        return update;
    }
    async function resolveRequestedScriptGraph() {
        let roots = await getOrCreateResolvedScripts([...requestedScriptPaths].map((identityPath) => scriptStore.get(identityPath)));
        return resolveScriptModuleGraph(roots);
    }
    async function tryResolveRequestedScriptGraph() {
        try {
            return await updateRequestedScriptGraph();
        }
        catch {
            return null;
        }
    }
    function getReachableServedModules(rootIdentityPaths, sourceModules, rewrittenModules) {
        let reachable = new Map();
        let queue = [...rootIdentityPaths];
        while (queue.length > 0) {
            let identityPath = queue.pop();
            if (!identityPath || reachable.has(identityPath))
                continue;
            let module = rewrittenModules.get(identityPath) ?? sourceModules.get(identityPath);
            if (!module)
                continue;
            reachable.set(identityPath, module);
            queue.push(...module.deps);
        }
        return reachable;
    }
    async function getServedUrl(identityPath) {
        let resolvedModule = await getOrCreateResolvedScript(scriptStore.get(identityPath));
        if (!resolvedOptions.fingerprintAssets) {
            return resolvedModule.stableUrlPathname;
        }
        let emittedModule = await getOrCreateEmittedScript(scriptStore.get(identityPath));
        return formatFingerprintedPathname(resolvedModule.stableUrlPathname, emittedModule.fingerprint);
    }
    async function getCurrentServedUrl(identityPath) {
        let servedUrl = await getServedUrl(identityPath);
        let timestamp = getHmrImportTimestamp(identityPath);
        return timestamp === null ? servedUrl : appendTimestamp(servedUrl, timestamp);
    }
    function getStableUrl(identityPath) {
        let stableUrlPathname = resolvedOptions.routes.toUrlPathname(identityPath);
        if (!stableUrlPathname) {
            throw createAssetServerCompilationError(`File ${identityPath} is outside all configured mounts.`, {
                code: 'FILE_OUTSIDE_MOUNTS',
            });
        }
        return stableUrlPathname;
    }
    function getHmrImportTimestamp(identityPath) {
        return scriptStore.getHmrUpdateTimestamp(identityPath) ?? null;
    }
    function hasHmrTimestampedDependency(resolvedModule) {
        return resolvedModule?.deps.some((depPath) => getHmrImportTimestamp(depPath) !== null) === true;
    }
    function getHmrUpdatesForChange(resolvedModule, previousResolvedModule, updatePathname, timestamp, hmrGraph) {
        if (resolvedModule) {
            scriptStore.setHmrUpdateTimestamp(resolvedModule.identityPath, timestamp);
        }
        if (previousResolvedModule?.hmr.selfAccepting === true) {
            return [
                {
                    accepted: true,
                    acceptedFilePath: previousResolvedModule.identityPath,
                    acceptedUrlPathname: updatePathname,
                    filePath: previousResolvedModule.identityPath,
                    path: updatePathname,
                    timestamp,
                },
            ];
        }
        let sourceFilePath = resolvedModule?.identityPath;
        let boundaries = findHmrBoundaries(sourceFilePath, hmrGraph);
        if (sourceFilePath !== undefined && boundaries) {
            for (let boundary of boundaries) {
                scriptStore.setHmrUpdateTimestamp(boundary.acceptedModule.identityPath, timestamp);
                for (let identityPath of boundary.propagationPath) {
                    scriptStore.setHmrUpdateTimestamp(identityPath, timestamp);
                }
            }
            return dedupeHmrBoundaries(boundaries).map(({ acceptedModule, boundaryModule }) => ({
                accepted: true,
                acceptedFilePath: acceptedModule.identityPath,
                acceptedUrlPathname: acceptedModule.stableUrlPathname,
                filePath: sourceFilePath,
                path: boundaryModule.stableUrlPathname,
                timestamp,
            }));
        }
        return [
            {
                accepted: false,
                filePath: resolvedModule?.identityPath ?? previousResolvedModule?.identityPath ?? updatePathname,
                path: updatePathname,
                timestamp,
            },
        ];
    }
    function findHmrBoundaries(identityPath, hmrGraph) {
        if (identityPath === undefined)
            return null;
        return propagateHmrUpdate(identityPath, new Set(), hmrGraph);
    }
    function propagateHmrUpdate(identityPath, traversed, hmrGraph) {
        if (traversed.has(identityPath))
            return [];
        let nextTraversed = new Set(traversed);
        nextTraversed.add(identityPath);
        let resolvedModule = hmrGraph
            ? hmrGraph.modules.get(identityPath)
            : scriptStore.getLastResolved(identityPath);
        if (!resolvedModule)
            return null;
        if (resolvedModule.hmr.selfAccepting) {
            return [
                {
                    acceptedModule: resolvedModule,
                    boundaryModule: resolvedModule,
                    propagationPath: [],
                },
            ];
        }
        let importerPaths = hmrGraph
            ? (hmrGraph.importersByDependency.get(identityPath) ?? emptyModulePaths)
            : scriptStore.getImporters(identityPath);
        if (!importerPaths || importerPaths.size === 0)
            return null;
        let acceptedImporterPaths = hmrGraph
            ? (hmrGraph.acceptedImportersByDependency.get(identityPath) ?? emptyModulePaths)
            : scriptStore.getAcceptedImporters(identityPath);
        let boundaries = [];
        for (let importerPath of importerPaths) {
            let importer = hmrGraph
                ? hmrGraph.modules.get(importerPath)
                : scriptStore.getLastResolved(importerPath);
            if (!importer)
                return null;
            if (acceptedImporterPaths?.has(importerPath)) {
                boundaries.push({
                    acceptedModule: resolvedModule,
                    boundaryModule: importer,
                    propagationPath: [resolvedModule.identityPath],
                });
                continue;
            }
            let importerBoundaries = propagateHmrUpdate(importerPath, nextTraversed, hmrGraph);
            if (!importerBoundaries)
                return null;
            for (let importerBoundary of importerBoundaries) {
                boundaries.push({
                    ...importerBoundary,
                    propagationPath: [resolvedModule.identityPath, ...importerBoundary.propagationPath],
                });
            }
        }
        return boundaries;
    }
    function isWatchIgnored(filePath) {
        return resolvedOptions.watchIgnoreMatchers.some((matcher) => matcher(filePath));
    }
}
function getActiveModules(rootIdentityPaths, modules) {
    let active = new Map();
    let queue = [...rootIdentityPaths];
    while (queue.length > 0) {
        let identityPath = queue.pop();
        if (!identityPath || active.has(identityPath))
            continue;
        let module = modules.get(identityPath);
        if (!module)
            continue;
        active.set(identityPath, module);
        queue.push(...module.staticDeps);
    }
    return active;
}
function getChangedServedModulePaths(previousModules, candidateModules) {
    let changed = [];
    for (let [identityPath, candidate] of candidateModules) {
        let previous = previousModules.get(identityPath);
        // New dependencies are loaded by their updated importer; they are not themselves HMR updates.
        if (previous && previous !== candidate && !isDeepStrictEqual(previous, candidate)) {
            changed.push(identityPath);
        }
    }
    return changed;
}
function createRejectedHmrUpdate(filePath, timestamp) {
    return {
        accepted: false,
        filePath,
        path: filePath,
        timestamp,
    };
}
function createScriptHmrGraph(modules) {
    let importersByDependency = new Map();
    let acceptedImportersByDependency = new Map();
    for (let module of modules.values()) {
        for (let depPath of module.deps) {
            let importers = importersByDependency.get(depPath);
            if (importers)
                importers.add(module.identityPath);
            else
                importersByDependency.set(depPath, new Set([module.identityPath]));
        }
        for (let acceptedDep of module.hmr.acceptedDeps) {
            let importers = acceptedImportersByDependency.get(acceptedDep.depPath);
            if (importers)
                importers.add(module.identityPath);
            else
                acceptedImportersByDependency.set(acceptedDep.depPath, new Set([module.identityPath]));
        }
    }
    return { acceptedImportersByDependency, importersByDependency, modules };
}
function dedupeHmrUpdates(updates) {
    let deduped = [];
    let seen = new Set();
    for (let update of updates) {
        let key = update.accepted
            ? `${update.filePath}\0${update.path}\0${update.acceptedFilePath}\0${update.acceptedUrlPathname}`
            : `${update.filePath}\0${update.path}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        deduped.push(update);
    }
    return deduped;
}
function resolveImportMapUrlSpecifier(specifier, importerUrlPathname) {
    return new URL(specifier, `http://localhost${importerUrlPathname}`).pathname;
}
function addImportMapEntry(imports, specifier, url) {
    if (specifier === url)
        return;
    imports[specifier] = url;
}
function dedupeHmrBoundaries(boundaries) {
    let seen = new Set();
    let result = [];
    for (let boundary of boundaries) {
        let key = `${boundary.boundaryModule.identityPath}\0${boundary.acceptedModule.identityPath}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push(boundary);
    }
    return result;
}
function getRecordCacheKey(record) {
    return `${record.identityPath}\0${record.invalidationVersion}`;
}
function isFresh(record, version) {
    return record.invalidationVersion === version;
}
function getNotModifiedResult(emittedModule, options) {
    if (!emittedModule || options.ifNoneMatch === null)
        return null;
    let asset = getEmittedAssetForRequest(emittedModule, options.isSourceMapRequest);
    if (!asset)
        return null;
    let servedFingerprint = options.isSourceMapRequest ? asset.fingerprint : emittedModule.fingerprint;
    if (options.requestedFingerprint !== null && servedFingerprint !== options.requestedFingerprint) {
        return null;
    }
    if (!IfNoneMatch.from(options.ifNoneMatch).matches(asset.etag))
        return null;
    return { type: 'not-modified', etag: asset.etag };
}
function getEmittedAssetForRequest(emittedModule, isSourceMapRequest) {
    return isSourceMapRequest ? emittedModule.sourceMap : emittedModule.code;
}
function createModuleSnapshot(filePaths) {
    let snapshot = new Map();
    for (let filePath of filePaths) {
        let fileSnapshot = getFileSnapshot(filePath);
        if (!fileSnapshot)
            return null;
        snapshot.set(filePath, fileSnapshot);
    }
    return snapshot;
}
function isModuleSnapshotFresh(snapshot) {
    for (let [filePath, previous] of snapshot) {
        let current = getFileSnapshot(filePath);
        if (!current)
            return false;
        if (current.mtimeNs !== previous.mtimeNs || current.size !== previous.size)
            return false;
    }
    return true;
}
function getFileSnapshot(filePath) {
    try {
        let stats = fs.statSync(filePath, { bigint: true });
        if (!stats.isFile())
            return null;
        return {
            mtimeNs: stats.mtimeNs,
            size: stats.size,
        };
    }
    catch (error) {
        if (isNoEntityError(error))
            return null;
        throw error;
    }
}
function parseServedPathname(pathname) {
    let isSourceMapRequest = pathname.endsWith('.map');
    let pathWithoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname;
    let fingerprint = parseFingerprintSuffix(pathWithoutMap);
    return {
        isSourceMapRequest,
        requestedFingerprint: fingerprint.requestedFingerprint,
        stablePathname: fingerprint.pathname,
    };
}
async function mapWithConcurrency(items, concurrency, mapper) {
    if (items.length === 0)
        return [];
    let results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            let index = nextIndex++;
            results[index] = await mapper(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}
function toScriptCompileResult(emittedModule) {
    return {
        code: emittedModule.code,
        fingerprint: emittedModule.fingerprint,
        sourceMap: emittedModule.sourceMap,
    };
}
function isPackageJsonPath(filePath) {
    return filePath.endsWith('/package.json');
}
function isSupportedScriptPath(filePath) {
    return supportedScriptExtensionSet.has(path.extname(filePath));
}
function isTsconfigPath(filePath) {
    return /\/tsconfig(?:\..+)?\.json$/.test(filePath);
}
function shouldClearResolverCacheForFileEvent(filePath, event) {
    return event !== 'change' || isPackageJsonPath(filePath) || isTsconfigPath(filePath);
}
function resolveModulePath(absolutePath) {
    let resolvedPath;
    try {
        resolvedPath = normalizeFilePath(fs.realpathSync(normalizeFilePath(absolutePath)));
    }
    catch (error) {
        if (isNoEntityError(error))
            return null;
        throw error;
    }
    if (!supportedScriptExtensionSet.has(path.extname(resolvedPath).toLowerCase())) {
        return null;
    }
    return {
        identityPath: resolvedPath,
        resolvedPath,
    };
}
function resolveActualPath(identityPath) {
    try {
        return normalizeFilePath(fs.realpathSync(identityPath));
    }
    catch (error) {
        if (isNoEntityError(error))
            return null;
        throw error;
    }
}
function isNoEntityError(error) {
    return (error instanceof Error &&
        'code' in error &&
        (error.code === 'ENOENT' ||
            error.code === 'ENOTDIR'));
}
function appendTimestamp(pathname, timestamp) {
    return `${pathname}${pathname.includes('?') ? '&' : '?'}t=${timestamp}`;
}
export function createResponseForScript(result, options) {
    let body;
    let etag;
    let contentType;
    if (options.isSourceMapRequest) {
        if (!result.sourceMap) {
            return new Response('Not found', { status: 404 });
        }
        body = options.method === 'HEAD' ? null : result.sourceMap.content;
        etag = result.sourceMap.etag;
        contentType = 'application/json; charset=utf-8';
    }
    else {
        body = options.method === 'HEAD' ? null : result.code.content;
        etag = result.code.etag;
        contentType = 'application/javascript; charset=utf-8';
    }
    if (IfNoneMatch.from(options.ifNoneMatch).matches(etag)) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return new Response(body, {
        headers: {
            'Cache-Control': options.cacheControl,
            'Content-Type': contentType,
            ETag: etag,
        },
    });
}
