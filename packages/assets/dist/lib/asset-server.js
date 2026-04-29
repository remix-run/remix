import * as path from 'node:path';
import * as fs from 'node:fs';
import { createAccessPolicy } from "./access.js";
import { isAssetServerCompilationError } from "./compilation-error.js";
import { getFingerprintRequestCacheControl, parseFingerprintSuffix } from "./fingerprint.js";
import { normalizeFilePath } from "./paths.js";
import { compileRoutes } from "./routes.js";
import { createResponseForScript, createScriptCompiler } from "./scripts/compiler.js";
import { supportedScriptExtensions } from "./scripts/resolve.js";
import { createResponseForStyle, createStyleCompiler, isStyleFilePath } from "./styles/compiler.js";
import { resolveScriptTarget, resolveStyleTarget } from "./target.js";
import { createAssetServerWatcher } from "./watch.js";
const scriptExtensionSet = new Set(supportedScriptExtensions);
const chokidarWatcherByAssetServer = new WeakMap();
const watcherByAssetServer = new WeakMap();
export function getInternalChokidarWatcher(assetServer) {
    return chokidarWatcherByAssetServer.get(assetServer);
}
export function getInternalWatchTargets(assetServer) {
    return watcherByAssetServer.get(assetServer)?.getWatchedTargets() ?? [];
}
/**
 * Create an asset server instance
 *
 * Compiles TypeScript/JavaScript scripts and CSS styles on demand with optional
 * source-based URL fingerprinting, caching, and configurable file mapping.
 *
 * @param options Server configuration
 * @returns A {@link AssetServer} with `fetch()`, `getHref()`, and `getPreloads()` methods
 *
 * @example
 * ```ts
 * let assetServer = createAssetServer({
 *   fileMap: {
 *     '/assets/app/*path': 'app/*path',
 *   },
 *   allow: ['app/**'],
 * })
 *
 * route('/assets/*path', ({ request }) => assetServer.fetch(request))
 * ```
 */
