import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IfNoneMatch } from '@remix-run/headers/if-none-match';
import { getTsconfig } from 'get-tsconfig';
import { createAssetServerCompilationError } from '../compilation-error.js';
import { createFileMatcher } from '../file-matcher.js';
import { formatFingerprintedPathname, getFingerprintRequestCacheControl, parseFingerprintSuffix, } from '../fingerprint.js';
import { emitResolvedModule } from './emit.js';
import { normalizeFilePath, resolveFilePath } from '../paths.js';
import { resolveModule, resolverExtensionAlias, resolverExtensions, supportedScriptExtensions, } from './resolve.js';
import { isBareImportSpecifier } from './specifiers.js';
import { createModuleStore } from '../module-store.js';
import { createTsconfigTransformOptionsResolver, transformModule } from './transform.js';
import { ResolverFactory } from 'oxc-resolver';
const supportedScriptExtensionSet = new Set(supportedScriptExtensions);
const scriptConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1));
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
    let hasResolvedScripts = false;
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
    };
    return {
        async getScript(filePath, getOptions) {
            let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(filePath));
            let record = scriptStore.get(resolvedModule.identityPath);
            let notModified = getNotModifiedScript(record, getOptions);
            if (notModified)
                return notModified;
            let emitted = await getOrCreateEmittedScript(record);
            return {
                script: toScriptCompileResult(emitted),
                type: 'script',
            };
        },
        async getPreloadLayers(filePath) {
            let resolvedEntries = [];
            let seen = new Set();
            for (let resolvedModule of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) => resolveServedScriptOrThrow(resolveInputFilePath(nextPath)))) {
                if (seen.has(resolvedModule.identityPath))
                    continue;
                seen.add(resolvedModule.identityPath);
                resolvedEntries.push(resolvedModule.identityPath);
            }
            let visited = new Set(resolvedEntries);
            let queue = [...resolvedEntries];
            let layers = [];
            while (queue.length > 0) {
                let frontier = queue;
                queue = [];
                let resolvedModules = await getOrCreateResolvedScripts(frontier.map((identityPath) => scriptStore.get(identityPath)));
                let layer = [];
                for (let resolvedModule of resolvedModules) {
                    layer.push(await getServedUrl(resolvedModule.identityPath));
                    for (let dep of resolvedModule.deps) {
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
            let resolvedEntries = resolveInputScriptRoots(filePath);
            let visited = new Set();
            let queue = [...resolvedEntries];
            let imports = {};
            let scopes = {};
            while (queue.length > 0) {
                let frontier = queue;
                queue = [];
                let resolvedModules = await getOrCreateResolvedScripts(frontier.map((identityPath) => scriptStore.get(identityPath)));
                for (let resolvedModule of resolvedModules) {
                    if (visited.has(resolvedModule.identityPath))
                        continue;
                    visited.add(resolvedModule.identityPath);
                    addImportMapEntry(imports, resolvedModule.stableUrlPathname, await getServedUrl(resolvedModule.identityPath));
                    for (let imported of resolvedModule.imports) {
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
                            let depStableUrl = await getStableUrl(imported.depPath);
                            if (browserResolvedSpecifier !== depStableUrl) {
                                addImportMapEntry(imports, browserResolvedSpecifier, depUrl);
                            }
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
            return getServedUrl(resolvedModule.identityPath);
        },
        async classifyHmrFileEvent(filePath, event) {
            let normalizedFilePath = normalizeFilePath(filePath);
            if (isWatchIgnored(normalizedFilePath))
                return [];
            let timestamp = Date.now();
            let previousResolvedModule = scriptStore.getLastResolved(normalizedFilePath);
            let updatePathname = previousResolvedModule?.stableUrlPathname;
            let resolutionMetadataChanged = isPackageJsonPath(normalizedFilePath) || isTsconfigPath(normalizedFilePath);
            invalidateScriptFileEvent(normalizedFilePath, event);
            if (resolutionMetadataChanged && hasResolvedScripts) {
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
            let resolvedModule = event === 'change' && updatePathname
                ? await tryGetOrCreateResolvedScript(scriptStore.get(normalizedFilePath))
                : undefined;
            let hmrUpdate = event === 'change' && updatePathname
                ? getHmrUpdatesForChange(resolvedModule ?? previousResolvedModule, previousResolvedModule, updatePathname, timestamp)
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
            let startedVersion = record.invalidationVersion;
            let resolvedModule = await getOrCreateResolvedScript(record);
            await resolveScriptGraph(resolvedModule);
            let emitResolvedModuleResult = await emitResolvedModule(resolvedModule, {
                fingerprintAssets: resolvedOptions.fingerprintAssets,
                getHmrImportTimestamp,
                getServedUrl,
                getStableUrl,
                hmrClientPathname: resolvedOptions.hmr?.clientPathname,
                sourceMaps: resolvedOptions.sourceMaps,
            });
            if (!emitResolvedModuleResult.ok) {
                throw emitResolvedModuleResult.error;
            }
            if (isFresh(record, startedVersion)) {
                scriptStore.setEmitted(record.identityPath, emitResolvedModuleResult.value, createModuleSnapshot(resolvedModule.trackedFiles));
            }
            return emitResolvedModuleResult.value;
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
    async function resolveScriptGraph(root) {
        let visited = new Set([root.identityPath]);
        let queue = [...root.deps];
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
                for (let dep of resolvedModule.deps) {
                    if (!visited.has(dep))
                        queue.push(dep);
                }
            }
        }
    }
    async function getServedUrl(identityPath) {
        let resolvedModule = await getOrCreateResolvedScript(scriptStore.get(identityPath));
        if (!resolvedOptions.fingerprintAssets) {
            return resolvedModule.stableUrlPathname;
        }
        let emittedModule = await getOrCreateEmittedScript(scriptStore.get(identityPath));
        return formatFingerprintedPathname(resolvedModule.stableUrlPathname, emittedModule.fingerprint);
    }
    function getStableUrl(identityPath) {
        let stableUrlPathname = resolvedOptions.routes.toUrlPathname(identityPath);
        if (!stableUrlPathname) {
            throw createAssetServerCompilationError(`File ${identityPath} is outside all configured fileMap entries.`, {
                code: 'FILE_OUTSIDE_FILE_MAP',
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
    function getHmrUpdatesForChange(resolvedModule, previousResolvedModule, updatePathname, timestamp) {
        if (resolvedModule) {
            scriptStore.setHmrUpdateTimestamp(resolvedModule.identityPath, timestamp);
        }
        if (resolvedModule?.hmr.selfAccepting === true) {
            return [
                {
                    accepted: true,
                    acceptedFilePath: resolvedModule.identityPath,
                    acceptedUrlPathname: updatePathname,
                    filePath: resolvedModule.identityPath,
                    path: updatePathname,
                    timestamp,
                },
            ];
        }
        let sourceFilePath = resolvedModule?.identityPath;
        let boundaries = findHmrBoundaries(sourceFilePath);
        if (sourceFilePath !== undefined && boundaries) {
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
    function findHmrBoundaries(identityPath) {
        if (identityPath === undefined)
            return null;
        return propagateHmrUpdate(identityPath, new Set());
    }
    function propagateHmrUpdate(identityPath, traversed) {
        if (traversed.has(identityPath))
            return [];
        traversed.add(identityPath);
        let resolvedModule = scriptStore.getLastResolved(identityPath);
        if (!resolvedModule)
            return null;
        if (resolvedModule.hmr.selfAccepting) {
            return [
                {
                    acceptedModule: resolvedModule,
                    boundaryModule: resolvedModule,
                },
            ];
        }
        let importerPaths = scriptStore.getImporters(identityPath);
        if (!importerPaths || importerPaths.size === 0)
            return null;
        let acceptedImporterPaths = scriptStore.getAcceptedImporters(identityPath);
        let boundaries = [];
        for (let importerPath of importerPaths) {
            let importer = scriptStore.getLastResolved(importerPath);
            if (!importer)
                return null;
            if (acceptedImporterPaths?.has(importerPath)) {
                boundaries.push({
                    acceptedModule: resolvedModule,
                    boundaryModule: importer,
                });
                continue;
            }
            let importerBoundaries = propagateHmrUpdate(importerPath, traversed);
            if (!importerBoundaries)
                return null;
            boundaries.push(...importerBoundaries);
        }
        return boundaries;
    }
    function isWatchIgnored(filePath) {
        return resolvedOptions.watchIgnoreMatchers.some((matcher) => matcher(filePath));
    }
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
    if (options.requestedFingerprint !== null && asset.fingerprint !== options.requestedFingerprint) {
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
