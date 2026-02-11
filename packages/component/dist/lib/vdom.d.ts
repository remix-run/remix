import { TypedEventTarget } from '@remix-run/interaction';
import type { FrameHandle } from './component.ts';
import type { RemixNode } from './jsx.ts';
import { createScheduler, type Scheduler } from './scheduler.ts';
import { diffVNodes } from './reconcile.ts';
import { toVNode } from './to-vnode.ts';
import { resetStyleState } from './diff-props.ts';
export type VirtualRootEventMap = {
    error: ErrorEvent;
};
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
    render: (element: RemixNode) => void;
    remove: () => void;
    flush: () => void;
};
export type VirtualRootOptions = {
    frame?: FrameHandle;
    scheduler?: Scheduler;
};
export { createScheduler, type Scheduler };
export { diffVNodes, toVNode };
export { resetStyleState };
export declare function createRangeRoot([start, end]: [Node, Node], options?: VirtualRootOptions): VirtualRoot;
export declare function createRoot(container: HTMLElement, options?: VirtualRootOptions): VirtualRoot;
