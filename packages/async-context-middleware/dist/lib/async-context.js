import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage();
/**
 * Middleware that stores the request context in `AsyncLocalStorage` so it is available
 * to all functions in the same async execution context.
 *
 * @returns A middleware function that stores the request context in `AsyncLocalStorage`
 */
export function asyncContext() {
    return (context, next) => storage.run(context, next);
}
/**
 * Get the request context from `AsyncLocalStorage`.
 *
 * @returns The request context
 */
export function getContext() {
    let context = storage.getStore();
    if (context == null) {
        throw new Error('No request context found. Make sure the asyncContext middleware is installed.');
    }
    return context;
}
