import { type EventsContainer } from '@remix-run/interaction';
import type { ComponentHandle, FrameHandle } from './component.ts';
import { Catch, Fragment, Frame } from './component.ts';
import type { ElementProps, RemixNode } from './jsx.ts';
export type VirtualRoot = {
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
type VNodeType = typeof ROOT_VNODE | string | Function | typeof TEXT_NODE | typeof Fragment | typeof Catch | typeof Frame;
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
    _fallback?: ((error: unknown) => RemixNode) | RemixNode;
    _added?: VNode[];
    _tripped?: boolean;
};
type CommittedComponentNode = VNode & {
    type: Function;
    props: ElementProps;
    _content: VNode;
    _handle: ComponentHandle;
};
type EmptyFn = () => void;
export type Scheduler = ReturnType<typeof createScheduler>;
export declare function createScheduler(doc: Document): {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode, anchor?: Node): void;
    enqueueTasks(newTasks: EmptyFn[]): void;
    dequeue(): void;
};
declare const ROOT_VNODE: unique symbol;
export declare function createRangeRoot([start, end]: [Node, Node], options?: VirtualRootOptions): VirtualRoot;
export declare function createRoot(container: HTMLElement, options?: VirtualRootOptions): VirtualRoot;
export declare function toVNode(node: RemixNode): VNode;
export declare function diffVNodes(curr: VNode | null, next: VNode, domParent: ParentNode, frame: FrameHandle, scheduler: Scheduler, vParent: VNode, anchor?: Node, rootCursor?: Node | null): void;
export {};
