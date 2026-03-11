import type { VNode } from './vnode.ts';
export declare function setActiveSchedulerUpdateParents(parents: ParentNode[] | undefined): void;
export declare function shouldDispatchInlineMixinLifecycle(node: Node): boolean;
export declare function findFirstDomAnchor(node: VNode | null | undefined): Node | null;
export declare function findLastDomAnchor(node: VNode | null | undefined): Node | null;
export declare function findNextSiblingDomAnchor(curr: VNode, vParent?: VNode): Node | null;
export declare function domRangeContainsNode(first: Node, last: Node, node: Node): boolean;
export declare function moveDomRange(domParent: ParentNode, first: Node, last: Node, before: Node | null): void;
