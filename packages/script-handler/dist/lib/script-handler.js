import * as path from 'node:path';
import * as fs from 'node:fs';
import picomatch from 'picomatch';
import { normalizeRootPrefix, resolveAbsolutePathFromResolvedRoots, resolvePublicPathFromResolvedRoots, } from "./path-utils.js";
import { buildGraph, collectTransitiveDeps, createModuleGraphStore, isCompiledGraphFresh, } from "./module-graph.js";
import { generateETag, matchesETag } from "./etag.js";
/**
 * Create the server-side scripts handler.
 *
 * Compiles TypeScript/JavaScript modules on demand with content-addressed URLs:
 * - Internal modules served at `.@hash` URLs with `Cache-Control: immutable`
 * - Entry points served with `Cache-Control: no-cache` + ETags
 * - Circular dependencies handled via Tarjan's SCC algorithm — modules in a cycle
 *   share a deterministic hash derived from their combined sources and external deps
 * - CommonJS detection with clear error messages
 * - GET and HEAD support
 *
 * @param options Handler configuration
 * @returns A {@link ScriptHandler} with `handle()` and `preloads()` methods
 *
 * @example
 * ```ts
 * let scripts = createScriptHandler({
 *   base: '/scripts',
 *   roots: [{ directory: import.meta.dirname, entryPoints: ['app/entry.tsx'] }],
 * })
 *
 * route('/scripts/*path', ({ request, params }) => scripts.handle(request, params.path))
 * ```
 */
