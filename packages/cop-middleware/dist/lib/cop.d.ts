import type { Middleware, RequestContext } from '@remix-run/fetch-router';
/**
 * Reason reported when cross-origin protection rejects a request.
 */
export type CopFailureReason = 'cross-origin-request' | 'cross-origin-request-from-old-browser';
/**
 * Custom response handler for rejected cross-origin requests.
 */
export interface CopDenyHandler {
    /**
     * Builds the response returned when a request is denied.
     */
    (reason: CopFailureReason, context: RequestContext): Response | Promise<Response>;
}
/**
 * Configuration for the cross-origin protection middleware.
 */
export interface CopOptions {
    /**
     * Exact origins that should bypass cross-origin rejection.
     */
    trustedOrigins?: readonly string[];
    /**
     * Path patterns that should bypass protection for matching requests.
     */
    insecureBypassPatterns?: readonly string[];
    /**
     * Optional custom response handler for rejected requests.
     */
    onDeny?: CopDenyHandler;
}
/**
 * Creates middleware that rejects unsafe cross-origin requests.
 *
 * @param options Cross-origin protection options.
 * @returns Middleware that validates request origin headers.
 */
export declare function cop(options?: CopOptions): Middleware;
//# sourceMappingURL=cop.d.ts.map