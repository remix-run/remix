import type { FrameContent, FrameHandle } from './component.ts';
import type { RemixNode } from './jsx.ts';
import { type ComponentErrorEvent } from './error-event.ts';
import { createScheduler, type Scheduler } from './scheduler.ts';
import { diffVNodes } from './reconcile.ts';
import { toVNode } from './to-vnode.ts';
import { TypedEventTarget } from './typed-event-target.ts';
import { resetStyleState } from './diff-props.ts';
import type { StyleManager } from '../style/index.ts';
/**
 * Events emitted by virtual roots.
 */
export type VirtualRootEventMap = {
    error: ComponentErrorEvent;
};
/**
 * Root controller returned by {@link createRoot} and {@link createRangeRoot}.
 */
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
    render: (element: RemixNode) => void;
    dispose: () => void;
    flush: () => void;
};
/**
 * Options for creating a virtual DOM root with {@link createRoot} or {@link createRangeRoot}.
 */
export type VirtualRootOptions = {
    frame?: FrameHandle;
    scheduler?: Scheduler;
    styleManager?: StyleManager;
    frameInit?: {
        src?: string;
        resolveFrame: (src: string, signal?: AbortSignal, target?: string) => Promise<FrameContent> | FrameContent;
        loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function;
    };
};
export { createScheduler, type Scheduler };
export { diffVNodes, toVNode };
export { resetStyleState };
/**
 * Creates a virtual root bounded by two DOM nodes.
 *
 * @param boundaries Start and end marker nodes that define the render region.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export declare function createRangeRoot(boundaries: [Node, Node], options?: VirtualRootOptions): VirtualRoot;
/**
 * Creates a virtual root for a host container element.
 *
 * @param container Host element to render into.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export declare function createRoot(container: HTMLElement, options?: VirtualRootOptions): VirtualRoot;
