import type { FrameContent, FrameHandle } from './component.ts';
import { resetStyleState } from './diff-props.ts';
import type { Scheduler } from './scheduler.ts';
import { type VirtualRoot } from './virtual-root.ts';
import type { StyleManager } from './style/index.ts';
export type VirtualRootOptions = {
    frame?: FrameHandle;
    scheduler?: Scheduler;
    styleManager?: StyleManager;
    frameInit?: {
        src?: string;
        resolveFrame: (src: string, signal?: AbortSignal) => Promise<FrameContent> | FrameContent;
        loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function;
    };
};
export { createScheduler, type Scheduler } from './scheduler.ts';
export { diffVNodes } from './reconcile.ts';
export { toVNode } from './to-vnode.ts';
export type { VirtualRoot, VirtualRootEventMap } from './virtual-root.ts';
export { resetStyleState };
export declare function createRangeRoot([start, end]: [Node, Node], options?: VirtualRootOptions): VirtualRoot;
export declare function createRoot(container: HTMLElement, options?: VirtualRootOptions): VirtualRoot;
