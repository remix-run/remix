import type * as http from 'node:http';
import type * as http2 from 'node:http2';
type IncomingRequest = http.IncomingMessage | http2.Http2ServerRequest;
type ServerResponse = http.ServerResponse | http2.Http2ServerResponse;
type RequestFactory<requestOptions> = (req: IncomingRequest, res: ServerResponse, options: requestOptions | undefined) => Request;
type HeadersFactory = (req: IncomingRequest) => Headers;
export declare function createLazyRequest<requestOptions>(req: IncomingRequest, res: ServerResponse, options: requestOptions | undefined, createRequest: RequestFactory<requestOptions>, createHeaders: HeadersFactory): Request;
export declare function createLazyRequestFactory<requestOptions>(options: requestOptions | undefined, createRequest: RequestFactory<requestOptions>, createHeaders: HeadersFactory): (req: IncomingRequest, res: ServerResponse) => Request;
export {};
//# sourceMappingURL=lazy-request.d.ts.map