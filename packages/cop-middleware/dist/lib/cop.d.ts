import type { Middleware, RequestContext } from '@remix-run/fetch-router';
export type CopFailureReason = 'cross-origin-request' | 'cross-origin-request-from-old-browser';
export interface CopDenyHandler {
    (reason: CopFailureReason, context: RequestContext): Response | Promise<Response>;
}
export interface CopOptions {
    trustedOrigins?: readonly string[];
    insecureBypassPatterns?: readonly string[];
    onDeny?: CopDenyHandler;
}
export declare function cop(options?: CopOptions): Middleware;
//# sourceMappingURL=cop.d.ts.map