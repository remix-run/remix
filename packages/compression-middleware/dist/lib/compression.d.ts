import type { BrotliOptions, ZlibOptions } from 'node:zlib';
import type { Middleware } from '@remix-run/fetch-router';
type Encoding = 'br' | 'gzip' | 'deflate';
export interface CompressionOptions {
    /**
     * Minimum size in bytes to compress (only enforced if Content-Length present).
     * Default: 1024
     */
    threshold?: number;
    /**
     * Optional filter to control which responses get compressed based on media type.
     * If not provided, uses compressible media types from mime-db.
     */
    filterMediaType?: (mediaType: string) => boolean;
    /**
     * Which encodings the server supports for negotiation in order of preference.
     * Can be static or a function that returns encodings based on the response.
     *
     * Default: ['br', 'gzip', 'deflate']
     */
    encodings?: Encoding[] | ((response: Response) => Encoding[]);
    /**
     * node:zlib options for gzip/deflate compression.
     * Can be static or a function that returns options based on the response.
     *
     * See: https://nodejs.org/api/zlib.html#class-options
     */
    zlib?: ZlibOptions | ((response: Response) => ZlibOptions);
    /**
     * node:zlib options for Brotli compression.
     * Can be static or a function that returns options based on the response.
     *
     * See: https://nodejs.org/api/zlib.html#class-brotlioptions
     */
    brotli?: BrotliOptions | ((response: Response) => BrotliOptions);
}
/**
 * Creates a middleware handler that automatically compresses responses based on the
 * client's Accept-Encoding header, along with an additional Content-Type filter
 * by default to only apply compression to appropriate media types.
 *
 * @param options Optional compression settings
 * @returns A middleware handler that automatically compresses responses based on the client's Accept-Encoding header
 * @example
 * ```ts
 * let router = createRouter({
 *   middleware: [compression()],
 * })
 * ```
 */
export declare function compression(options?: CompressionOptions): Middleware;
export {};
//# sourceMappingURL=compression.d.ts.map