export function createAssetServer(options) {
    let resolvedOptions = resolveAssetServerOptions(options);
    let accessPolicy = createAccessPolicy({
        allow: resolvedOptions.allow,
        deny: resolvedOptions.deny,
        rootDir: resolvedOptions.rootDir,
    });
    let watcher = null;
    let chokidarWatcher = null;
    let scriptCompiler = createScriptCompiler({
        buildId: resolvedOptions.buildId,
        define: resolvedOptions.define,
        external: resolvedOptions.external,
        fingerprintAssets: resolvedOptions.fingerprintAssets,
        isAllowed: accessPolicy.isAllowed,
        minify: resolvedOptions.minify,
        onWatchDirectoriesChange: (delta) => {
            if (!watcher)
                return;
            watcher.updateWatchedDirectories(delta);
        },
        rootDir: resolvedOptions.rootDir,
        routes: resolvedOptions.routes,
        sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
        sourceMaps: resolvedOptions.sourceMaps,
        target: resolvedOptions.scriptsTarget,
        watchIgnore: resolvedOptions.watchOptions?.ignore,
        watchMode: resolvedOptions.watchOptions !== null,
    });
    let styleCompiler = createStyleCompiler({
        buildId: resolvedOptions.buildId,
        fingerprintAssets: resolvedOptions.fingerprintAssets,
        isAllowed: accessPolicy.isAllowed,
        minify: resolvedOptions.minify,
        onWatchDirectoriesChange: (delta) => {
            if (!watcher)
                return;
            watcher.updateWatchedDirectories(delta);
        },
        rootDir: resolvedOptions.rootDir,
        routes: resolvedOptions.routes,
        sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
        sourceMaps: resolvedOptions.sourceMaps,
        targets: resolvedOptions.stylesTarget,
        watchIgnore: resolvedOptions.watchOptions?.ignore,
    });
    if (resolvedOptions.watchOptions) {
        watcher = createAssetServerWatcher({
            ...resolvedOptions.watchOptions,
            onChokidarWatcherCreated(createdWatcher) {
                chokidarWatcher = createdWatcher;
            },
            onFileEvent: handleWatchEvent,
            rootDir: resolvedOptions.rootDir,
        });
    }
    async function responseForError(error) {
        try {
            return (await resolvedOptions.onError(error)) ?? internalServerError();
        }
        catch (error) {
            console.error(`There was an error in the asset server error handler: ${error}`);
            return internalServerError();
        }
    }
    async function handleWatchEvent(filePath, event) {
        try {
            let normalizedFilePath = normalizeFilePath(filePath);
            await scriptCompiler.handleFileEvent(normalizedFilePath, event);
            await styleCompiler.handleFileEvent(normalizedFilePath, event);
        }
        catch (error) {
            console.error(`There was an error invalidating the asset server cache: ${error}`);
        }
    }
    let assetServer = {
        async fetch(request) {
            if (request.method !== 'GET' && request.method !== 'HEAD')
                return null;
            let parsedRequestPathname = parseAssetRequestPathname(new URL(request.url).pathname, {
                fingerprintAssets: resolvedOptions.fingerprintAssets,
                routes: resolvedOptions.routes,
            });
            if (!parsedRequestPathname)
                return null;
            try {
                let ifNoneMatch = request.headers.get('If-None-Match');
                if (isStyleFilePath(parsedRequestPathname.filePath)) {
                    let styleResult = await styleCompiler.getStyle(parsedRequestPathname.filePath, {
                        ifNoneMatch,
                        isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
                        requestedFingerprint: parsedRequestPathname.requestedFingerprint,
                    });
                    if (styleResult.type === 'not-modified') {
                        return new Response(null, {
                            status: 304,
                            headers: { ETag: styleResult.etag },
                        });
                    }
                    let compiledStyle = styleResult.style;
                    if (parsedRequestPathname.requestedFingerprint !== null) {
                        if (compiledStyle.fingerprint !== parsedRequestPathname.requestedFingerprint)
                            return null;
                    }
                    return createResponseForStyle(compiledStyle, {
                        cacheControl: parsedRequestPathname.cacheControl,
                        ifNoneMatch,
                        isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
                        method: request.method,
                    });
                }
                if (!isScriptFilePath(parsedRequestPathname.filePath)) {
                    return null;
                }
                let scriptResult = await scriptCompiler.getScript(parsedRequestPathname.filePath, {
                    ifNoneMatch,
                    isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
                    requestedFingerprint: parsedRequestPathname.requestedFingerprint,
                });
                if (scriptResult.type === 'not-modified') {
                    return new Response(null, {
                        status: 304,
                        headers: { ETag: scriptResult.etag },
                    });
                }
                let compiledScript = scriptResult.script;
                if (parsedRequestPathname.requestedFingerprint !== null) {
                    if (compiledScript.fingerprint !== parsedRequestPathname.requestedFingerprint)
                        return null;
                }
                return createResponseForScript(compiledScript, {
                    cacheControl: parsedRequestPathname.cacheControl,
                    ifNoneMatch,
                    isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
                    method: request.method,
                });
            }
            catch (error) {
                // A direct request can race with the filesystem or fail a deeper allow check while
                // compiling imports. In this fetch context, both cases should fall through as "not
                // handled here" so the outer router can continue to its own 404 behavior.
                if (isAssetServerCompilationError(error) &&
                    (error.code === 'FILE_NOT_FOUND' || error.code === 'FILE_NOT_ALLOWED')) {
                    return null;
                }
                return responseForError(error);
            }
        },
        async getHref(filePath) {
            if (isStyleFilePath(filePath)) {
                return styleCompiler.getHref(filePath);
            }
            return scriptCompiler.getHref(filePath);
        },
        async getPreloads(filePath) {
            let filePaths = Array.isArray(filePath) ? filePath : [filePath];
            let styleFiles = [];
            let scriptFiles = [];
            for (let nextFilePath of filePaths) {
                if (isStyleFilePath(nextFilePath)) {
                    styleFiles.push(nextFilePath);
                    continue;
                }
                scriptFiles.push(nextFilePath);
            }
            if (styleFiles.length === 0 && scriptFiles.length === 0) {
                return [];
            }
            if (styleFiles.length === 0) {
                return flattenPreloadLayers(await scriptCompiler.getPreloadLayers(filePath));
            }
            if (scriptFiles.length === 0) {
                return flattenPreloadLayers(await styleCompiler.getPreloadLayers(filePath));
            }
            // Mixed asset type preloads need to be merged, so we merge in order of first asset type seen
            let scriptPreloadLayersPromise = scriptCompiler.getPreloadLayers(scriptFiles);
            let stylePreloadLayersPromise = styleCompiler.getPreloadLayers(styleFiles);
            let preloadLayerGroups = isStyleFilePath(filePaths[0])
                ? [stylePreloadLayersPromise, scriptPreloadLayersPromise]
                : [scriptPreloadLayersPromise, stylePreloadLayersPromise];
            return mergePreloadLayers(await Promise.all(preloadLayerGroups));
        },
        async close() {
            await watcher?.close();
        },
    };
    if (chokidarWatcher) {
        chokidarWatcherByAssetServer.set(assetServer, chokidarWatcher);
    }
    if (watcher) {
        watcherByAssetServer.set(assetServer, watcher);
    }
    return assetServer;
}
function internalServerError() {
    return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}
