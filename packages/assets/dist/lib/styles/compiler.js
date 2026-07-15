import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IfNoneMatch } from '@remix-run/headers/if-none-match';
import { createFileMatcher } from "../file-matcher.js";
import { formatFingerprintedPathname } from "../fingerprint.js";
import { createModuleStore } from "../module-store.js";
import { normalizeFilePath, resolveFilePath } from "../paths.js";
import { emitResolvedStyle } from "./emit.js";
import { resolveServedStyleOrThrow, resolveStyle } from "./resolve.js";
import { transformStyle } from "./transform.js";
const preloadConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1));
const styleExtension = '.css';
export function createStyleCompiler(options) {
    let resolvedOptions = {
        ...options,
        watchIgnoreMatchers: (options.watchIgnore ?? []).map((pattern) => createFileMatcher(pattern, options.rootDir)),
    };
    let styleStore = createModuleStore({
        getDependencies(resolvedStyle) {
            return resolvedStyle.deps;
        },
        onWatchDirectoriesChange: options.onWatchDirectoriesChange,
        onWatchFilesChange: options.onWatchFilesChange,
    });
    let resolveInFlightByCacheKey = new Map();
    let emitInFlightByCacheKey = new Map();
    let resolveArgs = {
        isAllowed: resolvedOptions.isAllowed,
        isServedFilePath: resolvedOptions.isServedFilePath,
        isWatchIgnored,
        routes: resolvedOptions.routes,
    };
    let transformArgs = {
        buildId: resolvedOptions.buildId ?? null,
        isWatchIgnored,
        minify: resolvedOptions.minify,
        routes: resolvedOptions.routes,
        sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
        sourceMaps: resolvedOptions.sourceMaps ?? null,
        targets: resolvedOptions.targets ?? null,
    };
    return {
        async getHref(filePath) {
            let resolvedStyle = resolveServedStyleOrThrow(resolveInputFilePath(filePath), resolveArgs);
            return getServedUrl(resolvedStyle.identityPath);
        },
        async getPreloadLayers(filePath) {
            let resolvedEntries = [];
            let seen = new Set();
            for (let resolvedStyle of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) => resolveServedStyleOrThrow(resolveInputFilePath(nextPath), resolveArgs))) {
                if (seen.has(resolvedStyle.identityPath))
                    continue;
                seen.add(resolvedStyle.identityPath);
                resolvedEntries.push(resolvedStyle.identityPath);
            }
            let visited = new Set(resolvedEntries);
            let queue = [...resolvedEntries];
            let layers = [];
            while (queue.length > 0) {
                let frontier = queue;
                queue = [];
                let resolvedStyles = await getOrCreateResolvedStyles(frontier.map((identityPath) => styleStore.get(identityPath)));
                let layer = [];
                for (let resolvedStyle of resolvedStyles) {
                    layer.push(getServedUrlForResolvedStyle(resolvedStyle));
                    for (let dep of resolvedStyle.deps) {
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
        async getStyle(filePath, getOptions) {
            let resolvedStyle = resolveServedStyleOrThrow(resolveInputFilePath(filePath), resolveArgs);
            let record = styleStore.get(resolvedStyle.identityPath);
            let notModified = getNotModifiedStyle(record, styleStore, getOptions, hasHmrTimestampedDependency);
            if (notModified)
                return notModified;
            let emitted = await getOrCreateEmittedStyle(record);
            return {
                style: toStyleCompileResult(emitted),
                type: 'style',
            };
        },
        async classifyHmrFileEvent(filePath, event) {
            let normalizedFilePath = normalizeFilePath(filePath);
            if (isWatchIgnored(normalizedFilePath))
                return [];
            let timestamp = Date.now();
            let updatePathnames = event === 'change' ? getHmrUpdatePathnames(normalizedFilePath, timestamp) : [];
            styleStore.invalidateForFileEvent(normalizedFilePath, event);
            for (let updatePathname of updatePathnames) {
                resolvedOptions.hmr?.send(updatePathname, timestamp);
            }
            return updatePathnames.map((path) => ({
                filePath: normalizedFilePath,
                path,
                timestamp,
            }));
        },
        invalidateFileEvent(filePath, event) {
            let normalizedFilePath = normalizeFilePath(filePath);
            if (isWatchIgnored(normalizedFilePath))
                return;
            styleStore.invalidateForFileEvent(normalizedFilePath, event);
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
    async function getOrCreateResolvedStyles(records) {
        return mapWithConcurrency(records, preloadConcurrency, (record) => getOrCreateResolvedStyle(record));
    }
    async function getOrCreateResolvedStyle(record) {
        if (record.resolved && styleStore.isResolvedFresh(record))
            return record.resolved;
        let cacheKey = getRecordCacheKey(record);
        let existing = resolveInFlightByCacheKey.get(cacheKey);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedVersion = record.invalidationVersion;
            let transformedStyle = await getOrCreateTransformedStyle(record);
            let resolvedStyleResult = await resolveStyle(record, transformedStyle, resolveArgs);
            if (!resolvedStyleResult.ok) {
                if (isFresh(record, startedVersion)) {
                    styleStore.clearResolved(record.identityPath, [resolvedStyleResult.tracking]);
                }
                throw resolvedStyleResult.error;
            }
            if (isFresh(record, startedVersion)) {
                styleStore.setResolved(record.identityPath, resolvedStyleResult.value, [
                    resolvedStyleResult.tracking,
                ]);
            }
            return resolvedStyleResult.value;
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
    async function getOrCreateTransformedStyle(record) {
        if (record.transformed && styleStore.isTransformedFresh(record))
            return record.transformed;
        let startedVersion = record.invalidationVersion;
        let transformStyleResult = await transformStyle(record, transformArgs);
        if (!transformStyleResult.ok) {
            if (isFresh(record, startedVersion)) {
                styleStore.clearTransformed(record.identityPath, [transformStyleResult.tracking]);
            }
            throw transformStyleResult.error;
        }
        if (isFresh(record, startedVersion)) {
            styleStore.setTransformed(record.identityPath, transformStyleResult.value, [
                transformStyleResult.tracking,
            ]);
        }
        return transformStyleResult.value;
    }
    async function getOrCreateEmittedStyle(record) {
        if (record.emitted &&
            styleStore.isEmittedFresh(record) &&
            !hasHmrTimestampedDependency(record.resolved)) {
            return record.emitted;
        }
        let cacheKey = getRecordCacheKey(record);
        let existing = emitInFlightByCacheKey.get(cacheKey);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedVersion = record.invalidationVersion;
            let resolvedStyle = await getOrCreateResolvedStyle(record);
            let emitResolvedStyleResult = await emitResolvedStyle(resolvedStyle, {
                getServedFileUrl: resolvedOptions.getServedFileUrl,
                getServedUrl,
                sourceMaps: resolvedOptions.sourceMaps,
            });
            if (!emitResolvedStyleResult.ok) {
                throw emitResolvedStyleResult.error;
            }
            if (isFresh(record, startedVersion)) {
                styleStore.setEmitted(record.identityPath, emitResolvedStyleResult.value, null);
            }
            return emitResolvedStyleResult.value;
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
    async function getServedUrl(identityPath) {
        return getServedUrlForResolvedStyle(await getOrCreateResolvedStyle(styleStore.get(identityPath)));
    }
    function getServedUrlForResolvedStyle(resolvedStyle) {
        let pathname = formatFingerprintedPathname(resolvedStyle.stableUrlPathname, resolvedOptions.fingerprintAssets ? resolvedStyle.fingerprint : null);
        let timestamp = styleStore.getHmrUpdateTimestamp(resolvedStyle.identityPath);
        return timestamp ? appendTimestamp(pathname, timestamp) : pathname;
    }
    function getHmrUpdatePathnames(identityPath, timestamp) {
        let resolvedStyles = findHmrUpdateStyles(identityPath, new Set());
        // Mark update timestamps before invalidating so re-emitted importer stylesheets
        // can rewrite imports to the changed dependency with this HMR timestamp.
        for (let resolvedStyle of resolvedStyles) {
            styleStore.setHmrUpdateTimestamp(resolvedStyle.identityPath, timestamp);
        }
        return dedupeHmrUpdatePathnames(resolvedStyles
            .filter((resolvedStyle) => styleStore.getImporters(resolvedStyle.identityPath).size === 0)
            .map((resolvedStyle) => resolvedStyle.stableUrlPathname));
    }
    function findHmrUpdateStyles(identityPath, traversed) {
        if (traversed.has(identityPath))
            return [];
        traversed.add(identityPath);
        let resolvedStyle = styleStore.getLastResolved(identityPath);
        if (!resolvedStyle)
            return [];
        let resolvedStyles = [resolvedStyle];
        for (let importerPath of styleStore.getImporters(identityPath)) {
            resolvedStyles.push(...findHmrUpdateStyles(importerPath, traversed));
        }
        return resolvedStyles;
    }
    function hasHmrTimestampedDependency(resolvedStyle) {
        return (resolvedStyle?.deps.some((depPath) => styleStore.getHmrUpdateTimestamp(depPath) != null) ===
            true);
    }
    function isWatchIgnored(filePath) {
        return resolvedOptions.watchIgnoreMatchers.some((matcher) => matcher(filePath));
    }
}
function getRecordCacheKey(record) {
    return `${record.identityPath}\0${record.invalidationVersion}`;
}
function isFresh(record, version) {
    return record.invalidationVersion === version;
}
function getNotModifiedStyle(record, styleStore, options, hasHmrTimestampedDependency) {
    if (hasHmrTimestampedDependency(record.resolved))
        return null;
    if (!styleStore.isEmittedFresh(record))
        return null;
    let emittedStyle = record.emitted;
    if (!emittedStyle || options.ifNoneMatch === null)
        return null;
    if (options.requestedFingerprint !== null &&
        emittedStyle.fingerprint !== options.requestedFingerprint) {
        return null;
    }
    let asset = getEmittedAssetForRequest(emittedStyle, options.isSourceMapRequest);
    if (!asset)
        return null;
    if (!IfNoneMatch.from(options.ifNoneMatch).matches(asset.etag))
        return null;
    return { etag: asset.etag, type: 'not-modified' };
}
function appendTimestamp(pathname, timestamp) {
    return `${pathname}${pathname.includes('?') ? '&' : '?'}t=${timestamp}`;
}
function dedupeHmrUpdatePathnames(pathnames) {
    return [...new Set(pathnames)];
}
function getEmittedAssetForRequest(emittedStyle, isSourceMapRequest) {
    return isSourceMapRequest ? emittedStyle.sourceMap : emittedStyle.code;
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
function toStyleCompileResult(emittedStyle) {
    return {
        code: emittedStyle.code,
        fingerprint: emittedStyle.fingerprint,
        sourceMap: emittedStyle.sourceMap,
    };
}
export function isStyleFilePath(filePath) {
    return path.extname(filePath).toLowerCase() === styleExtension;
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
