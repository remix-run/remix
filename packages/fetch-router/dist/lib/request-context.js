/**
 * Create a request context key with an optional default value.
 *
 * @param defaultValue The default value for the context key
 * @returns The new context key
 */
export function createContextKey(defaultValue) {
    return { defaultValue };
}
/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext {
    /**
     * @param request The incoming request
     */
    constructor(request) {
        this.method = request.method.toUpperCase();
        this.params = {};
        this.request = request;
        this.url = new URL(request.url);
    }
    #headers;
    /**
     * A mutable copy of the request headers.
     */
    get headers() {
        return (this.#headers ??= new Headers(this.request.headers));
    }
    set headers(headers) {
        this.#headers = headers;
    }
    /**
     * The request method. This may differ from `request.method` when using the `methodOverride`
     * middleware, which allows HTML forms to simulate RESTful API request methods like `PUT` and
     * `DELETE` using a hidden input field.
     */
    method;
    /**
     * Params that were parsed from the URL.
     */
    params;
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
    request;
    #contextMap = new Map();
    /**
     * Get a value from request context.
     *
     * @param key The key to read
     * @returns The value for the given key
     */
    get = (key) => {
        if (!this.#contextMap.has(key)) {
            let contextKey = key;
            if (contextKey.defaultValue === undefined) {
                throw new Error(`Missing default value in context for key ${key}`);
            }
            return contextKey.defaultValue;
        }
        return this.#contextMap.get(key);
    };
    /**
     * Check whether a value exists in request context.
     *
     * @param key The key to check
     * @returns `true` if a value has been set for the key
     */
    has = (key) => this.#contextMap.has(key);
    /**
     * Set a value in request context.
     *
     * @param key The key to write
     * @param value The value to write
     */
    set = (key, value) => {
        this.#contextMap.set(key, value);
    };
    #router;
    /**
     * The router handling this request.
     */
    get router() {
        if (this.#router == null) {
            throw new Error('No router found in request context.');
        }
        return this.#router;
    }
    set router(router) {
        this.#router = router;
    }
    /**
     * The URL of the current request.
     */
    url;
}
