import type { MultipartParserOptions } from '../multipart.ts';
import type { MultipartPart } from './multipart.ts';
/**
 * Parse a multipart [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and
 * yield each part as a {@link MultipartPart} as soon as its headers arrive. Part content is
 * streamed from the request body as you read it, so large uploads are never buffered in memory.
 *
 * Read each part's content before continuing to the next part. When you continue, the parser
 * waits for a read you started to finish and discards any content you didn't read.
 *
 * @param request The `Request` object containing multipart data
 * @param options Optional parser options, such as `maxHeaderSize`, `maxFileSize`, `maxParts`,
 * and `maxTotalSize`
 * @yields {@link MultipartPart} objects as their headers are parsed
 * @returns An async generator yielding {@link MultipartPart} objects
 */
export declare function parseMultipartRequest(request: Request, options?: MultipartParserOptions): AsyncGenerator<MultipartPart, void, unknown>;
//# sourceMappingURL=multipart-request.d.ts.map