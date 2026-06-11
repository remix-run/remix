import { Fragment } from "./component.js";
import { invariant } from "./invariant.js";
import { isEmptyChild, isPrimitiveChild, normalizeChildren } from "./core/children.js";
import { isRemixElement, NON_RENDER_NODE, TEXT_NODE } from "./vnode.js";
function flatMapChildrenToVNodes(node) {
    if (!('children' in node.props))
        return [];
    let children = node.props.children;
    if (!Array.isArray(children))
        return [toVNode(children)];
    let vnodes = [];
    flattenChildrenToVNodes(children, vnodes);
    return vnodes;
}
function flattenChildrenToVNodes(nodes, out) {
    for (let child of normalizeChildren(nodes)) {
        out.push(toVNode(child));
    }
}
export function toVNode(node) {
    if (isEmptyChild(node)) {
        return { type: NON_RENDER_NODE };
    }
    if (isPrimitiveChild(node)) {
        return { type: TEXT_NODE, _text: String(node) };
    }
    if (Array.isArray(node)) {
        let children = [];
        flattenChildrenToVNodes(node, children);
        return { type: Fragment, _children: children };
    }
    if (node.type === Fragment) {
        return { type: Fragment, key: node.key, _children: flatMapChildrenToVNodes(node) };
    }
    if (isRemixElement(node)) {
        // When innerHTML is set, ignore children
        let children = node.props.innerHTML != null ? [] : flatMapChildrenToVNodes(node);
        return { type: node.type, key: node.key, props: node.props, _children: children };
    }
    invariant(false, 'Unexpected RemixNode');
}
//# sourceMappingURL=to-vnode.js.map