import { createContextKey } from '@remix-run/fetch-router';
/**
 * Context key used to read the current request renderer with `context.get(Renderer)`.
 * The `renderWith()` middleware also installs the renderer as `context.render`.
 */
export const Renderer = createContextKey();
/**
 * Adds a renderer to request context.
 *
 * @param createRenderer A function that creates a renderer for each request.
 * @returns Middleware that stores the renderer in request context.
 */
export function renderWith(createRenderer) {
    return (context, next) => {
        context.set(Renderer, createRenderer(context), { property: 'render' });
        return next();
    };
}
