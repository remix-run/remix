import type { ComponentHandle, Key, RemixNode } from './component.ts';
import type { ElementType, ElementProps } from './jsx.ts';
import { type EntryComponent } from './client-entries.ts';
interface VNode {
    type: ElementType;
    props: ElementProps;
    key?: Key;
    _handle?: ComponentHandle;
    _parent?: VNode;
}
export declare function createVNode(type: ElementType, props: ElementProps, key?: Key): VNode;
/**
 * Options for server-side rendering to a byte stream.
 */
export interface RenderToStreamOptions {
    /** Source URL to associate with the current frame render. */
    frameSrc?: string | URL;
    /** Source URL for the top-level frame in nested frame renders. */
    topFrameSrc?: string | URL;
    /** Error hook invoked when rendering work throws. */
    onError?: (error: unknown) => void;
    /** Callback used to resolve nested frame content during streaming SSR. */
    resolveFrame?: (src: string, target?: string, context?: ResolveFrameContext) => Promise<string | ReadableStream<Uint8Array>> | string | ReadableStream<Uint8Array>;
    /**
     * Callback used to resolve runtime module metadata for client entry modules during SSR.
     */
    resolveClientEntry?: (entryId: string, component: EntryComponent) => Promise<ResolvedClientEntry> | ResolvedClientEntry;
}
/**
 * Context passed to `resolveFrame` during server rendering.
 */
export interface ResolveFrameContext {
    /** Source URL for the frame currently being resolved. */
    currentFrameSrc: string;
    /** Source URL for the top-level frame in the current render. */
    topFrameSrc: string;
}
interface ResolvedClientEntry {
    href: string;
    exportName: string;
}
/**
 * Renders a node tree to a streaming HTML response body.
 *
 * @param node Node tree to render.
 * @param options Stream rendering options.
 * @returns A readable byte stream of HTML.
 */
export declare function renderToStream(node: RemixNode, options?: RenderToStreamOptions): ReadableStream<Uint8Array>;
/**
 * Renders a node tree to a complete HTML string.
 *
 * @param node Node tree to render.
 * @returns Rendered HTML.
 */
export declare function renderToString(node: RemixNode): Promise<string>;
export {};
