import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IfNoneMatch } from '@remix-run/headers';
import { createStyleServerCompilationError } from "./compilation-error.js";
import { emitResolvedStyle } from "./emit.js";
import { formatFingerprintedPathname, generateFingerprint, getFingerprintRequestCacheControl, parseFingerprintSuffix, } from "./fingerprint.js";
import { normalizeFilePath, resolveFilePath } from "./paths.js";
import { resolveServedFileOrThrow, resolveStyle } from "./resolve.js";
import { createStyleStore } from "./store.js";
import { transformStyle } from "./transform.js";
const preloadConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1));
const styleExtensions = new Set(['.css']);
export function createStyleCompiler(options) {
    let store = createStyleStore();
    let resolveInFlightByIdentityPath = new Map();
    let emitInFlightByIdentityPath = new Map();
    let resolveArgs = {
        isAllowed: options.isAllowed,
        routes: options.routes,
    };
    let assetFingerprintCache = new Map();
    let transformArgs = {
        buildId: options.buildId ?? null,
        targets: options.browserslistTargets ?? null,
        minify: options.minify,
        routes: options.routes,
        sourceMaps: options.sourceMaps ?? null,
    };
    return {
        async compileStyle(filePath) {
            let resolved = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs);
            if (!isStyleFilePath(resolved.identityPath)) {
                throw createStyleServerCompilationError(`Expected a CSS file, received "${resolved.identityPath}".`, {
                    code: 'STYLE_TRANSFORM_FAILED',
                });
            }
            return toCompiledStyleResult(await getOrCreateEmittedStyle(store.get(resolved.identityPath)));
        },
        async getFingerprint(filePath) {
            let resolved = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs);
            return getFingerprintForIdentityPath(resolved.identityPath);
        },
        async getHref(filePath) {
            let resolved = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs);
            return getServedUrl(resolved.identityPath);
        },
        async getPreloadUrls(filePath) {
            let resolvedEntries = [];
            let seen = new Set();
            let urls = [];
            for (let resolved of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) => resolveServedFileOrThrow(resolveInputFilePath(nextPath), resolveArgs))) {
                if (seen.has(resolved.identityPath))
                    continue;
                seen.add(resolved.identityPath);
                if (isStyleFilePath(resolved.identityPath)) {
                    resolvedEntries.push(resolved.identityPath);
                }
                else {
                    urls.push(await getServedUrl(resolved.identityPath));
                }
            }
            let visited = new Set(resolvedEntries);
            let queue = [...resolvedEntries];
            while (queue.length > 0) {
                let frontier = queue;
                queue = [];
                let resolvedStyles = await getOrCreateResolvedStyles(frontier.map((identityPath) => store.get(identityPath)));
                for (let resolvedStyle of resolvedStyles) {
                    urls.push(getServedUrlForResolvedStyle(resolvedStyle));
                    for (let dep of resolvedStyle.deps) {
                        if (visited.has(dep))
                            continue;
                        visited.add(dep);
                        queue.push(dep);
                    }
                }
            }
            return urls;
        },
        async handleFileEvent(filePath, event) {
            assetFingerprintCache.clear();
            store.invalidateForFileEvent(normalizeFilePath(filePath), toStoreWatchEvent(event));
        },
        isStyleFile(filePath) {
            return isStyleFilePath(filePath);
        },
        parseRequestPathname(pathname) {
            let parsedPathname = parseServedPathname(pathname);
            let filePath = options.routes.resolveUrlPathname(parsedPathname.stablePathname);
            if (!filePath)
                return null;
            if (options.fingerprintFiles &&
                parsedPathname.requestedFingerprint === null &&
                !parsedPathname.isSourceMapRequest) {
                return null;
            }
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
        return resolveFilePath(options.root, filePath);
    }
    async function getOrCreateResolvedStyles(records) {
        return mapWithConcurrency(records, preloadConcurrency, (record) => getOrCreateResolvedStyle(record));
    }
    async function getOrCreateResolvedStyle(record) {
        if (record.resolved)
            return record.resolved;
        let existing = resolveInFlightByIdentityPath.get(record.identityPath);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedAt = Date.now();
            let transformedStyle = await getOrCreateTransformedStyle(record);
            let resolvedStyleResult = await resolveStyle(record, transformedStyle, resolveArgs);
            if (!resolvedStyleResult.ok) {
                if (startedAt >= record.lastInvalidatedAt) {
                    store.setResolveFailure(record.identityPath, resolvedStyleResult.tracking);
                }
                throw resolvedStyleResult.error;
            }
            if (startedAt >= record.lastInvalidatedAt) {
                store.setResolved(record.identityPath, resolvedStyleResult.value);
            }
            return resolvedStyleResult.value;
        })();
        resolveInFlightByIdentityPath.set(record.identityPath, promise);
        try {
            return await promise;
        }
        finally {
            if (resolveInFlightByIdentityPath.get(record.identityPath) === promise) {
                resolveInFlightByIdentityPath.delete(record.identityPath);
            }
        }
    }
    async function getOrCreateTransformedStyle(record) {
        if (record.transformed)
            return record.transformed;
        let startedAt = Date.now();
        let transformStyleResult = await transformStyle(record, transformArgs);
        if (!transformStyleResult.ok) {
            if (startedAt >= record.lastInvalidatedAt) {
                store.setTransformFailure(record.identityPath, {
                    trackedFiles: transformStyleResult.trackedFiles,
                });
            }
            throw transformStyleResult.error;
        }
        if (startedAt >= record.lastInvalidatedAt) {
            store.setTransformed(record.identityPath, transformStyleResult.value);
        }
        return transformStyleResult.value;
    }
    async function getOrCreateEmittedStyle(record) {
        if (record.emitted)
            return record.emitted;
        let existing = emitInFlightByIdentityPath.get(record.identityPath);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedAt = Date.now();
            let resolvedStyle = await getOrCreateResolvedStyle(record);
            let emitResolvedStyleResult = await emitResolvedStyle(resolvedStyle, {
                getServedUrl,
                sourceMaps: options.sourceMaps,
            });
            if (!emitResolvedStyleResult.ok) {
                throw emitResolvedStyleResult.error;
            }
            if (startedAt >= record.lastInvalidatedAt) {
                store.setEmitted(record.identityPath, emitResolvedStyleResult.value);
            }
            return emitResolvedStyleResult.value;
        })();
        emitInFlightByIdentityPath.set(record.identityPath, promise);
        try {
            return await promise;
        }
        finally {
            if (emitInFlightByIdentityPath.get(record.identityPath) === promise) {
                emitInFlightByIdentityPath.delete(record.identityPath);
            }
        }
    }
    async function getServedUrl(identityPath) {
        if (isStyleFilePath(identityPath)) {
            return getServedUrlForResolvedStyle(await getOrCreateResolvedStyle(store.get(identityPath)));
        }
        let stableUrlPathname = options.routes.toUrlPathname(identityPath);
        if (!stableUrlPathname) {
            throw createStyleServerCompilationError(`File is outside configured style-server routes: ${identityPath}`, {
                code: 'FILE_OUTSIDE_ROUTES',
            });
        }
        return formatFingerprintedPathname(stableUrlPathname, await getAssetFingerprint(identityPath));
    }
    async function getFingerprintForIdentityPath(identityPath) {
        if (isStyleFilePath(identityPath)) {
            return (await getOrCreateResolvedStyle(store.get(identityPath))).fingerprint;
        }
        return getAssetFingerprint(identityPath);
    }
    function getServedUrlForResolvedStyle(resolvedStyle) {
        return formatFingerprintedPathname(resolvedStyle.stableUrlPathname, options.fingerprintFiles ? resolvedStyle.fingerprint : null);
    }
    async function getAssetFingerprint(identityPath) {
        if (!options.fingerprintFiles)
            return null;
        let existing = assetFingerprintCache.get(identityPath);
        if (existing)
            return existing;
        let promise = (async () => generateFingerprint({
            buildId: options.buildId,
            content: new Uint8Array(await fs.promises.readFile(identityPath)),
        }))();
        assetFingerprintCache.set(identityPath, promise);
        try {
            return await promise;
        }
        catch (error) {
            assetFingerprintCache.delete(identityPath);
            throw error;
        }
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
function isStyleFilePath(filePath) {
    return styleExtensions.has(path.extname(filePath).toLowerCase());
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
function toCompiledStyleResult(emittedStyle) {
    return {
        code: emittedStyle.code,
        fingerprint: emittedStyle.fingerprint,
        sourceMap: emittedStyle.sourceMap,
    };
}
function toStoreWatchEvent(event) {
    if (event === 'unlink')
        return 'delete';
    return event;
}
export function createResponseForStyle(result, options) {
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
        contentType = 'text/css; charset=utf-8';
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
