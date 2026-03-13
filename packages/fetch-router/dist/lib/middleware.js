import { raceRequestAbort } from "./request-abort.js";
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
        // If it did not call next(), invoke downstream automatically
        return next();
    };
    return dispatch(0);
}
