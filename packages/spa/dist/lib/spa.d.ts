import type { Middleware, RequestContext } from '@remix-run/fetch-router';
import { type Renderer } from '@remix-run/render-middleware';
import { type AppRuntime, type RemixNode } from '@remix-run/ui';
/** Creates a response that the SPA runtime can render. */
export interface Render {
    /**
     * Creates a renderable route response.
     *
     * @param node Node to render.
     * @param init Optional response status and headers.
     * @returns A response understood by the SPA runtime.
     */
    (node: RemixNode, init?: ResponseInit): Response;
}
/** Transforms a route node before the SPA runtime renders it. */
export interface RenderTransform {
    /**
     * Transforms a node using the active request context.
     *
     * @param node Node returned by the route.
     * @param context Active request context.
     * @returns The node to render.
     */
    (node: RemixNode, context: RequestContext): RemixNode;
}
/** Minimal router contract used by {@link run}. */
export interface Router {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}
/** Client runtime returned by {@link run}. */
export type Runtime = Omit<AppRuntime, 'ready'> & {
    /** Resolves after the client runtime starts and the initial route renders. */
    ready(): Promise<void>;
};
/** Options for starting a client-rendered Remix application. */
export interface RunOptions {
    /** Remix node to display while the initial route loads. */
    fallback?: RemixNode;
}
type RenderMiddleware = Middleware<{
    key: typeof Renderer;
    value: Render;
    property: 'render';
}>;
/**
 * Creates middleware that exposes `context.render()` for SPA route responses.
 *
 * @param transform Optional transform that wraps or replaces route nodes.
 * @returns Middleware that installs the SPA renderer on request context.
 */
export declare function render(transform?: RenderTransform): RenderMiddleware;
/**
 * Starts a client-rendered Remix application for the current document.
 *
 * The current URL and subsequent same-origin navigations are dispatched through `router`. Route
 * handlers return responses created by the {@link render} middleware, and their associated nodes
 * are rendered into the document's top frame.
 *
 * @param router Router that resolves browser requests to SPA route responses.
 * @param options Options for the initial render.
 * @returns The running application runtime.
 */
export declare function run(router: Router, options?: RunOptions): Runtime;
export {};
//# sourceMappingURL=spa.d.ts.map