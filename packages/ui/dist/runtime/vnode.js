import { isRemixElement } from './core/vnode.js';
export { isRemixElement };
export const TEXT_NODE = Symbol('TEXT_NODE');
export const NON_RENDER_NODE = Symbol('NON_RENDER_NODE');
export const ROOT_VNODE = Symbol('ROOT_VNODE');
export function isFragmentNode(node) {
    return node.kind === 'fragment';
}
export function isTextNode(node) {
    return node.kind === 'text';
}
export function isNonRenderNode(node) {
    return node.kind === 'empty';
}
export function isCommittedTextNode(node) {
    return node.kind === 'text';
}
export function isHostNode(node) {
    return node.kind === 'host';
}
export function isCommittedHostNode(node) {
    return node.kind === 'host';
}
export function isComponentNode(node) {
    return node.kind === 'component';
}
export function isCommittedComponentNode(node) {
    return node.kind === 'component' && '_content' in node;
}
export function isFrameNode(node) {
    return node.kind === 'frame';
}
export function isCommittedFrameNode(node) {
    return node.kind === 'frame';
}
export function findContextFromAncestry(node, type) {
    let current = node;
    while (current) {
        if (current.kind === 'component' && current.type === type) {
            return current._handle.getContextValue();
        }
        current = '_parent' in current ? current._parent : undefined;
    }
    return undefined;
}
//# sourceMappingURL=vnode.js.map