import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IfNoneMatch } from '@remix-run/headers';
import { detectContentType } from '@remix-run/mime';
import { createAssetServerCompilationError, isAssetServerCompilationError, } from "../compilation-error.js";
import { formatFingerprintedPathname, generateFingerprint, hashContent } from "../fingerprint.js";
import { normalizeFilePath, resolveFilePath } from "../paths.js";
import { parseAssetTransformInvocations } from "./config.js";
import { createSourceFileStore } from "./store.js";
export function createFileCompiler(options) {
    let resolvedOptions = {
        ...options,
        extensionSet: new Set(options.extensions),
    };
    let sourceFileStore = createSourceFileStore({
        onWatchDirectoriesChange: options.onWatchDirectoriesChange,
    });
    let sourceFileInFlightByCacheKey = new Map();
    let transformedAssetMetadataByCacheKey = new Map();
    let transformedCacheKeysByIdentityPath = new Map();
    let transformedEmitInFlightByCacheKey = new Map();
    let cacheEpoch = resolvedOptions.buildId ?? crypto.randomUUID();
    let resolveArgs = {
        extensions: resolvedOptions.extensionSet,
        isAllowed: resolvedOptions.isAllowed,
        routes: resolvedOptions.routes,
    };
    return {
        async getFile(filePath, getOptions) {
            let resolvedFile = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs);
            let record = getFreshSourceFileRecord(resolvedFile.identityPath);
            if (shouldUseTransformPipeline(getOptions.transform)) {
                let cacheKey = getTransformedRecordCacheKey(cacheEpoch, record, getOptions.transform);
                let notModified = getNotModifiedFile(transformedAssetMetadataByCacheKey.get(cacheKey), getOptions);
                if (notModified)
                    return notModified;
                let transformedFile = await getOrCreateTransformedFile(record, getOptions.transform);
                notModified = getNotModifiedFile(toEmittedFileMetadata(transformedFile), getOptions);
                if (notModified)
                    return notModified;
                return {
                    file: transformedFile,
                    type: 'file',
                };
            }
            let notModified = getNotModifiedFile(record.metadata, getOptions);
            if (notModified)
                return notModified;
            if (record.staleMetadata &&
                record.staleMetadataSnapshot &&
                isFileSnapshotFresh(record.staleMetadataSnapshot)) {
                let staleNotModified = getNotModifiedFile(record.staleMetadata, getOptions);
                if (staleNotModified)
                    return staleNotModified;
            }
            let file = await getOrCreateSourceFile(record);
            return {
                file,
                type: 'file',
            };
        },
        async getHref(filePath, hrefOptions) {
            let resolvedFile = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs);
            let record = getFreshSourceFileRecord(resolvedFile.identityPath);
            let href = resolvedOptions.fingerprintAssets
                ? formatFingerprintedPathname(resolvedFile.stableUrlPathname, (await getOrCreateSourceFileMetadata(record)).fingerprint)
                : resolvedFile.stableUrlPathname;
            if (shouldUseTransformPipeline(hrefOptions.transform)) {
                return appendTransformQuery(href, hrefOptions.transform);
            }
            return href;
        },
        async handleFileEvent(filePath, event) {
            if (!isServedFilePath(filePath, resolvedOptions.extensionSet))
                return;
            sourceFileStore.invalidateForFileEvent(filePath, event);
            clearTransformedCacheIndex(filePath);
        },
        isServedFilePath(filePath) {
            return isServedFilePath(filePath, resolvedOptions.extensionSet);
        },
        validateTransformQuery(transformQuery) {
            parseRequestTransforms(transformQuery, resolvedOptions.transforms, resolvedOptions.maxRequestTransforms);
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
    function shouldUseTransformPipeline(transformQuery) {
        return ((transformQuery !== null && transformQuery.length > 0) ||
            resolvedOptions.globalTransforms.length > 0);
    }
    function getFreshSourceFileRecord(identityPath) {
        let record = sourceFileStore.get(identityPath);
        if (record.metadataSnapshot && !isFileSnapshotFresh(record.metadataSnapshot)) {
            sourceFileStore.invalidate(identityPath);
            clearTransformedCacheIndex(identityPath);
            record = sourceFileStore.get(identityPath);
        }
        return record;
    }
    async function getOrCreateSourceFile(record) {
        let cacheKey = getRecordCacheKey(record);
        let existing = sourceFileInFlightByCacheKey.get(cacheKey);
        if (existing)
            return existing;
        let promise = (async () => {
            let startedVersion = record.invalidationVersion;
            let body = await readFileContents(record.identityPath);
            let sourceFile = record.metadata
                ? createEmittedFileFromMetadata(body, record.metadata)
                : await createSourceFile(body, record.identityPath);
            if (record.invalidationVersion === startedVersion && !record.metadata) {
                sourceFileStore.set(record.identityPath, toEmittedFileMetadata(sourceFile), getFileSnapshot(record.identityPath));
            }
            return sourceFile;
        })();
        sourceFileInFlightByCacheKey.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            if (sourceFileInFlightByCacheKey.get(cacheKey) === promise) {
                sourceFileInFlightByCacheKey.delete(cacheKey);
            }
        }
    }
    async function getOrCreateSourceFileMetadata(record) {
        if (record.metadata)
            return record.metadata;
        return toEmittedFileMetadata(await getOrCreateSourceFile(record));
    }
    async function getOrCreateTransformedFile(record, transformQuery) {
        let parsedTransforms = parseRequestTransforms(transformQuery, resolvedOptions.transforms, resolvedOptions.maxRequestTransforms);
        let cacheKey = getTransformedRecordCacheKey(cacheEpoch, record, transformQuery);
        let existing = transformedEmitInFlightByCacheKey.get(cacheKey);
        if (existing)
            return existing;
        let promise = (async () => {
            let sourceFile = await getOrCreateSourceFile(record);
            let cachedFile = await getCachedTransformedFile(cacheKey, record.identityPath, sourceFile.fingerprint);
            if (cachedFile)
                return cachedFile;
            let transformedFile = await applyTransforms(record.identityPath, sourceFile, parsedTransforms);
            if (transformedFile === null) {
                return sourceFile;
            }
            let emittedFile = await createEmittedFile(transformedFile.body, {
                extension: transformedFile.extension,
                filePath: record.identityPath,
                fingerprint: sourceFile.fingerprint,
            });
            rememberTransformedAssetMetadata(cacheKey, record.identityPath, toEmittedFileMetadata(emittedFile));
            await setCachedTransformedFile(cacheKey, record.identityPath, emittedFile);
            return emittedFile;
        })();
        transformedEmitInFlightByCacheKey.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            if (transformedEmitInFlightByCacheKey.get(cacheKey) === promise) {
                transformedEmitInFlightByCacheKey.delete(cacheKey);
            }
        }
    }
    async function createSourceFile(body, identityPath) {
        return createEmittedFile(body, {
            extension: path.extname(identityPath).toLowerCase(),
            filePath: identityPath,
            fingerprint: resolvedOptions.fingerprintAssets && resolvedOptions.buildId
                ? await generateFingerprint({
                    buildId: resolvedOptions.buildId,
                    content: body,
                })
                : null,
        });
    }
    function createEmittedFileFromMetadata(body, metadata) {
        return {
            body,
            ...metadata,
        };
    }
    async function applyTransforms(filePath, source, transforms) {
        let currentBody = source.body;
        let currentExtension = source.extension;
        let appliedTransform = false;
        for (let requestTransform of transforms) {
            let transform = resolvedOptions.transforms[requestTransform.name];
            if (!transform) {
                throw createAssetServerCompilationError(`Unknown file transform "${requestTransform.name}" requested for ${filePath}`, { code: 'TRANSFORM_FAILED' });
            }
            if (!supportsTransformExtension(transform.extensions, currentExtension)) {
                throw createAssetServerCompilationError(`File transform "${requestTransform.name}" does not support ${currentExtension} inputs for ${filePath}`, { code: 'TRANSFORM_FAILED' });
            }
            let result = await transform.transform(currentBody, {
                extension: currentExtension,
                filePath,
                param: requestTransform.param,
            });
            let normalizedResult = normalizeTransformResult(result, {
                currentExtension,
                filePath,
                transformName: requestTransform.name,
            });
            currentBody = normalizedResult.content;
            currentExtension = normalizedResult.extension;
            appliedTransform = true;
        }
        for (let globalTransform of resolvedOptions.globalTransforms) {
            if (!supportsTransformExtension(globalTransform.extensions, currentExtension))
                continue;
            let result = await globalTransform.transform(currentBody, {
                extension: currentExtension,
                filePath,
            });
            if (result === null)
                continue;
            let normalizedResult = normalizeTransformResult(result, {
                currentExtension,
                filePath,
                transformName: globalTransform.name ?? '<anonymous>',
            });
            currentBody = normalizedResult.content;
            currentExtension = normalizedResult.extension;
            appliedTransform = true;
        }
        if (!appliedTransform)
            return null;
        return { body: currentBody, extension: currentExtension };
    }
    async function getCachedTransformedFile(cacheKey, identityPath, fingerprint) {
        if (!resolvedOptions.cache)
            return null;
        let file = await resolvedOptions.cache.get(cacheKey);
        if (!file)
            return null;
        let body = new Uint8Array(await file.arrayBuffer());
        let metadata = transformedAssetMetadataByCacheKey.get(cacheKey) ??
            (await createEmittedFileMetadata(body, {
                extension: path.extname(file.name).toLowerCase(),
                filePath: identityPath,
                fingerprint,
            }));
        rememberTransformedAssetMetadata(cacheKey, identityPath, metadata);
        return {
            body,
            ...metadata,
        };
    }
    async function setCachedTransformedFile(cacheKey, filePath, emittedFile) {
        if (!resolvedOptions.cache)
            return;
        let basename = path.basename(filePath, path.extname(filePath));
        await resolvedOptions.cache.set(cacheKey, new File([Buffer.from(emittedFile.body)], `${basename}${emittedFile.extension}`, {
            type: emittedFile.contentType,
        }));
    }
    async function createEmittedFile(body, options) {
        let metadata = await createEmittedFileMetadata(body, options);
        return {
            body,
            ...metadata,
        };
    }
    function clearTransformedCacheIndex(identityPath) {
        let cacheKeys = transformedCacheKeysByIdentityPath.get(identityPath);
        if (!cacheKeys)
            return;
        for (let cacheKey of cacheKeys) {
            transformedAssetMetadataByCacheKey.delete(cacheKey);
        }
        transformedCacheKeysByIdentityPath.delete(identityPath);
    }
    function rememberTransformedAssetMetadata(cacheKey, identityPath, metadata) {
        transformedAssetMetadataByCacheKey.set(cacheKey, metadata);
        let cacheKeys = transformedCacheKeysByIdentityPath.get(identityPath) ?? new Set();
        cacheKeys.add(cacheKey);
        transformedCacheKeysByIdentityPath.set(identityPath, cacheKeys);
    }
    async function createEmittedFileMetadata(body, options) {
        let contentType = detectContentType(`file${options.extension}`) ??
            detectContentType(options.filePath) ??
            'application/octet-stream';
        return {
            contentType,
            etag: `W/"${await hashContent(body)}"`,
            extension: options.extension,
            fingerprint: options.fingerprint,
        };
    }
}
export function resolveServedFileOrThrow(filePath, args) {
    let identityPath = resolveExistingFilePath(filePath);
    if (!identityPath) {
        throw createAssetServerCompilationError(`File not found: ${filePath}`, {
            code: 'FILE_NOT_FOUND',
        });
    }
    if (!isServedFilePath(identityPath, args.extensions)) {
        throw createAssetServerCompilationError(`File type is not supported: ${identityPath}`, {
            code: 'FILE_NOT_SUPPORTED',
        });
    }
    if (!args.isAllowed(identityPath)) {
        throw createAssetServerCompilationError(`File is not allowed: ${identityPath}`, {
            code: 'FILE_NOT_ALLOWED',
        });
    }
    let stableUrlPathname = args.routes.toUrlPathname(identityPath);
    if (!stableUrlPathname) {
        throw createAssetServerCompilationError(`File ${identityPath} is outside all configured fileMap entries.`, {
            code: 'FILE_OUTSIDE_FILE_MAP',
        });
    }
    return {
        identityPath,
        stableUrlPathname,
    };
}
export function createResponseForFile(result, options) {
    if (IfNoneMatch.from(options.ifNoneMatch).matches(result.etag)) {
        return new Response(null, { status: 304, headers: { ETag: result.etag } });
    }
    return new Response(options.method === 'HEAD' ? null : Buffer.from(result.body), {
        headers: {
            'Cache-Control': options.cacheControl,
            'Content-Type': result.contentType,
            ETag: result.etag,
        },
    });
}
export function isServedFilePath(filePath, extensions) {
    return extensions.has(path.extname(filePath).toLowerCase());
}
function getRecordCacheKey(record) {
    return `${record.identityPath}\0${record.invalidationVersion}`;
}
function getTransformedRecordCacheKey(cacheEpoch, record, transformQuery) {
    return [
        encodeCacheKeyPart(cacheEpoch),
        encodeCacheKeyPart(record.identityPath),
        String(record.invalidationVersion),
        encodeCacheKeyPart(JSON.stringify(transformQuery ?? [])),
    ].join('/');
}
function getFileSnapshot(filePath) {
    try {
        let stats = fs.statSync(filePath, { bigint: true });
        if (!stats.isFile())
            return null;
        return {
            filePath,
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
function getNotModifiedFile(emittedFile, options) {
    if (!emittedFile || options.ifNoneMatch === null)
        return null;
    if (options.requestedFingerprint !== null &&
        emittedFile.fingerprint !== options.requestedFingerprint) {
        return null;
    }
    if (!IfNoneMatch.from(options.ifNoneMatch).matches(emittedFile.etag))
        return null;
    return { etag: emittedFile.etag, type: 'not-modified' };
}
function toEmittedFileMetadata(emittedFile) {
    return {
        contentType: emittedFile.contentType,
        etag: emittedFile.etag,
        extension: emittedFile.extension,
        fingerprint: emittedFile.fingerprint,
    };
}
function isFileSnapshotFresh(snapshot) {
    let current = getFileSnapshot(snapshot.filePath);
    return current != null && current.mtimeNs === snapshot.mtimeNs && current.size === snapshot.size;
}
function appendTransformQuery(href, transformQuery) {
    if (transformQuery === null)
        return href;
    let searchParams = new URLSearchParams();
    for (let transform of transformQuery) {
        searchParams.append('transform', transform);
    }
    let search = searchParams.toString();
    return search.length > 0 ? `${href}?${search}` : href;
}
function encodeCacheKeyPart(value) {
    return Buffer.from(value).toString('base64url');
}
function normalizeTransformResult(result, options) {
    if (typeof result === 'string') {
        return {
            content: new TextEncoder().encode(result),
            extension: options.currentExtension,
        };
    }
    if (result instanceof Uint8Array) {
        return {
            content: result,
            extension: options.currentExtension,
        };
    }
    if (result === null || typeof result !== 'object') {
        throw createAssetServerCompilationError(`File transform "${options.transformName}" must return a string, Uint8Array, or object for ${options.filePath}`, { code: 'TRANSFORM_FAILED' });
    }
    if (!('content' in result) ||
        (typeof result.content !== 'string' && !(result.content instanceof Uint8Array))) {
        throw createAssetServerCompilationError(`File transform "${options.transformName}" must return a string or Uint8Array content value for ${options.filePath}`, { code: 'TRANSFORM_FAILED' });
    }
    let extension = options.currentExtension;
    if ('extension' in result && result.extension !== undefined) {
        if (typeof result.extension !== 'string') {
            throw createAssetServerCompilationError(`File transform "${options.transformName}" must return a string extension for ${options.filePath}`, { code: 'TRANSFORM_FAILED' });
        }
        extension = normalizeTransformExtension(result.extension, options.filePath, options.transformName);
    }
    return {
        content: typeof result.content === 'string'
            ? new TextEncoder().encode(result.content)
            : result.content,
        extension,
    };
}
function normalizeTransformExtension(extension, filePath, transformName) {
    let normalizedExtension = extension.trim().toLowerCase();
    if (!/^\.[A-Za-z0-9_-]+$/.test(normalizedExtension)) {
        throw createAssetServerCompilationError(`File transform "${transformName}" returned an invalid extension "${extension}" for ${filePath}`, { code: 'TRANSFORM_FAILED' });
    }
    return normalizedExtension;
}
function supportsTransformExtension(extensions, currentExtension) {
    return extensions === undefined || extensions.includes(currentExtension);
}
function parseRequestTransforms(transformQuery, transforms, maxRequestTransforms) {
    if (transformQuery === null)
        return [];
    try {
        return parseAssetTransformInvocations(transformQuery, transforms, maxRequestTransforms).map((transformInvocation) => typeof transformInvocation === 'string'
            ? {
                name: transformInvocation,
                param: undefined,
            }
            : {
                name: transformInvocation[0],
                param: transformInvocation[1],
            });
    }
    catch (error) {
        throw createAssetServerCompilationError(error instanceof Error ? error.message : 'Invalid file transforms', {
            code: 'INVALID_TRANSFORM_QUERY',
        });
    }
}
function resolveExistingFilePath(filePath) {
    try {
        return normalizeFilePath(fs.realpathSync(filePath));
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
async function readFileContents(identityPath) {
    try {
        return new Uint8Array(await fsp.readFile(identityPath));
    }
    catch (error) {
        if (isNoEntityError(error)) {
            throw createAssetServerCompilationError(`File not found: ${identityPath}`, {
                cause: error,
                code: 'FILE_NOT_FOUND',
            });
        }
        throw toEmitError(error, identityPath);
    }
}
function toEmitError(error, identityPath) {
    if (isAssetServerCompilationError(error))
        return error;
    return createAssetServerCompilationError(`Failed to read file ${identityPath}. ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
        code: 'EMIT_FAILED',
    });
}