function mergePreloadLayers(preloadLayersByRoot) {
    let urls = [];
    let seen = new Set();
    let maxDepth = Math.max(0, ...preloadLayersByRoot.map((layers) => layers.length));
    for (let depth = 0; depth < maxDepth; depth++) {
        for (let preloadLayers of preloadLayersByRoot) {
            for (let url of preloadLayers[depth] ?? []) {
                if (seen.has(url))
                    continue;
                seen.add(url);
                urls.push(url);
            }
        }
    }
    return urls;
}
function flattenPreloadLayers(preloadLayers) {
    return preloadLayers.flatMap((layer) => layer);
}
function defaultErrorHandler(error) {
    console.error(error);
}
function resolveAssetServerOptions(options) {
    let rootDir = normalizeFilePath(fs.realpathSync(path.resolve(options.rootDir ?? process.cwd())));
    let scriptOptions = options.scripts ?? {};
    let fingerprintOptions = normalizeFingerprintOptions({
        fingerprint: options.fingerprint,
        watch: options.watch,
    });
    return {
        allow: options.allow,
        buildId: fingerprintOptions.buildId,
        define: scriptOptions.define,
        deny: options.deny,
        external: scriptOptions.external ?? [],
        fingerprintAssets: fingerprintOptions.enabled,
        minify: options.minify ?? false,
        onError: options.onError ?? defaultErrorHandler,
        rootDir,
        routes: compileRoutes({
            fileMap: options.fileMap,
            rootDir,
        }),
        sourceMapSourcePaths: options.sourceMapSourcePaths ?? 'url',
        sourceMaps: options.sourceMaps,
        scriptsTarget: resolveScriptTarget(options.target),
        stylesTarget: resolveStyleTarget(options.target),
        watchOptions: normalizeWatchOptions(options.watch),
    };
}
function normalizeFingerprintOptions(options) {
    if (!options.fingerprint) {
        return {
            enabled: false,
        };
    }
    if (typeof options.fingerprint.buildId !== 'string') {
        throw new TypeError('fingerprint.buildId must be a string');
    }
    if (options.fingerprint.buildId.length === 0) {
        throw new TypeError('fingerprint.buildId must be a non-empty string');
    }
    if (options.watch !== false) {
        throw new TypeError('fingerprint cannot be used with watch mode');
    }
    return {
        enabled: true,
        buildId: options.fingerprint.buildId,
    };
}
function normalizeWatchOptions(options) {
    if (options === false)
        return null;
    if (options == null || options === true)
        return {};
    return options;
}
function parseAssetRequestPathname(pathname, options) {
    let isSourceMapRequest = pathname.endsWith('.map');
    let pathWithoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname;
    let fingerprint = parseFingerprintSuffix(pathWithoutMap);
    let filePath = options.routes.resolveUrlPathname(fingerprint.pathname);
    if (!filePath)
        return null;
    if (options.fingerprintAssets && fingerprint.requestedFingerprint === null)
        return null;
    return {
        cacheControl: getFingerprintRequestCacheControl(fingerprint.requestedFingerprint),
        filePath,
        isSourceMapRequest,
        requestedFingerprint: fingerprint.requestedFingerprint,
    };
}
function isScriptFilePath(filePath) {
    return scriptExtensionSet.has(path.extname(filePath).toLowerCase());
}
