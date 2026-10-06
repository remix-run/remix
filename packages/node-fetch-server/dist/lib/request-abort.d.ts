import type * as http from 'node:http';
import type * as http2 from 'node:http2';
export interface RequestLifecycle {
    readonly signal: AbortSignal;
    abort(reason?: unknown): void;
    finish(): void;
}
export declare function createRequestLifecycle(): RequestLifecycle;
export declare function observeResponseForRequestLifecycle(res: http.ServerResponse | http2.Http2ServerResponse, lifecycle: RequestLifecycle): void;
export declare function isRequestAlreadyAborted(req: http.IncomingMessage | http2.Http2ServerRequest): boolean;
export declare function createRequestAbortError(): DOMException;
export declare function markRequestAbortReason(error: unknown): void;
export declare function isRequestAbortReason(error: unknown): boolean;
//# sourceMappingURL=request-abort.d.ts.map