export function createScriptHandler(options) {
    function normalizeBase(base) {
        let normalized = `/${base}`.replace(/^\/+/, '/').replace(/\/+$/, '');
        return normalized || '/';
    }
    function toAbsolutePath(directory, relativePath) {
        return relativePath === '' ? directory : path.join(directory, ...relativePath.split('/'));
    }
    function normalizeRoots(configuredRoots) {
        if (configuredRoots.length === 0) {
            throw new Error('createScriptHandler() requires at least one configured root.');
        }
        let seenPrefixes = new Set();
        let fallbackRoots = 0;
        let normalizedRoots = configuredRoots.map((configuredRoot) => {
            let prefix = normalizeRootPrefix(configuredRoot.prefix);
            if (prefix == null) {
                fallbackRoots++;
                if (fallbackRoots > 1) {
                    throw new Error('Only one configured root may omit prefix.');
                }
            }
            else if (seenPrefixes.has(prefix)) {
                throw new Error(`Duplicate configured root prefix "${prefix}".`);
            }
            else {
                seenPrefixes.add(prefix);
            }
            return { configuredRoot, prefix };
        });
        return normalizedRoots.map(({ configuredRoot, prefix }) => {
            let directory = fs.realpathSync(path.resolve(process.cwd(), configuredRoot.directory));
            let entryPoints = configuredRoot.entryPoints ?? [];
            return {
                prefix,
                directory,
                entryPoints,
                entryPointMatchers: entryPoints.map((entryPoint) => picomatch(entryPoint, { dot: true })),
            };
        });
    }
    let roots = normalizeRoots(options.roots);
    let sourceMaps = options.sourceMaps;
    let sourceMapSourcePaths = options.sourceMapSourcePaths ?? 'virtual';
    let externalRaw = options.external;
    let external = Array.isArray(externalRaw)
        ? externalRaw
        : externalRaw
            ? [externalRaw]
            : [];
    let base = normalizeBase(options.base);
    let onError = options.onError ?? defaultErrorHandler;
    let store = createModuleGraphStore();
    let graphBuilds = new Map();
    let preloadCache = new Map();
    let publicPathCache = new Map();
    function isEntryPointInRoot(resolvedRoot, relativePath) {
        return resolvedRoot.entryPointMatchers.some((matcher) => matcher(relativePath));
    }
    function resolveAbsolutePath(absolutePath) {
        return resolveAbsolutePathFromResolvedRoots(absolutePath, roots);
    }
    function resolvePublicPath(modulePath) {
        return resolvePublicPathFromResolvedRoots(modulePath, roots);
    }
    function isEntryPointAbsolute(absolutePath) {
        let resolved = resolveAbsolutePath(absolutePath);
        if (!resolved)
            return false;
        return isEntryPointInRoot(resolved.resolvedRoot, resolved.relativePath);
    }
    function toModuleUrl(relativePath) {
        return base === '/' ? `/${relativePath}` : `${base}/${relativePath}`;
    }
    function createModuleGraphOptions() {
        return {
            base,
            roots,
            external,
            sourceMaps,
            sourceMapSourcePaths,
            isEntryPoint: isEntryPointAbsolute,
        };
    }
    function getPublicPath(absolutePath) {
        if (publicPathCache.has(absolutePath)) {
            return publicPathCache.get(absolutePath) ?? null;
        }
        let publicPath = resolveAbsolutePath(absolutePath)?.publicPath ?? null;
        publicPathCache.set(absolutePath, publicPath);
        return publicPath;
    }
    function getPreloadUrls(absolutePath) {
        let allDeps = collectTransitiveDeps(absolutePath, store);
        let urls = [];
        for (let [depPath, depResult] of allDeps) {
            let publicPath = getPublicPath(depPath);
            if (!publicPath) {
                throw new Error(`Compiled module ${depPath} is outside all configured roots.`);
            }
            let url = isEntryPointAbsolute(depPath)
                ? toModuleUrl(publicPath)
                : toModuleUrl(`${publicPath}.@${depResult.compiledHash}`);
            urls.push(url);
        }
        return urls;
    }
    function resolvePreloadEntryPoint(entryPoint) {
        let resolved = path.isAbsolute(entryPoint)
            ? resolveAbsolutePath(fs.realpathSync(entryPoint))
            : resolvePublicPath(entryPoint);
        if (!resolved) {
            throw new Error(`Entry point "${entryPoint}" is outside all configured roots.`);
        }
        if (!isEntryPointInRoot(resolved.resolvedRoot, resolved.relativePath)) {
            throw new Error(`Entry point "${entryPoint}" does not match any configured entry points.`);
        }
        return {
            absolutePath: toAbsolutePath(resolved.resolvedRoot.directory, resolved.relativePath),
            resolvedRoot: resolved.resolvedRoot,
            relativePath: resolved.relativePath,
        };
    }
    async function buildGraphCached(absolutePath) {
        let existing = graphBuilds.get(absolutePath);
        if (existing)
            return existing;
        let promise = buildGraph(absolutePath, store, createModuleGraphOptions());
        graphBuilds.set(absolutePath, promise);
        try {
            return await promise;
        }
        finally {
            graphBuilds.delete(absolutePath);
        }
    }
    function serveModule(result, opts) {
        let etag = generateETag(result.compiledHash);
        if (opts.isSourceMapRequest) {
            if (sourceMaps !== 'external' || !result.sourcemap) {
                return new Response('Not found', { status: 404 });
            }
            if (matchesETag(opts.ifNoneMatch, etag)) {
                return new Response(null, { status: 304, headers: { ETag: etag } });
            }
            let body = opts.method === 'HEAD' ? null : result.sourcemap;
            return new Response(body, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': opts.immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
                    ...(opts.immutable ? {} : { ETag: etag }),
                },
            });
        }
        if (matchesETag(opts.ifNoneMatch, etag)) {
            return new Response(null, { status: 304, headers: { ETag: etag } });
        }
        let body = opts.method === 'HEAD' ? null : result.compiledCode;
        return new Response(body, {
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': opts.immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
                ...(opts.immutable ? {} : { ETag: etag }),
            },
        });
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
    async function responseForError(error) {
        try {
            return (await onError(error)) ?? internalServerError();
        }
        catch (error) {
            console.error(`There was an error in the script handler error handler: ${error}`);
            return internalServerError();
        }
    }
    function isNotFoundError(error) {
        return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
    }
    async function handleInternalModuleRequest(absolutePath, requestedToken, isSourceMapRequest, method) {
        try {
            let cached = store.get(absolutePath);
            if (cached && (await isCompiledGraphFresh(absolutePath, store))) {
                if (cached.compiledHash !== requestedToken)
                    return null;
                return serveModule(cached, {
                    isSourceMapRequest,
                    method,
                    ifNoneMatch: null, // immutable — browser never revalidates
                    immutable: true,
                });
            }
            let result = await buildGraphCached(absolutePath);
            if (result.compiledHash !== requestedToken)
                return null;
            return serveModule(result, {
                isSourceMapRequest,
                method,
                ifNoneMatch: null, // immutable — browser never revalidates
                immutable: true,
            });
        }
        catch (error) {
            if (isNotFoundError(error))
                return null;
            return responseForError(error);
        }
    }
    async function handleEntryPointRequest(absolutePath, isSourceMapRequest, ifNoneMatch, method) {
        try {
            let cached = store.get(absolutePath);
            if (cached && (await isCompiledGraphFresh(absolutePath, store))) {
                return serveModule(cached, {
                    isSourceMapRequest,
                    method,
                    ifNoneMatch,
                    immutable: false,
                });
            }
            let result = await buildGraphCached(absolutePath);
            return serveModule(result, {
                isSourceMapRequest,
                method,
                ifNoneMatch,
                immutable: false,
            });
        }
        catch (error) {
            return responseForError(error);
        }
    }
    return {
        async handle(request, modulePath) {
            if (request.method !== 'GET' && request.method !== 'HEAD')
                return null;
            let normalizedModulePath = modulePath.replace(/^\/+/, '');
            let isSourceMapRequest = normalizedModulePath.endsWith('.map');
            let withoutMap = isSourceMapRequest ? normalizedModulePath.slice(0, -4) : normalizedModulePath;
            let tokenMatch = withoutMap.match(/\.@([a-z0-9]+)$/);
            let requestedToken = tokenMatch ? tokenMatch[1] : null;
            let normalizedPath = tokenMatch ? withoutMap.slice(0, -tokenMatch[0].length) : withoutMap;
            if (normalizedPath.length === 0)
                return null;
            let resolved = resolvePublicPath(normalizedPath);
            if (!resolved)
                return null;
            let absolutePath = toAbsolutePath(resolved.resolvedRoot.directory, resolved.relativePath);
            let ifNoneMatch = request.headers.get('If-None-Match');
            if (requestedToken !== null) {
                return handleInternalModuleRequest(absolutePath, requestedToken, isSourceMapRequest, request.method);
            }
            if (!isEntryPointInRoot(resolved.resolvedRoot, resolved.relativePath))
                return null;
            return handleEntryPointRequest(absolutePath, isSourceMapRequest, ifNoneMatch, request.method);
        },
        async preloads(entryPoint) {
            let { absolutePath } = resolvePreloadEntryPoint(entryPoint);
            let existing = preloadCache.get(absolutePath);
            let cached = store.get(absolutePath);
            if (existing &&
                cached?.compiledHash === existing.compiledHash &&
                (await isCompiledGraphFresh(absolutePath, store))) {
                return [...(await existing.promise)];
            }
            let result = await buildGraphCached(absolutePath);
            let nextEntry = {
                compiledHash: result.compiledHash,
                promise: Promise.resolve(getPreloadUrls(absolutePath)),
            };
            preloadCache.set(absolutePath, nextEntry);
            try {
                await nextEntry.promise;
            }
            catch (error) {
                if (preloadCache.get(absolutePath) === nextEntry) {
                    preloadCache.delete(absolutePath);
                }
                throw error;
            }
            let current = preloadCache.get(absolutePath);
            let urls = current && current !== nextEntry ? await current.promise : await nextEntry.promise;
            return [...urls];
        },
    };
}
