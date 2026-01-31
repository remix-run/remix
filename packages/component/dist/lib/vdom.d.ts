import { TypedEventTarget, type EventsContainer } from '@remix-run/interaction';
import type { ComponentHandle, FrameHandle } from './component.ts';
import { Fragment, Frame } from './component.ts';
import type { ElementProps, RemixNode } from './jsx.ts';
export type VirtualRootEventMap = {
    error: ErrorEvent;
};
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
    render: (element: RemixNode) => void;
    remove: () => void;
    flush: () => void;
};
export type VirtualRootOptions = {
    vParent?: VNode;
    frame?: FrameHandle;
    scheduler?: Scheduler;
};
declare const TEXT_NODE: unique symbol;
type VNodeType = typeof ROOT_VNODE | string | Function | typeof TEXT_NODE | typeof Fragment | typeof Frame;
export type VNode<T extends VNodeType = VNodeType> = {
    type: T;
    props?: ElementProps;
    key?: string;
    _parent?: VNode;
    _children?: VNode[];
    _dom?: unknown;
    _events?: EventsContainer<EventTarget>;
    _controller?: AbortController;
    _svg?: boolean;
    _index?: number;
    _flags?: number;
    _text?: string;
    _handle?: ComponentHandle;
    _id?: string;
    _content?: VNode;
    _animation?: Animation;
    _exiting?: boolean;
    _exitingParent?: ParentNode;
};
type CommittedComponentNode = VNode & {
    type: Function;
    props: ElementProps;
    _content: VNode;
    _handle: ComponentHandle;
};
type EmptyFn = () => void;
export type Scheduler = ReturnType<typeof createScheduler>;
export declare function createScheduler(doc: Document, rootTarget: EventTarget): {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void;
    enqueueTasks(newTasks: EmptyFn[]): void;
    dequeue(): void;
};
declare const ROOT_VNODE: unique symbol;
export declare function createRangeRoot([start, end]: [Node, Node], options?: VirtualRootOptions): VirtualRoot;
export declare function createRoot(container: HTMLElement, options?: VirtualRootOptions): VirtualRoot;
export declare function toVNode(node: RemixNode): VNode;
export declare function diffVNodes(curr: VNode | null, next: VNode, domParent: ParentNode, frame: FrameHandle, scheduler: Scheduler, vParent: VNode, rootTarget: EventTarget, anchor?: Node, rootCursor?: Node | null): Node | null | undefined;
/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export declare function resetStyleState(): void;
export {};
