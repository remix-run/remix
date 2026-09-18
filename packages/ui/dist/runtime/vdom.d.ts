import type { FrameHandle } from './component.ts';
import type { RemixNode } from './jsx.ts';
import { type ResolveFrame } from './frame.ts';
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
    /** A component render or queued task failed. */
    error: ComponentErrorEvent;
};
/**
 * Root controller returned by {@link createRoot} and {@link createRangeRoot}.
 */
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
    /**
     * Renders a tree, reusing existing DOM and component instances where possible.
     * The first render hydrates existing container or range content.
     *
     * @param element Tree to render, or `null` to remove the current tree.
     */
    render: (element: RemixNode) => void;
    /** Renders the most recently supplied tree again, or does nothing before the first render. */
    reconcile: () => void;
    /**
     * Removes the rendered tree and releases root listeners and component resources.
     * Host removal can remain pending while mixin teardown callbacks finish.
     */
    dispose: () => void;
    /** Synchronously drains pending DOM work and tasks without waiting for asynchronous work. */
    flush: () => void;
};
/**
 * Options for creating a virtual DOM root with {@link createRoot} or {@link createRangeRoot}.
 */
export type VirtualRootOptions = {
    /** Existing frame runtime to share with this root instead of creating one from `frameInit`. */
    frame?: FrameHandle;
    /** Scheduler to share with related roots (defaults to a new scheduler). */
    scheduler?: Scheduler;
    /** Style manager used to adopt server styles and manage generated CSS. */
    styleManager?: StyleManager;
    /** Frame resolution for standalone roots that render `<Frame>` without calling `run()`. */
    frameInit?: {
        /** Source URL for the root's frame context (defaults to `'/'`). */
        src?: string;
        /** Resolves content for frames rendered inside this root. */
        resolveFrame: ResolveFrame;
        /** Loads client entries encountered in resolved frame content. */
        loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function;
    };
};
export { createScheduler, type Scheduler };
export { diffVNodes, toVNode };
export { resetStyleState };
/**
 * Creates a virtual root bounded by two DOM nodes.
 *
 * @param boundaries Start and end nodes sharing a parent. Only the content between them is owned.
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
