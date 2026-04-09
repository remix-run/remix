import * as fs from 'node:fs';
import * as path from 'node:path';
import resolveBrowserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import { createAccessPolicy } from "./access.js";
import { createResponseForStyle, createStyleCompiler } from "./compiler.js";
import { isStyleServerCompilationError } from "./compilation-error.js";
import { normalizeFilePath } from "./paths.js";
import { compileRoutes } from "./routes.js";
import { createStyleServerWatcher } from "./watch.js";
const internalStateByStyleServer = new WeakMap();
const defaultAllow = ['**/*.css'];
// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function getInternalStyleServerWatchedDirectories(styleServer) {
    return internalStateByStyleServer.get(styleServer)?.watcher?.getWatchedDirectories() ?? [];
}
// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function waitForInternalStyleServerWatcher(styleServer) {
    return internalStateByStyleServer.get(styleServer)?.watcher?.whenReady() ?? Promise.resolve();
}
export function createStyleServer(options) {
    let resolvedOptions = resolveStyleServerOptions(options);
    let accessPolicy = createAccessPolicy({
        allow: resolvedOptions.allow,
        deny: resolvedOptions.deny,
        root: resolvedOptions.root,
    });
    let compiler = createStyleCompiler({
        buildId: resolvedOptions.buildId,
        browserslistTargets: resolvedOptions.browserslistTargets,
        fingerprintFiles: resolvedOptions.fingerprintFiles,
        isAllowed: accessPolicy.isAllowed,
        minify: resolvedOptions.minify,
        root: resolvedOptions.root,
        routes: resolvedOptions.routes,
        sourceMaps: resolvedOptions.sourceMaps,
    });
    let watcher = resolvedOptions.watchOptions
        ? createStyleServerWatcher({
            ...resolvedOptions.watchOptions,
            onFileEvent: handleWatchEvent,
            root: resolvedOptions.root,
            routes: resolvedOptions.routeDefinitions,
        })
        : null;
    async function responseForError(error) {
        try {
            return (await resolvedOptions.onError(error)) ?? internalServerError();
        }
        catch (error) {
            console.error(`There was an error in the style server error handler: ${error}`);
            return internalServerError();
        }
    }
    async function handleWatchEvent(filePath, event) {
        try {
            await compiler.handleFileEvent(filePath, event);
        }
        catch (error) {
            console.error(`There was an error invalidating the style server cache: ${error}`);
        }
    }
    let styleServer = {
        async fetch(request) {
            if (request.method !== 'GET' && request.method !== 'HEAD')
                return null;
            let parsedRequestPathname = compiler.parseRequestPathname(new URL(request.url).pathname);
            if (!parsedRequestPathname)
                return null;
            try {
                if (compiler.isStyleFile(parsedRequestPathname.filePath)) {
                    let compiledStyle = await compiler.compileStyle(parsedRequestPathname.filePath);
                    if (parsedRequestPathname.requestedFingerprint !== null) {
                        if (compiledStyle.fingerprint !== parsedRequestPathname.requestedFingerprint) {
                            return null;
                        }
                    }
                    return createResponseForStyle(compiledStyle, {
                        cacheControl: parsedRequestPathname.cacheControl,
                        ifNoneMatch: request.headers.get('If-None-Match'),
                        isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
                        method: request.method,
                    });
                }
                if (parsedRequestPathname.isSourceMapRequest) {
                    return null;
                }
                return null;
            }
            catch (error) {
                if (isStyleServerCompilationError(error) &&
                    (error.code === 'FILE_NOT_FOUND' || error.code === 'FILE_NOT_ALLOWED')) {
                    return null;
                }
                return responseForError(error);
            }
        },
        async getHref(filePath) {
            return compiler.getHref(filePath);
        },
        async getPreloads(filePath) {
            return compiler.getPreloadUrls(filePath);
        },
        async close() {
            await watcher?.close();
        },
    };
    internalStateByStyleServer.set(styleServer, {
        watcher,
    });
    return styleServer;
}
function internalServerError() {
    return new Response('Internal Server Error', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        status: 500,
    });
}
function defaultErrorHandler(error) {
    console.error(error);
}
function resolveStyleServerOptions(options) {
    let root = normalizeFilePath(fs.realpathSync(path.resolve(options.root ?? process.cwd())));
    let fingerprintOptions = normalizeFingerprintOptions({
        fingerprint: options.fingerprint,
        watch: options.watch,
    });
    return {
        allow: options.allow ?? defaultAllow,
        buildId: fingerprintOptions.buildId,
        browserslistTargets: normalizeBrowserslistTargets(options.browserslist),
        deny: options.deny,
        fingerprintFiles: fingerprintOptions.enabled,
        minify: options.minify ?? false,
        onError: options.onError ?? defaultErrorHandler,
        root,
        routeDefinitions: options.routes,
        routes: compileRoutes({
            root,
            routes: options.routes,
        }),
        sourceMaps: options.sourceMaps,
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
    if (options.watch) {
        throw new TypeError('fingerprint cannot be used with watch mode');
    }
    return {
        buildId: options.fingerprint.buildId,
        enabled: true,
    };
}
function normalizeWatchOptions(options) {
    if (!options)
        return null;
    return options === true ? {} : options;
}
function normalizeBrowserslistTargets(query) {
    if (query == null)
        return undefined;
    if (typeof query !== 'string') {
        throw new TypeError('browserslist must be a string');
    }
    if (query.trim().length === 0) {
        throw new TypeError('browserslist must be a non-empty string');
    }
    return browserslistToTargets(resolveBrowserslist(query));
}
