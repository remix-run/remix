/**
 * Minimal interface for file-like objects used by `createFileResponse`.
 */
export interface FileLike {
    /** File compatibility - included for interface completeness */
    readonly name: string;
    /** Used for Content-Length header and range calculations */
    readonly size: number;
    /** Used for Content-Type header */
    readonly type: string;
    /** Used for Last-Modified header and weak ETag generation */
    readonly lastModified: number;
    /** Used for streaming the response body */
    stream(): ReadableStream<Uint8Array>;
    /** Used for strong ETag digest calculation */
    arrayBuffer(): Promise<ArrayBuffer>;
    /** Used for range requests (206 Partial Content) */
    slice(start?: number, end?: number, contentType?: string): {
        stream(): ReadableStream<Uint8Array>;
    };
}
/**
 * Custom function for computing file digests.
 *
 * @param file The file to hash
 * @returns The computed digest as a string
 *
 * @example
 * async (file) => {
 *   let buffer = await file.arrayBuffer()
 *   return customHash(buffer)
 * }
 */
export type FileDigestFunction<file extends FileLike = File> = (file: file) => Promise<string>;
/**
 * Options for creating a file response.
 */
export interface FileResponseOptions<file extends FileLike = File> {
    /**
     * Cache-Control header value. If not provided, no Cache-Control header will be set.
     *
     * @example 'public, max-age=31536000, immutable' // for hashed assets
     * @example 'public, max-age=3600' // 1 hour
     * @example 'no-cache' // always revalidate
     */
    cacheControl?: string;
    /**
     * ETag generation strategy.
     *
     * - `'weak'`: Generates weak ETags based on file size and last modified time (`W/"<size>-<mtime>"`)
     * - `'strong'`: Generates strong ETags by hashing file content (requires digest computation)
     * - `false`: Disables ETag generation
     *
     * @default 'weak'
     */
    etag?: false | 'weak' | 'strong';
    /**
     * Hash algorithm or custom digest function for strong ETags.
     *
     * - String: Web Crypto API algorithm name ('SHA-256', 'SHA-384', 'SHA-512', 'SHA-1').
     *   Note: Using strong ETags will buffer the entire file into memory before hashing.
     *   Consider using weak ETags (default) or a custom digest function for large files.
     * - Function: Custom digest computation that receives a file and returns the digest string
     *
     * Only used when `etag: 'strong'`. Ignored for weak ETags.
     *
     * @default 'SHA-256'
     * @example async (file) => await customHash(file)
     */
    digest?: AlgorithmIdentifier | FileDigestFunction<file>;
    /**
     * Whether to include `Last-Modified` headers.
     *
     * @default true
     */
    lastModified?: boolean;
    /**
     * Whether to support HTTP `Range` requests for partial content.
     *
     * When enabled, includes `Accept-Ranges` header and handles `Range` requests
     * with 206 Partial Content responses.
     *
     * Defaults to enabling ranges only for non-compressible MIME types,
     * as defined by `isCompressibleMimeType()` from `@remix-run/mime`.
     *
     * Note: Range requests and compression are mutually exclusive. When
     * `Accept-Ranges: bytes` is present in the response headers, the compression
     * middleware will not compress the response. This is why the default behavior
     * enables ranges only for non-compressible types.
     */
    acceptRanges?: boolean;
}
/**
 * Creates a file [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * with full HTTP semantics including ETags, Last-Modified, conditional requests, and Range support.
 *
 * Accepts both native `File` objects and `LazyFile` from `@remix-run/lazy-file`.
 *
 * @param file The file to send (native `File` or `LazyFile`)
 * @param request The request object
 * @param options Configuration options
 * @returns A `Response` object containing the file
 *
 * @example
 * import { createFileResponse } from '@remix-run/response/file'
 * import { openLazyFile } from '@remix-run/fs'
 *
 * let lazyFile = openLazyFile('./public/image.jpg')
 * return createFileResponse(lazyFile, request, {
 *   cacheControl: 'public, max-age=3600'
 * })
 */
export declare function createFileResponse<file extends FileLike>(file: file, request: Request, options?: FileResponseOptions<file>): Promise<Response>;
//# sourceMappingURL=file.d.ts.map