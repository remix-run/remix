import type { HttpRequest, HttpResponse } from 'uWebSockets.js';
export interface UwsRequestOptions {
    /**
     * Overrides the host portion of the incoming request URL. By default the request URL host is
     * derived from the HTTP `Host` header.
     */
    host?: string;
    /**
     * Overrides the protocol of the incoming request URL. Defaults to `http:`.
     */
    protocol?: string;
}
export interface UwsResponseState {
    aborted: boolean;
    abortBody: (() => void) | undefined;
    controller: AbortController | undefined;
}
export declare function createUwsRequest(req: HttpRequest, res: HttpResponse, state: UwsResponseState, options?: UwsRequestOptions, method?: string): Request;
//# sourceMappingURL=uws-request.d.ts.map