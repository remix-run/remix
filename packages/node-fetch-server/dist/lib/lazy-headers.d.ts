import type * as http from 'node:http';
import type * as http2 from 'node:http2';
type IncomingRequest = http.IncomingMessage | http2.Http2ServerRequest;
type HeadersFactory = (req: IncomingRequest) => Headers;
export declare function createLazyHeaders(req: IncomingRequest, createHeaders: HeadersFactory): Headers;
export {};
//# sourceMappingURL=lazy-headers.d.ts.map