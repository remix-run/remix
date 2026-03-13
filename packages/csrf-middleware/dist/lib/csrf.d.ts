import type { Middleware, RequestContext, RequestMethod } from '@remix-run/fetch-router';
type OriginMatcher = string | RegExp | ReadonlyArray<string | RegExp>;
/**
 * Return shape for a dynamic CSRF origin resolver.
 */
export type CsrfOriginResolverResult = boolean | null | undefined;
/**
 * Resolves whether an unsafe cross-origin request should be allowed.
 */
export interface CsrfOriginResolver {
    /**
     * Resolves whether an unsafe request origin should be trusted.
     */
    (origin: string, context: RequestContext): CsrfOriginResolverResult | Promise<CsrfOriginResolverResult>;
}
/**
 * Accepted forms for configuring allowed CSRF origins.
 */
export type CsrfOrigin = OriginMatcher | CsrfOriginResolver;
/**
 * Return shape for a dynamic CSRF token resolver.
 */
export type CsrfTokenResolverResult = string | null | undefined;
/**
 * Resolves the submitted CSRF token for a request.
 */
export interface CsrfTokenResolver {
    /**
     * Resolves the submitted CSRF token for the current request.
     */
    (context: RequestContext): CsrfTokenResolverResult | Promise<CsrfTokenResolverResult>;
}
/**
 * The reason a CSRF request was rejected.
 */
export type CsrfFailureReason = 'invalid-origin' | 'missing-token' | 'invalid-token';
/**
 * Options for the CSRF middleware.
 */
export interface CsrfOptions {
    /**
     * Session key used to store the server-generated CSRF token.
     *
     * @default '_csrf'
     */
    tokenKey?: string;
    /**
     * Form field name to read CSRF tokens from.
     *
     * @default '_csrf'
     */
    fieldName?: string;
    /**
     * Header names checked (in order) for CSRF tokens.
     *
     * @default ['x-csrf-token', 'x-xsrf-token', 'csrf-token']
     */
    headerNames?: readonly string[];
    /**
     * Methods that do not require CSRF validation.
     *
     * @default ['GET', 'HEAD', 'OPTIONS']
     */
    safeMethods?: readonly RequestMethod[];
    /**
     * Allowed cross-origin origins for unsafe requests.
     *
     * When omitted, requests are validated as same-origin.
     */
    origin?: CsrfOrigin;
    /**
     * Allow requests without Origin/Referer headers.
     *
     * @default true
     */
    allowMissingOrigin?: boolean;
    /**
     * Custom function for extracting the submitted token.
     */
    value?: CsrfTokenResolver;
    /**
     * Optional custom error response for rejected requests.
     */
    onError?: (reason: CsrfFailureReason, context: RequestContext) => Response | Promise<Response>;
}
/**
 * Session-backed CSRF protection middleware.
 *
 * This middleware requires the session middleware to run before it.
 *
 * @param options CSRF options
 * @returns CSRF middleware
 */
export declare function csrf(options?: CsrfOptions): Middleware;
/**
 * Gets the CSRF token from the session. Creates one if missing.
 *
 * @param context Request context with a started session
 * @param tokenKey Session key that stores the token
 * @returns The active CSRF token
 */
export declare function getCsrfToken(context: RequestContext, tokenKey?: string): string;
export {};
//# sourceMappingURL=csrf.d.ts.map