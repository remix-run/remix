import * as path from 'node:path';
import * as fs from 'node:fs';
import { isAssetServerCompilationError } from "./compilation-error.js";
import { createAccessPolicy } from "./access.js";
import { createModuleCompiler, createResponseForModule } from "./scripts/compiler.js";
import { normalizeFilePath } from "./paths.js";
import { compileRoutes } from "./routes.js";
import { createAssetServerWatcher } from "./watch.js";
const scriptTargets = [
    'es2015',
    'es2016',
    'es2017',
    'es2018',
    'es2019',
    'es2020',
    'es2021',
    'es2022',
    'es2023',
    'es2024',
    'es2025',
    'es2026',
    'esnext',
];
const scriptTargetSet = new Set(scriptTargets);
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
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, caching, and configurable file mapping.
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
    let moduleCompiler = createModuleCompiler({
        buildId: resolvedOptions.buildId,
        define: resolvedOptions.define,
        external: resolvedOptions.external,
        fingerprintModules: resolvedOptions.fingerprintModules,
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
            await moduleCompiler.handleFileEvent(normalizedFilePath, event);
        }
        catch (error) {
            console.error(`There was an error invalidating the asset server cache: ${error}`);
        }
    }
    let assetServer = {
        async fetch(request) {
            if (request.method !== 'GET' && request.method !== 'HEAD')
                return null;
            let parsedRequestPathname = moduleCompiler.parseRequestPathname(new URL(request.url).pathname);
            if (!parsedRequestPathname)
                return null;
            try {
                let ifNoneMatch = request.headers.get('If-None-Match');
                let moduleResult = await moduleCompiler.getModule(parsedRequestPathname.filePath, {
                    ifNoneMatch,
                    isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
                    requestedFingerprint: parsedRequestPathname.requestedFingerprint,
                });
                if (moduleResult.type === 'not-modified') {
                    return new Response(null, {
                        status: 304,
                        headers: { ETag: moduleResult.etag },
                    });
                }
                let compiledModule = moduleResult.module;
                if (parsedRequestPathname.requestedFingerprint !== null) {
                    if (compiledModule.fingerprint !== parsedRequestPathname.requestedFingerprint)
                        return null;
                }
                return createResponseForModule(compiledModule, {
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
                    (error.code === 'MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_ALLOWED')) {
                    return null;
                }
                return responseForError(error);
            }
        },
        async getHref(filePath) {
            return moduleCompiler.getHref(filePath);
        },
        async getPreloads(filePath) {
            return moduleCompiler.getPreloadUrls(filePath);
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
        fingerprintModules: fingerprintOptions.enabled,
        minify: scriptOptions.minify ?? false,
        onError: options.onError ?? defaultErrorHandler,
        rootDir,
        routes: compileRoutes({
            fileMap: options.fileMap,
            rootDir,
        }),
        sourceMapSourcePaths: scriptOptions.sourceMapSourcePaths ?? 'url',
        sourceMaps: scriptOptions.sourceMaps,
        scriptsTarget: normalizeTarget(scriptOptions.target),
        watchOptions: normalizeWatchOptions(options.watch),
    };
}
function normalizeTarget(target) {
    if (target == null)
        return undefined;
    if (typeof target !== 'string' || !scriptTargetSet.has(target)) {
        throw new TypeError(`Expected target to be one of ${scriptTargets.map((value) => `"${value}"`).join(', ')}. Received "${target}".`);
    }
    return target;
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
