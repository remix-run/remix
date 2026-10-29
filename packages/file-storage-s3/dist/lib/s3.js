import { AwsClient } from 'aws4fetch';
const CONTENTS_PATTERN = /<Contents>([\s\S]*?)<\/Contents>/g;
const minPartSize = 5 * 1024 * 1024;
const defaultPartSize = 8 * 1024 * 1024;
/**
 * Creates an S3-backed implementation of `FileStorage`.
 *
 * This works with AWS S3 and S3-compatible providers (for example MinIO or LocalStack) by
 * overriding the `endpoint` option.
 *
 * `set()` streams files to S3. Files larger than `partSize` are sent with a multipart upload, so
 * only about two parts are held in memory at a time. `put()` uses the same upload path but keeps the
 * whole file in memory, because it returns a `File` with the stored contents.
 *
 * @param options Configuration for the S3 backend
 * @returns A `FileStorage` implementation backed by S3
 */
export function createS3FileStorage(options) {
    let endpoint = new URL(options.endpoint ?? `https://s3.${options.region}.amazonaws.com`);
    let forcePathStyle = options.forcePathStyle ?? options.endpoint != null;
    let partSize = options.partSize ?? defaultPartSize;
    if (!Number.isInteger(partSize) || partSize < minPartSize) {
        throw new RangeError(`partSize must be an integer of at least ${minPartSize} bytes`);
    }
    let aws = new AwsClient({
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        sessionToken: options.sessionToken,
        service: 's3',
        region: options.region,
    });
    async function s3Fetch(url, init) {
        let request = await aws.sign(url, init);
        if (options.fetch != null) {
            return options.fetch(request);
        }
        return fetch(request);
    }
    function getBucketUrl() {
        return createBucketUrl(endpoint, options.bucket, forcePathStyle);
    }
    function getObjectUrl(key) {
        return createObjectUrl(endpoint, options.bucket, forcePathStyle, key);
    }
    // Streams the file to S3 and resolves with its parts when `keepChunks` is true. Files that fit in
    // one part are sent with a single `PUT`. Larger files use a multipart upload, which holds at most
    // two parts in memory.
    async function uploadFile(key, file, keepChunks) {
        let headers = new Headers();
        if (file.type !== '') {
            headers.set('Content-Type', file.type);
        }
        headers.set('X-Amz-Meta-File-Name', encodeMetadataValue(file.name));
        headers.set('X-Amz-Meta-File-Last-Modified', String(file.lastModified));
        let kept = [];
        // Streaming sources, like a file upload read straight from a request, can have the shape of a
        // `File` without being a `Blob`, so they can only be read with `stream()`.
        let source = file;
        let parts = file instanceof Blob ? sliceParts(file, partSize) : readParts(source.stream(), partSize);
        let first = await parts.next();
        let firstPart = first.done ? new Uint8Array(0) : first.value;
        if (keepChunks)
            kept.push(firstPart);
        let second = first.done ? first : await parts.next();
        if (second.done) {
            let response = await s3Fetch(getObjectUrl(key), { method: 'PUT', headers, body: firstPart });
            await assertOk(response, `PUT "${key}"`);
            return kept;
        }
        let uploadId;
        try {
            uploadId = await createMultipartUpload(key, headers);
        }
        catch (error) {
            await parts.return();
            throw error;
        }
        let etags = [];
        let pending;
        try {
            let partNumber = 0;
            let part = firstPart;
            let lookahead = second;
            // Start uploading each part, wait for the previous part to finish, then read the next one, so
            // at most two parts are in memory at a time.
            while (true) {
                let upload = uploadPart(key, uploadId, ++partNumber, part);
                // Awaited later; this keeps a failure from being reported as unhandled in the meantime
                upload.catch(() => { });
                if (pending)
                    etags.push(await pending);
                pending = upload;
                let next = lookahead ?? (await parts.next());
                lookahead = undefined;
                if (next.done)
                    break;
                part = next.value;
                if (keepChunks)
                    kept.push(part);
            }
            etags.push(await pending);
            pending = undefined;
            await completeMultipartUpload(key, uploadId, etags);
        }
        catch (error) {
            await pending?.catch(() => { });
            await parts.return();
            await abortMultipartUpload(key, uploadId);
            throw error;
        }
        return kept;
    }
    async function createMultipartUpload(key, headers) {
        let url = getObjectUrl(key);
        url.searchParams.set('uploads', '');
        let response = await s3Fetch(url, { method: 'POST', headers });
        await assertOk(response, `CreateMultipartUpload "${key}"`);
        let uploadId = readXmlTag(await response.text(), 'UploadId');
        if (uploadId == null || uploadId === '') {
            throw new Error(`S3 request failed for CreateMultipartUpload "${key}": missing UploadId`);
        }
        return uploadId;
    }
    async function uploadPart(key, uploadId, partNumber, body) {
        let url = getObjectUrl(key);
        url.searchParams.set('partNumber', String(partNumber));
        url.searchParams.set('uploadId', uploadId);
        let response = await s3Fetch(url, { method: 'PUT', body });
        await assertOk(response, `UploadPart ${partNumber} "${key}"`);
        let etag = response.headers.get('ETag');
        if (etag == null) {
            throw new Error(`S3 request failed for UploadPart ${partNumber} "${key}": missing ETag`);
        }
        return etag;
    }
    async function completeMultipartUpload(key, uploadId, etags) {
        let url = getObjectUrl(key);
        url.searchParams.set('uploadId', uploadId);
        let body = [
            '<CompleteMultipartUpload>',
            ...etags.map((etag, index) => `<Part><PartNumber>${index + 1}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`),
            '</CompleteMultipartUpload>',
        ].join('');
        let response = await s3Fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body,
        });
        await assertOk(response, `CompleteMultipartUpload "${key}"`);
        // S3 can report a failed completion with a 200 response and an error document.
        let xml = await response.text();
        if (xml.includes('<Error>')) {
            let message = readXmlTag(xml, 'Message') ?? readXmlTag(xml, 'Code') ?? 'unknown error';
            throw new Error(`S3 request failed for CompleteMultipartUpload "${key}": ${message}`);
        }
    }
    async function abortMultipartUpload(key, uploadId) {
        let url = getObjectUrl(key);
        url.searchParams.set('uploadId', uploadId);
        try {
            await s3Fetch(url, { method: 'DELETE' });
        }
        catch {
            // Keep the original error. Incomplete uploads can also be cleaned up by a bucket lifecycle rule.
        }
    }
    async function putFile(key, file) {
        let chunks = await uploadFile(key, file, true);
        return new File(chunks, file.name, {
            lastModified: file.lastModified,
            type: file.type,
        });
    }
    async function getFileMetadata(object) {
        let response = await s3Fetch(getObjectUrl(object.key), { method: 'HEAD' });
        if (response.status === 404) {
            return {
                key: object.key,
                lastModified: object.lastModified,
                name: getDefaultFileName(object.key),
                size: object.size,
                type: '',
            };
        }
        await assertOk(response, `HEAD "${object.key}"`);
        return {
            key: object.key,
            lastModified: parseEpochMillis(response.headers.get('X-Amz-Meta-File-Last-Modified')) ??
                object.lastModified,
            name: decodeMetadataValue(response.headers.get('X-Amz-Meta-File-Name')) ??
                getDefaultFileName(object.key),
            size: parseInteger(response.headers.get('Content-Length')) ?? object.size,
            type: response.headers.get('Content-Type') ?? '',
        };
    }
    return {
        async get(key) {
            let response = await s3Fetch(getObjectUrl(key), { method: 'GET' });
            if (response.status === 404) {
                return null;
            }
            await assertOk(response, `GET "${key}"`);
            let body = await response.arrayBuffer();
            return new File([body], decodeMetadataValue(response.headers.get('X-Amz-Meta-File-Name')) ??
                getDefaultFileName(key), {
                lastModified: parseEpochMillis(response.headers.get('X-Amz-Meta-File-Last-Modified')) ??
                    parseHttpDate(response.headers.get('Last-Modified')) ??
                    0,
                type: response.headers.get('Content-Type') ?? '',
            });
        },
        async has(key) {
            let response = await s3Fetch(getObjectUrl(key), { method: 'HEAD' });
            if (response.status === 404) {
                return false;
            }
            await assertOk(response, `HEAD "${key}"`);
            return true;
        },
        async list(options) {
            let { cursor, includeMetadata = false, limit = 32, prefix } = options ?? {};
            if (limit <= 0) {
                return {
                    files: [],
                };
            }
            let url = getBucketUrl();
            url.searchParams.set('encoding-type', 'url');
            url.searchParams.set('list-type', '2');
            url.searchParams.set('max-keys', String(limit));
            if (cursor !== undefined) {
                url.searchParams.set('continuation-token', cursor);
            }
            if (prefix !== undefined) {
                url.searchParams.set('prefix', prefix);
            }
            let response = await s3Fetch(url, { method: 'GET' });
            await assertOk(response, 'LIST');
            let xml = await response.text();
            let objects = parseListedObjects(xml);
            let nextCursor = parseNextCursor(xml);
            if (!includeMetadata) {
                return {
                    cursor: nextCursor,
                    files: objects.map((object) => ({ key: object.key })),
                };
            }
            let files = await Promise.all(objects.map((object) => getFileMetadata(object)));
            return {
                cursor: nextCursor,
                files: files,
            };
        },
        put(key, file) {
            return putFile(key, file);
        },
        async remove(key) {
            let response = await s3Fetch(getObjectUrl(key), { method: 'DELETE' });
            if (response.status === 404) {
                return;
            }
            await assertOk(response, `DELETE "${key}"`);
        },
        async set(key, file) {
            await uploadFile(key, file, false);
        },
    };
}
// Reads a `Blob` in parts with `slice()`. Node.js before 24.20.0 and 26.6.0 keeps every chunk read
// through `Blob#stream()` in memory for the life of the process
// (https://github.com/nodejs/node/issues/63574), which would leak every file stored this way.
// Remove this workaround and read every file with `readParts(file.stream())` once our minimum
// supported Node.js version is >=24.20.0.
async function* sliceParts(blob, partSize) {
    for (let offset = 0; offset < blob.size; offset += partSize) {
        yield new Uint8Array(await blob.slice(offset, offset + partSize).arrayBuffer());
    }
}
// Splits a stream into parts of exactly `partSize` bytes, except the last one. Some S3-compatible
// providers, like Cloudflare R2, require every part but the last to be the same size.
async function* readParts(stream, partSize) {
    let reader = stream.getReader();
    let part = new Uint8Array(partSize);
    let offset = 0;
    let done = false;
    try {
        while (true) {
            let result = await reader.read();
            if (result.done) {
                done = true;
                break;
            }
            let chunk = result.value;
            while (chunk.length > 0) {
                let length = Math.min(chunk.length, partSize - offset);
                part.set(chunk.subarray(0, length), offset);
                offset += length;
                chunk = chunk.subarray(length);
                if (offset === partSize) {
                    yield part;
                    part = new Uint8Array(partSize);
                    offset = 0;
                }
            }
        }
        if (offset > 0)
            yield part.subarray(0, offset);
    }
    finally {
        // Cancel the source when the upload stops early, so it can discard the rest of its content
        if (!done)
            await reader.cancel().catch(() => { });
    }
}
function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function createBucketUrl(endpoint, bucket, forcePathStyle) {
    let url = new URL(endpoint.toString());
    if (forcePathStyle) {
        url.pathname = joinPath(endpoint.pathname, encodeURIComponent(bucket));
    }
    else {
        url.hostname = `${bucket}.${endpoint.hostname}`;
        url.pathname = joinPath(endpoint.pathname);
    }
    return url;
}
function createObjectUrl(endpoint, bucket, forcePathStyle, key) {
    let url = new URL(endpoint.toString());
    if (forcePathStyle) {
        url.pathname = joinPath(endpoint.pathname, encodeURIComponent(bucket), encodeS3Key(key));
    }
    else {
        url.hostname = `${bucket}.${endpoint.hostname}`;
        url.pathname = joinPath(endpoint.pathname, encodeS3Key(key));
    }
    return url;
}
function encodeS3Key(key) {
    if (key === '') {
        throw new TypeError('Invalid S3 object key: keys must not be empty');
    }
    return key
        .split('/')
        .map((segment) => {
        if (segment === '.' || segment === '..') {
            throw new TypeError('Invalid S3 object key: period-only path segments are not supported');
        }
        return encodeURIComponent(segment);
    })
        .join('/');
}
function encodeMetadataValue(value) {
    return encodeURIComponent(value);
}
function decodeMetadataValue(value) {
    if (value == null || value === '') {
        return undefined;
    }
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function getDefaultFileName(key) {
    let lastSlashIndex = key.lastIndexOf('/');
    let fileName = lastSlashIndex >= 0 ? key.slice(lastSlashIndex + 1) : key;
    return fileName === '' ? key : fileName;
}
function parseListedObjects(xml) {
    CONTENTS_PATTERN.lastIndex = 0;
    let objects = [];
    for (let match of xml.matchAll(CONTENTS_PATTERN)) {
        let entry = match[1] ?? '';
        let encodedKey = readXmlTag(entry, 'Key');
        if (encodedKey == null) {
            continue;
        }
        let key = decodeS3Key(encodedKey);
        let size = parseInteger(readXmlTag(entry, 'Size')) ?? 0;
        let lastModified = parseHttpDate(readXmlTag(entry, 'LastModified')) ?? 0;
        objects.push({
            key,
            lastModified,
            size,
        });
    }
    return objects;
}
function parseNextCursor(xml) {
    if (readXmlTag(xml, 'IsTruncated') !== 'true') {
        return undefined;
    }
    return readXmlTag(xml, 'NextContinuationToken');
}
function decodeS3Key(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function readXmlTag(xml, tagName) {
    let pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
    let match = xml.match(pattern);
    if (match == null || match[1] == null) {
        return undefined;
    }
    return decodeXmlEntities(match[1]);
}
function decodeXmlEntities(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}
function parseInteger(value) {
    if (value == null || value === '') {
        return undefined;
    }
    let parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function parseEpochMillis(value) {
    let parsed = parseInteger(value);
    return parsed != null ? parsed : undefined;
}
function parseHttpDate(value) {
    if (value == null || value === '') {
        return undefined;
    }
    let parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function joinPath(basePath, ...parts) {
    let normalizedBasePath = basePath.replace(/\/+$/g, '');
    let normalizedParts = parts
        .filter((part) => part != null && part !== '')
        .map((part) => part.replace(/^\/+|\/+$/g, ''));
    let joined = [normalizedBasePath, ...normalizedParts].filter((part) => part !== '').join('/');
    if (joined === '') {
        return '/';
    }
    return joined.startsWith('/') ? joined : `/${joined}`;
}
async function assertOk(response, operation) {
    if (response.ok) {
        return;
    }
    let message = `${response.status} ${response.statusText}`;
    try {
        let body = await response.text();
        let s3Message = readXmlTag(body, 'Message');
        if (s3Message != null && s3Message !== '') {
            message = `${message} (${s3Message})`;
        }
    }
    catch {
        // Ignore body parse errors and keep the status-only message.
    }
    throw new Error(`S3 request failed for ${operation}: ${message}`);
}
