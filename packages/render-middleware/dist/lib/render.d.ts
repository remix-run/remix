import { type Middleware, type RequestContext } from '@remix-run/fetch-router';
/**
 * A function that converts application data into a `Response`.
 */
export interface Renderer<input = unknown, responseInit = ResponseInit> {
    /**
     * Render input data into a response.
     *
     * @param input The value to render.
     * @param init Optional renderer-specific response options.
     * @returns A rendered response.
     */
    (input: input, init?: responseInit): Response | Promise<Response>;
}
/**
 * A renderer of any input and options shape.
 */
export type AnyRenderer = Renderer<never, never>;
/**
 * Context key used to read the current request renderer with `context.get(Renderer)`.
 * The `renderWith()` middleware also installs the renderer as `context.render`.
 */
export declare const Renderer: import("../../../fetch-router/src/lib/request-context.ts").ContextKey<AnyRenderer>;
type RendererFactory<renderer extends AnyRenderer> = (context: RequestContext<any, any>) => renderer;
/**
 * Adds a renderer to request context.
 *
 * @param createRenderer A function that creates a renderer for each request.
 * @returns Middleware that stores the renderer in request context.
 */
export declare function renderWith<const renderer extends AnyRenderer>(createRenderer: RendererFactory<renderer>): Middleware<{
    key: typeof Renderer;
    value: renderer;
    property: 'render';
}>;
export {};
//# sourceMappingURL=render.d.ts.map