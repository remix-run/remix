import type { AnyParams, ContextEntries, ContextWithEntries, Middleware, RequestContext, RouterTypes } from '@remix-run/fetch-router';
type RequestContextWithAnyParams<context> = context extends RequestContext<any, infer entries extends ContextEntries> ? ContextWithEntries<RequestContext<AnyParams>, entries> : RequestContext<AnyParams>;
export type AsyncRequestContext = RouterTypes extends {
    context: infer context extends RequestContext<any, any>;
} ? RequestContextWithAnyParams<context> : RequestContext<AnyParams>;
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
export declare function getContext(): AsyncRequestContext;
export {};
//# sourceMappingURL=async-context.d.ts.map