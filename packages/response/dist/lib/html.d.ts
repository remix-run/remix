import { type SafeHtml } from '@remix-run/html-template';
type HtmlBody = string | SafeHtml | Blob | BufferSource | ReadableStream<Uint8Array>;
/**
 * Creates an HTML [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * that ensures the response has a valid DOCTYPE and appropriate `Content-Type` header.
 *
 * @param body The body of the response
 * @param init The `ResponseInit` object for the response
 * @returns A `Response` object with a HTML body and the appropriate `Content-Type` header
 */
export declare function createHtmlResponse(body: HtmlBody, init?: ResponseInit): Response;
export {};
//# sourceMappingURL=html.d.ts.map