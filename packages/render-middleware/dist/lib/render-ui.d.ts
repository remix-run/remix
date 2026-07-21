import type { AssetServer } from '@remix-run/assets';
import type { Middleware } from '@remix-run/fetch-router';
import { renderToStream } from '@remix-run/ui/server';
import { type Renderer } from './render.ts';
type RemixNode = Parameters<typeof renderToStream>[0];
/** Options for the standard Remix UI renderer. */
export interface RenderOptions {
    /** Asset server used to turn source-based client entry IDs into browser module URLs. */
    assets?: Pick<AssetServer, 'getHref'>;
    /** Error hook invoked when server rendering fails. */
    onError?: (error: unknown) => void;
}
/** Renders a Remix UI node as an HTML response. */
export type RenderFunction = (node: RemixNode, init?: ResponseInit) => Response;
/**
 * Adds the standard Remix UI renderer to request context.
 *
 * @param options Rendering integration options.
 * @returns Middleware that installs `context.render(node, init)` for the current request.
 */
export declare function render(options?: RenderOptions): Middleware<{
    key: typeof Renderer;
    value: RenderFunction;
    property: 'render';
}>;
export {};
//# sourceMappingURL=render-ui.d.ts.map