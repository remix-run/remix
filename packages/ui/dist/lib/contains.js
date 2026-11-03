export function contains(container, target) {
    while (target) {
        if (container.contains(target))
            return true;
        let root = target.getRootNode();
        target = isShadowRoot(root) ? root.host : null;
    }
    return false;
}
function isShadowRoot(node) {
    return node.nodeType === 11 && 'host' in node;
}
//# sourceMappingURL=contains.js.map