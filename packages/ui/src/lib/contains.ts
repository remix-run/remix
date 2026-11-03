export function contains(container: Element, target: Node | null): boolean {
  while (target) {
    if (container.contains(target)) return true
    let root = target.getRootNode()
    target = isShadowRoot(root) ? root.host : null
  }
  return false
}

function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node
}
