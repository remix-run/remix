import type { ComponentHandle, Handle, Key, RemixNode, RenderFn } from '../runtime/component.ts';
import type { ElementType, ElementProps, Props } from '../runtime/jsx.ts';
import { type EntryComponent } from '../runtime/client-entries.ts';
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
    /** Signal that cancels pending server rendering work. */
    signal?: AbortSignal;
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
    /** Browser module hrefs to begin preloading before hydrating this entry. */
    preloads?: readonly string[];
    importMap?: ImportMapData;
}
/** Import map data accepted by the server renderer. */
export interface ImportMapData {
    /** Top-level module specifier mappings. */
    imports?: ImportMapImports;
    /** Module specifier mappings scoped by URL. */
    scopes?: Record<string, ImportMapImports>;
    /** Subresource integrity metadata keyed by module URL. */
    integrity?: Record<string, string>;
}
type ImportMapAddress = string | null;
type ImportMapImports = Record<string, ImportMapAddress>;
export type ImportMapProps = Omit<Props<'script'>, 'children' | 'innerHTML' | 'integrity' | 'src' | 'type'> & {
    /** Initial import map entries to render and merge with resolved client entries. */
    value: ImportMapData;
};
/**
 * Renders the document import map and merges maps from server-resolved client entries.
 *
 * @param handle Server component handle containing the initial import map and script attributes.
 * @returns This component is handled directly by the server renderer.
 */
export declare function ImportMap(handle: Handle<ImportMapProps>): RenderFn;
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
