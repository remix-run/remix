import type { Middleware, RequestContext } from '@remix-run/fetch-router';
type OriginMatcher = string | RegExp | ReadonlyArray<string | RegExp>;
/**
 * Return shape for a dynamic CORS origin resolver.
 */
export type CorsOriginResolverResult = '*' | string | boolean | null | undefined;
/**
 * Resolves the allowed origin for a given request origin.
 */
export interface CorsOriginResolver {
    /**
     * Resolves the allowed origin for a request with an `Origin` header.
     */
    (origin: string, context: RequestContext): CorsOriginResolverResult | Promise<CorsOriginResolverResult>;
}
/**
 * Accepted forms for configuring allowed CORS origins.
 */
export type CorsOrigin = OriginMatcher | boolean | CorsOriginResolver;
/**
 * Return shape for a dynamic allowed-headers resolver.
 */
export type CorsAllowedHeadersResolverResult = readonly string[] | null | undefined;
/**
 * Resolves the allowed request headers for a preflight request.
 */
export interface CorsAllowedHeadersResolver {
    /**
     * Resolves the request headers allowed by a preflight request.
     */
    (request: Request, context: RequestContext): CorsAllowedHeadersResolverResult | Promise<CorsAllowedHeadersResolverResult>;
}
/**
 * Options for CORS middleware.
 */
export interface CorsOptions {
    /**
     * Allowed origins. Defaults to '*'.
     *
     * - `true` reflects the request Origin
     * - `false` disables CORS headers
     * - `'*'` allows all origins
     * - `string`/`RegExp`/array allow matching origins
     * - `function` allows dynamic origin checks
     */
    origin?: CorsOrigin;
    /**
     * Allowed methods for preflight responses.
     *
     * @default ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
     */
    methods?: readonly string[];
    /**
     * Allowed request headers for preflight responses.
     *
     * Defaults to reflecting Access-Control-Request-Headers.
     */
    allowedHeaders?: readonly string[] | CorsAllowedHeadersResolver;
    /**
     * Exposed response headers for non-preflight requests.
     */
    exposedHeaders?: readonly string[];
    /**
     * Include Access-Control-Allow-Credentials: true.
     *
     * @default false
     */
    credentials?: boolean;
    /**
     * Access-Control-Max-Age value for preflight responses (seconds).
     */
    maxAge?: number;
    /**
     * Continue to downstream handlers for preflight requests.
     *
     * @default false
     */
    preflightContinue?: boolean;
    /**
     * Status code to use when short-circuiting preflight responses.
     *
     * @default 204
     */
    preflightStatusCode?: number;
    /**
     * Include Access-Control-Allow-Private-Network: true when requested.
     *
     * @default false
     */
    allowPrivateNetwork?: boolean;
}
/**
 * Middleware that adds CORS headers and handles CORS preflight requests.
 *
 * @param options CORS options
 * @returns CORS middleware
 */
export declare function cors(options?: CorsOptions): Middleware;
export {};
//# sourceMappingURL=cors.d.ts.map