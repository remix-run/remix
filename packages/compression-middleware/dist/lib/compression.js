import { compressResponse } from '@remix-run/response/compress';
import { isCompressibleMimeType } from '@remix-run/mime';
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
export function compression(options) {
    return async (context, next) => {
        let response = await next();
        let contentTypeHeader = response.headers.get('Content-Type');
        if (!contentTypeHeader) {
            return response;
        }
        let mediaType = contentTypeHeader.split(';')[0].trim();
        if (!mediaType) {
            return response;
        }
        let filterMediaType = options?.filterMediaType ?? isCompressibleMimeType;
        if (!filterMediaType(mediaType)) {
            return response;
        }
        let compressOptions = {
            threshold: options?.threshold,
            encodings: options?.encodings
                ? typeof options.encodings === 'function'
                    ? options.encodings(response)
                    : options.encodings
                : undefined,
            zlib: options?.zlib
                ? typeof options.zlib === 'function'
                    ? options.zlib(response)
                    : options.zlib
                : undefined,
            brotli: options?.brotli
                ? typeof options.brotli === 'function'
                    ? options.brotli(response)
                    : options.brotli
                : undefined,
        };
        return compressResponse(response, context.request, compressOptions);
    };
}
