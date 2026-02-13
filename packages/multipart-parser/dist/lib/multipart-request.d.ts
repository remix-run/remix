import type { MultipartParserOptions, MultipartPart } from './multipart.ts';
/**
 * Extracts the boundary string from a `multipart/*` content type.
 *
 * @param contentType The `Content-Type` header value from the request
 * @returns The boundary string if found, or null if not present
 */
export declare function getMultipartBoundary(contentType: string): string | null;
/**
 * Returns true if the given request contains multipart data.
 *
 * @param request The `Request` object to check
 * @returns `true` if the request is a multipart request, `false` otherwise
 */
export declare function isMultipartRequest(request: Request): boolean;
/**
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and yield each part as
 * a `MultipartPart` object. Useful in HTTP server contexts for handling incoming `multipart/*` requests.
 *
 * @param request The `Request` object containing multipart data
 * @param options Optional parser options, such as `maxHeaderSize` and `maxFileSize`
 * @returns An async generator yielding `MultipartPart` objects
 */
export declare function parseMultipartRequest(request: Request, options?: MultipartParserOptions): AsyncGenerator<MultipartPart, void, unknown>;
//# sourceMappingURL=multipart-request.d.ts.map