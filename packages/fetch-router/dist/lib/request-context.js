import { createSession } from '@remix-run/session';
import { AppStorage } from "./app-storage.js";
import { RequestBodyMethods, } from "./request-methods.js";
/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext {
    /**
     * @param request The incoming request
     */
    constructor(request) {
        this.headers = new Headers(request.headers);
        this.method = request.method.toUpperCase();
        this.params = {};
        this.request = request;
        this.storage = new AppStorage();
        this.url = new URL(request.url);
    }
    /**
     * A map of files that were uploaded in the request.
     *
     * Note: For requests without a body (e.g. `GET` or `HEAD`), this map will be empty.
     */
    get files() {
        let files = new Map();
        if (this.#formData != null) {
            for (let [key, value] of this.#formData.entries()) {
                if (value instanceof File) {
                    files.set(key, value);
                }
            }
        }
        return files;
    }
    /**
     * Parsed [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) from the
     * request body.
     *
     * Note: This is only available for requests with a body (not `GET` or `HEAD`).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
     */
    get formData() {
        if (this.#formData == null && RequestBodyMethods.includes(this.method)) {
            this.#formData = new FormData();
        }
        return this.#formData;
    }
    set formData(value) {
        this.#formData = value;
    }
    #formData;
    /**
     * The headers of the request.
     */
    headers;
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
     * modified by middleware. For example, the request's body may already have been consumed by
     * the `formData` middleware (available as `context.formData`), or its method may have been
     * overridden by the `methodOverride` middleware (available as `context.method`). You should
     * always default to using properties of the `context` object instead of the original request.
     * However, the original request is made available in case you need it for some edge case.
     */
    request;
    /**
     * The current session.
     */
    get session() {
        if (this.#session == null) {
            console.warn("Session isn't started yet, so session data won't be saved. Use the session() middleware to start the session.");
            this.#session = createSession();
        }
        return this.#session;
    }
    set session(value) {
        this.#session = value;
    }
    #session;
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
     * Whether the session has been started.
     */
    get sessionStarted() {
        return this.#session != null;
    }
    /**
     * Shared application-specific storage.
     */
    storage;
    /**
     * The URL that was matched by the route.
     */
    url;
}
