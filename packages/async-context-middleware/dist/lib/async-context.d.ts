import type { Middleware, RequestContext } from '@remix-run/fetch-router';
/**
 * Module-augmentation hook for narrowing {@link AsyncRequestContext} to the
 * specific `RequestContext` shape your app installs into the
 * {@link asyncContext} middleware. Augment with a `requestContext` property in
 * your project's types entry to opt in.
 *
 * @example
 * ```ts
 * declare module '@remix-run/async-context-middleware' {
 *   interface AsyncContextTypes {
 *     requestContext: WithAuth<MyRequestContext>
 *   }
 * }
 * ```
 */
export interface AsyncContextTypes {
}
/**
 * Resolved type for the request context returned by {@link getContext}. By
 * default this is the framework's generic `RequestContext`; augment
 * {@link AsyncContextTypes} with a `requestContext` field in your project to
 * narrow it to your app's specific context shape.
 */
export type AsyncRequestContext = AsyncContextTypes extends {
    requestContext: infer context extends RequestContext<any, any>;
} ? context : RequestContext;
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
//# sourceMappingURL=async-context.d.ts.map