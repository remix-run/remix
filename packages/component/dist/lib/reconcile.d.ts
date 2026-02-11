import type { ComponentHandle, FrameHandle } from './component.ts';
import type { ComponentNode, VNode } from './vnode.ts';
import type { Scheduler } from './scheduler.ts';
export declare function diffVNodes(curr: VNode | null, next: VNode, domParent: ParentNode, frame: FrameHandle, scheduler: Scheduler, vParent: VNode, rootTarget: EventTarget, anchor?: Node, rootCursor?: Node | null): Node | null | undefined;
export declare function renderComponent(handle: ComponentHandle, currContent: VNode | null, next: ComponentNode, domParent: ParentNode, frame: FrameHandle, scheduler: Scheduler, rootTarget: EventTarget, vParent?: VNode, anchor?: Node, cursor?: Node | null): Node | null | undefined;
export declare function remove(node: VNode, domParent: ParentNode, scheduler: Scheduler): void;
export declare function findFirstDomAnchor(node: VNode | null | undefined): Node | null;
export declare function findLastDomAnchor(node: VNode | null | undefined): Node | null;
export declare function findNextSiblingDomAnchor(curr: VNode, vParent?: VNode): Node | null;
