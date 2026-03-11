import type { FrameHandle } from './component.ts';
import { type Scheduler } from './scheduler.ts';
import type { StyleManager } from './style/index.ts';
import { TypedEventTarget } from './typed-event-target.ts';
import type { VNode } from './vnode.ts';
import type { RemixNode } from './jsx.ts';
export type VirtualRootEventMap = {
    error: ErrorEvent;
};
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
    render: (element: RemixNode) => void;
    dispose: () => void;
    flush: () => void;
};
type CreateVirtualRootInit = {
    container: ParentNode;
    frame?: FrameHandle;
    createFrame?: (scheduler: Scheduler, styleManager: StyleManager) => FrameHandle;
    scheduler?: Scheduler;
    styleManager?: StyleManager;
    anchor?: Node;
    hydrationCursor?: Node | null;
    nextHydrationCursor?: Node | null;
    createParentVNode: () => VNode;
};
export declare function createVirtualRoot(init: CreateVirtualRootInit): VirtualRoot;
export {};
