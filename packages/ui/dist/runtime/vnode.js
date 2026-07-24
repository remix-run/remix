import { Fragment, Frame } from "./component.js";
import { isRemixElement } from "./core/vnode.js";
export { isRemixElement };
export const TEXT_NODE = Symbol('TEXT_NODE');
export const NON_RENDER_NODE = Symbol('NON_RENDER_NODE');
export const ROOT_VNODE = Symbol('ROOT_VNODE');
export function isFragmentNode(node) {
    return node.type === Fragment;
}
export function isTextNode(node) {
    return node.type === TEXT_NODE;
}
export function isNonRenderNode(node) {
    return node.type === NON_RENDER_NODE;
}
export function isCommittedTextNode(node) {
    // _dom on a text node is only ever assigned a Text, so a null check avoids
    // the cost of instanceof on a DOM wrapper in hot reconciliation walks.
    return isTextNode(node) && node._dom != null;
}
export function isHostNode(node) {
    return typeof node.type === 'string';
}
export function isCommittedHostNode(node) {
    // _dom on a host node is only ever assigned an Element (see setupHostNode),
    // so a null check avoids instanceof cost in hot reconciliation walks.
    return isHostNode(node) && node._dom != null;
}
export function isComponentNode(node) {
    return typeof node.type === 'function' && node.type !== Frame;
}
export function isCommittedComponentNode(node) {
    return isComponentNode(node) && node._content !== undefined;
}
export function findContextFromAncestry(node, type) {
    let current = node;
    while (current) {
        if (current.type === type && isComponentNode(current)) {
            return current._handle.getContextValue();
        }
        current = current._parent;
    }
    return undefined;
}
//# sourceMappingURL=vnode.js.map