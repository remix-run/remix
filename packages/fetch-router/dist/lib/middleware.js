import { raceRequestAbort } from "./request-abort.js";
/**
 * Creates a reusable middleware chain while preserving its exact tuple type.
 *
 * Prefer plain inline arrays for `middleware` options on routers, controllers, and actions. Use
 * this helper when a middleware chain is stored in a variable and its exact type must be preserved,
 * such as when deriving {@link MiddlewareContext} from the chain, exporting the chain for reuse, or
 * returning it from a factory.
 *
 * @param middleware The middleware functions to run in order.
 * @returns The middleware chain with its tuple type preserved.
 */
export function createMiddleware(...middleware) {
    return middleware;
}
export function runMiddleware(middleware, context, handler) {
    let index = -1;
    let dispatch = async (i) => {
        if (i <= index)
            throw new Error('next() called multiple times');
        index = i;
        if (context.request.signal.aborted) {
            throw context.request.signal.reason;
        }
        let fn = middleware[i];
        if (!fn) {
            return await raceRequestAbort(Promise.resolve(handler(context)), context.request);
        }
        let nextPromise;
        let next = () => {
            nextPromise = dispatch(i + 1);
            return nextPromise;
        };
        let response = await raceRequestAbort(Promise.resolve(fn(context, next)), context.request);
        // If a response was returned, short-circuit the chain
        if (response instanceof Response) {
            return response;
        }
        // If the middleware called next(), use the downstream response
        if (nextPromise != null) {
            return nextPromise;
        }
        throw new Error('Middleware must return a Response or call next()');
    };
    return dispatch(0);
}
