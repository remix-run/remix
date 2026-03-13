import type { ComponentHandle, Key, RemixNode } from './component.ts';
import type { ElementType, ElementProps } from './jsx.ts';
interface VNode {
    type: ElementType;
    props: ElementProps;
    key?: Key;
    _handle?: ComponentHandle;
    _parent?: VNode;
}
export declare function createVNode(type: ElementType, props: ElementProps, key?: Key): VNode;
export interface RenderToStreamOptions {
    frameSrc?: string | URL;
    topFrameSrc?: string | URL;
    onError?: (error: unknown) => void;
    resolveFrame?: (src: string, target?: string, context?: ResolveFrameContext) => Promise<string | ReadableStream<Uint8Array>> | string | ReadableStream<Uint8Array>;
}
export interface ResolveFrameContext {
    currentFrameSrc: string;
    topFrameSrc: string;
}
export declare function renderToStream(node: RemixNode, options?: RenderToStreamOptions): ReadableStream<Uint8Array>;
export declare function renderToString(node: RemixNode): Promise<string>;
export {};
