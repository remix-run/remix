import type { CommittedComponentNode, MountingComponentNode, ReconcileContext, VNodeInput, VNodeParent, CommittedVNode } from './vnode.ts';
type HydrationCursor = {
    current: Node | null | undefined;
};
export declare function diffVNodes(curr: CommittedVNode | null, next: VNodeInput, domParent: ParentNode, vParent: VNodeParent, context: ReconcileContext, anchor?: Node, cursor?: HydrationCursor): CommittedVNode;
export declare function renderComponent(currContent: CommittedVNode | null, next: MountingComponentNode | CommittedComponentNode, domParent: ParentNode, context: ReconcileContext, anchor?: Node, cursor?: HydrationCursor): CommittedComponentNode;
export declare function remove(node: CommittedVNode, domParent: ParentNode, context: ReconcileContext): void;
export declare function findFirstDomAnchor(node: CommittedVNode | null | undefined): Node | null;
export declare function findLastDomAnchor(node: CommittedVNode | null | undefined): Node | null;
export declare function setActiveSchedulerUpdateParents(parents: ParentNode[] | undefined): void;
export declare function findNextSiblingDomAnchor(curr: CommittedVNode | MountingComponentNode): Node | null;
export {};
