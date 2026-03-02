import type { Middleware } from '@remix-run/fetch-router';
import { type FileResponseOptions } from '@remix-run/response/file';
/**
 * Function that determines if HTTP Range requests should be supported for a given file.
 *
 * @param file The File object being served
 * @returns true if range requests should be supported
 */
export type AcceptRangesFunction = (file: File) => boolean;
/**
 * Options for the `staticFiles` middleware.
 */
export interface StaticFilesOptions extends Omit<FileResponseOptions, 'acceptRanges'> {
    /**
     * Filter function to determine which files should be served.
     *
     * @param path The relative path being requested
     * @returns Whether to serve the file
     */
    filter?: (path: string) => boolean;
    /**
     * Whether to support HTTP Range requests for partial content.
     *
     * Can be a boolean or a function that receives the file.
     * When enabled, includes Accept-Ranges header and handles Range requests
     * with 206 Partial Content responses.
     *
     * Defaults to enabling ranges only for non-compressible MIME types,
     * as defined by `isCompressibleMimeType()` from `@remix-run/mime`.
     *
     * Note: Range requests and compression are mutually exclusive. When
     * `Accept-Ranges: bytes` is present in the response headers, the compression
     * middleware will not compress the response. This is why the default behavior
     * enables ranges only for non-compressible types.
     *
     * @example
     * // Force range request support for all files
     * acceptRanges: true
     *
     * @example
     * // Enable ranges for videos only
     * acceptRanges: (file) => file.type.startsWith('video/')
     */
    acceptRanges?: boolean | AcceptRangesFunction;
    /**
     * Files to try and serve as the index file when the request path targets a directory.
     *
     * - `true`: Use default index files `['index.html', 'index.htm']`
     * - `false`: Disable index file serving
     * - `string[]`: Custom list of index files to try in order
     *
     * @default true
     */
    index?: boolean | string[];
    /**
     * Whether to return an HTML page listing the files in a directory when the request path
     * targets a directory. If both this and `index` are set, `index` takes precedence.
     *
     * @default false
     */
    listFiles?: boolean;
}
/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * Uses the URL pathname to resolve files, removing the leading slash to make it a relative path.
 * The middleware always falls through to the handler if the file is not found or an error occurs.
 *
 * @param root The root directory to serve files from (absolute or relative to cwd)
 * @param options Configuration for file responses
 * @returns The static files middleware
 */
export declare function staticFiles(root: string, options?: StaticFilesOptions): Middleware;
//# sourceMappingURL=static.d.ts.map