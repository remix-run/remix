import { type BrotliCompress, type Gzip, type Deflate } from 'node:zlib';
import type { BrotliOptions, ZlibOptions } from 'node:zlib';
export type Encoding = 'br' | 'gzip' | 'deflate';
export interface CompressResponseOptions {
    /**
     * Minimum size in bytes to compress (only enforced if Content-Length is present).
     * If Content-Length is absent, compression is applied regardless of this threshold.
     *
     * Default: 1024
     */
    threshold?: number;
    /**
     * Which encodings the server supports for negotiation in order of preference.
     * Supported encodings: 'br', 'gzip', 'deflate'.
     * Default: ['br', 'gzip', 'deflate']
     */
    encodings?: Encoding[];
    /**
     * node:zlib options for gzip/deflate compression.
     *
     * For SSE responses (text/event-stream), `flush: Z_SYNC_FLUSH` is automatically
     * applied unless you explicitly set a flush value.
     *
     * See: https://nodejs.org/api/zlib.html#class-options
     */
    zlib?: ZlibOptions;
    /**
     * node:zlib options for Brotli compression.
     *
     * For SSE responses (text/event-stream), `flush: BROTLI_OPERATION_FLUSH` is
     * automatically applied unless you explicitly set a flush value.
     *
     * See: https://nodejs.org/api/zlib.html#class-brotlioptions
     */
    brotli?: BrotliOptions;
}
/**
 * Compresses a Response based on the client's Accept-Encoding header.
 *
 * Compression is skipped for:
 * - Responses with no Accept-Encoding header (RFC 7231)
 * - Empty responses
 * - Already compressed responses
 * - Responses with Content-Length below threshold (default: 1024 bytes)
 * - Responses with Cache-Control: no-transform
 * - Responses advertising range support (Accept-Ranges: bytes)
 * - Partial content responses (206 status)
 *
 * When compressing, this function:
 * - Sets Content-Encoding header
 * - Removes Content-Length header
 * - Sets Accept-Ranges to 'none'
 * - Adds 'Accept-Encoding' to Vary header
 * - Converts strong ETags to weak ETags (per RFC 7232)
 *
 * @param response The response to compress
 * @param request The request (needed to check Accept-Encoding header)
 * @param options Optional compression settings
 * @returns A compressed Response or the original if no compression is suitable
 */
export declare function compressResponse(response: Response, request: Request, options?: CompressResponseOptions): Promise<Response>;
/**
 * Compresses a response stream that bridges node:zlib to Web Streams.
 * Reads from the input stream, compresses chunks through the compressor,
 * and returns a new ReadableStream with the compressed data.
 *
 * @param input The input stream to compress
 * @param compressor The zlib compressor instance to use
 * @returns A new ReadableStream with the compressed data
 */
export declare function compressStream(input: ReadableStream<Uint8Array>, compressor: Gzip | Deflate | BrotliCompress): ReadableStream<Uint8Array>;
//# sourceMappingURL=compress.d.ts.map