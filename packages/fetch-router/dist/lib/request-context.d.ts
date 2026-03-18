import type { Router } from './router.ts';
import type { RequestMethod } from './request-methods.ts';
/**
 * Create a request context key with an optional default value.
 *
 * @param defaultValue The default value for the context key
 * @returns The new context key
 */
export declare function createContextKey<value>(defaultValue?: value): ContextKey<value>;
/**
 * A type-safe key for storing and retrieving values from {@link RequestContext}.
 */
export interface ContextKey<value> {
    /**
     * The default value for this key if no value has been set.
     */
    defaultValue?: value;
}
export type ContextValue<key> = key extends ContextKey<infer value> ? value : key extends abstract new (...args: any[]) => infer instance ? instance : never;
/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export declare class RequestContext<params extends Record<string, any> = {}> {
    #private;
    /**
     * @param request The incoming request
     */
    constructor(request: Request);
    /**
     * The headers of the request.
     */
    headers: Headers;
    /**
     * The request method. This may differ from `request.method` when using the `methodOverride`
     * middleware, which allows HTML forms to simulate RESTful API request methods like `PUT` and
     * `DELETE` using a hidden input field.
     */
    method: RequestMethod;
    /**
     * Params that were parsed from the URL.
     */
    params: params;
    /**
     * The original request that was dispatched to the router.
     *
     * Note: Various properties of the original request may not be available or may have been
     * modified by middleware. For example, the request's body may already have been consumed by the
     * `formData` middleware (available as `context.get(FormData)`), or its method may have been
     * overridden by the `methodOverride` middleware (available as `context.method`). You should
     * default to using properties of the `context` object instead of the original request.
     * However, the original request is made available in case you need it for some edge case.
     */
    request: Request;
    /**
     * Get a value from request context.
     *
     * @param key The key to read
     * @returns The value for the given key
     */
    get: <key extends object>(key: key) => ContextValue<key>;
    /**
     * Check whether a value exists in request context.
     *
     * @param key The key to check
     * @returns `true` if a value has been set for the key
     */
    has: <key extends object>(key: key) => boolean;
    /**
     * Set a value in request context.
     *
     * @param key The key to write
     * @param value The value to write
     */
    set: <key extends object>(key: key, value: ContextValue<key>) => void;
    /**
     * The router handling this request.
     */
    get router(): Router;
    set router(router: Router);
    /**
     * The URL that was matched by the route.
     */
    url: URL;
}
//# sourceMappingURL=request-context.d.ts.map