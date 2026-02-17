import { Fragment, Frame } from "./component.js";
export const TEXT_NODE = Symbol('TEXT_NODE');
export const ROOT_VNODE = Symbol('ROOT_VNODE');
export function isFragmentNode(node) {
    return node.type === Fragment;
}
export function isTextNode(node) {
    return node.type === TEXT_NODE;
}
export function isCommittedTextNode(node) {
    return isTextNode(node) && node._dom instanceof Text;
}
export function isHostNode(node) {
    return typeof node.type === 'string';
}
export function isCommittedHostNode(node) {
    return isHostNode(node) && node._dom instanceof Element;
}
export function isComponentNode(node) {
    return typeof node.type === 'function' && node.type !== Frame;
}
export function isCommittedComponentNode(node) {
    return isComponentNode(node) && node._content !== undefined;
}
export function isRemixElement(node) {
    return typeof node === 'object' && node !== null && '$rmx' in node;
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