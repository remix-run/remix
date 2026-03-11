import { Frame } from "./component.js";
import { isCommittedComponentNode, isCommittedHostNode, isCommittedTextNode, isFragmentNode, } from "./vnode.js";
let activeSchedulerUpdateParents;
export function setActiveSchedulerUpdateParents(parents) {
    activeSchedulerUpdateParents = parents;
}
export function shouldDispatchInlineMixinLifecycle(node) {
    let parents = activeSchedulerUpdateParents;
    if (!parents?.length)
        return true;
    for (let parent of parents) {
        let parentNode = parent;
        if (parentNode === node)
            return false;
        if (parentNode.contains(node))
            return false;
    }
    return true;
}
export function findFirstDomAnchor(node) {
    if (!node)
        return null;
    if (isCommittedTextNode(node))
        return node._dom;
    if (isCommittedHostNode(node))
        return node._dom;
    if (isCommittedComponentNode(node))
        return findFirstDomAnchor(node._content);
    if (node.type === Frame)
        return node._rangeStart ?? null;
    if (isFragmentNode(node)) {
        for (let child of node._children) {
            let dom = findFirstDomAnchor(child);
            if (dom)
                return dom;
        }
    }
    return null;
}
export function findLastDomAnchor(node) {
    if (!node)
        return null;
    if (isCommittedTextNode(node))
        return node._dom;
    if (isCommittedHostNode(node))
        return node._dom;
    if (isCommittedComponentNode(node))
        return findLastDomAnchor(node._content);
    if (node.type === Frame)
        return node._rangeEnd ?? null;
    if (isFragmentNode(node)) {
        for (let i = node._children.length - 1; i >= 0; i--) {
            let dom = findLastDomAnchor(node._children[i]);
            if (dom)
                return dom;
        }
    }
    return null;
}
export function findNextSiblingDomAnchor(curr, vParent) {
    if (!vParent || !Array.isArray(vParent._children))
        return null;
    let children = vParent._children;
    let idx = children.indexOf(curr);
    if (idx === -1)
        return null;
    for (let i = idx + 1; i < children.length; i++) {
        let dom = findFirstDomAnchor(children[i]);
        if (dom)
            return dom;
    }
    return null;
}
export function domRangeContainsNode(first, last, node) {
    let current = first;
    while (current) {
        if (current === node)
            return true;
        if (current === last)
            break;
        current = current.nextSibling;
    }
    return false;
}
export function moveDomRange(domParent, first, last, before) {
    let current = first;
    while (current) {
        let next = current === last ? null : current.nextSibling;
        domParent.insertBefore(current, before);
        if (current === last)
            break;
        current = next;
    }
}
//# sourceMappingURL=reconcile-anchors.js.map