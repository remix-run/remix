import type { Middleware, RequestContext } from '@remix-run/fetch-router';
/**
 * Middleware that stores the request context in `AsyncLocalStorage` so it is available
 * to all functions in the same async execution context.
 *
 * @returns A middleware function that stores the request context in `AsyncLocalStorage`
 */
export declare function asyncContext(): Middleware;
/**
 * Get the request context from `AsyncLocalStorage`.
 *
 * @returns The request context
 */
export declare function getContext(): RequestContext;
//# sourceMappingURL=async-context.d.ts.map