import { PORTAL_NODE, Portal as portalComponent, type PortalProps } from './component.ts'
import type { ElementProps } from './core/vnode.ts'
import { isRemixNode } from './core/vnode.ts'
import { invariant } from './invariant.ts'
import {
  childrenToVNodes,
  diffChildren,
  parseHostProps,
  persistedMixinNodes,
  portalRanges,
  reconcileVNodes,
  remove,
  replace,
  restoreAncestorSelect,
  setPortalRanges,
  type CommittedPortalNode,
  type CommittedVNode,
  type PortalNode,
  type ReconcileContext,
  type RuntimeHostProps,
  type VNodeParent,
} from './reconcile.ts'

export type PortalNodeRenderer = typeof portalNodeRenderer

const portalNodeRenderer = {
  parseProps(props: ElementProps): RuntimeHostProps & PortalProps {
    let hostProps = parseHostProps(props)
    invariant(isRemixNode(hostProps.children), 'Invalid host children')
    let container: PortalProps['container'] = props.container
    // Adoption changes ownerDocument without changing the element's prototype, so avoid
    // instanceof checks against either window's HTMLElement constructor.
    invariant(
      container === undefined ||
        (container?.nodeType === Node.ELEMENT_NODE &&
          container.namespaceURI === 'http://www.w3.org/1999/xhtml'),
      'Portal container must be an HTMLElement',
    )
    return { ...hostProps, container }
  },
  reconcile: reconcilePortal,
  dispose(node: CommittedPortalNode, context: ReconcileContext) {
    if (node._removed) return
    node._removed = true
    context._pendingPortals?.delete(node)
    for (let child of node._children) remove(child, node._container, context)
    node._children = []
    // An interrupted child update can leave DOM outside the recorded child list. Removing a
    // normal host removes that DOM too. A Portal must clear its range, preserving known exits.
    if (
      node._rangeStart.parentNode === node._container &&
      node._rangeEnd.parentNode === node._container &&
      node._rangeStart.nextSibling !== node._rangeEnd
    ) {
      let retained: Set<Node> | undefined
      for (let child of persistedMixinNodes) {
        if (child._persistence?.parent !== node._container) continue
        if (portalRanges?.ownerOf(child._parent) !== node) continue
        retained ??= new Set()
        retained.add(child._dom)
      }
      let current = node._rangeStart.nextSibling
      while (current && current !== node._rangeEnd) {
        let next = current.nextSibling
        if (!retained?.has(current)) current.remove()
        current = next
      }
    }
    portalRanges?.finishRemovals(node._container)
    restoreAncestorSelect(node._container)
  },
}

/**
 * Renders children into another DOM container without adding a wrapper element.
 * Renders nothing on the server. Inside a client entry, portal children render in the browser during
 * hydration and subsequent updates. Without a client entry, the portal stays absent. DOM events,
 * inherited styles, form ownership, and keyboard navigation follow the destination's DOM ancestry
 * and order.
 *
 * @param handle Component handle containing the portal props.
 * @returns An empty server render function.
 */
export const Portal = Object.defineProperty(portalComponent, PORTAL_NODE, {
  configurable: true,
  value: portalNodeRenderer,
})

function reconcilePortal(
  curr: CommittedPortalNode | null,
  node: PortalNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node | null,
): CommittedVNode {
  let doc = domParent.ownerDocument ?? document
  let container = node.props.container === undefined ? doc.body : node.props.container
  invariant(container, 'Portal requires a destination container or a document body')
  invariant(container.ownerDocument === doc, 'Portal container must belong to the same document')

  if (!curr) {
    let start = doc.createComment('rmx:portal')
    let end = doc.createComment('/rmx:portal')
    container.append(start, end)
    curr = {
      kind: 'portal',
      type: node.type,
      key: node.key,
      props: node.props,
      _parent: vParent,
      _svg: false,
      _container: container,
      _rangeStart: start,
      _rangeEnd: end,
      _children: [],
    }
    let ranges = portalRanges ?? setPortalRanges(new PortalRanges())
    ranges.register(curr)
    context._pendingPortals ??= new Set()
    context._pendingPortals.add(curr)
    for (let child of childrenToVNodes(node.props.children)) {
      curr._children.push(reconcileVNodes(null, child, container, curr, context, end))
    }
  } else {
    // A failed replacement can leave the previous portal in the committed tree after its removal.
    if (
      curr._removed ||
      container !== curr._container ||
      curr._rangeStart.parentNode !== curr._container
    ) {
      let current: Node | null = curr._rangeStart
      while (current) {
        invariant(
          !current.contains(container),
          'Portal container must not be inside its own children',
        )
        if (current === curr._rangeEnd) break
        current = current.nextSibling
      }
      return replace(curr, node, domParent, vParent, context, anchor)
    }
    curr._parent = vParent
    curr.props = node.props
    curr._children = diffChildren(
      curr._children,
      childrenToVNodes(node.props.children),
      container,
      curr,
      context,
      undefined,
      curr._rangeEnd,
    )
  }
  restoreAncestorSelect(container)
  return curr
}

export class PortalRanges extends WeakMap<Node, Set<CommittedPortalNode>> {
  ends = new WeakMap<Node, Comment>()
  #snapshots = new WeakMap<Node[], Node[]>()

  ownerOf(parent: VNodeParent): CommittedPortalNode | undefined {
    while (parent.kind !== 'root') {
      if (parent.kind === 'portal') return parent
      parent = parent._parent
    }
  }

  register(range: CommittedPortalNode): void {
    this.ends.set(range._rangeStart, range._rangeEnd)
    let ranges = this.get(range._container)
    if (!ranges) this.set(range._container, (ranges = new Set()))
    ranges.add(range)
  }

  exclude(nodes: Node[], parent?: Node): Node[] {
    let snapshot = this.#snapshots.get(nodes)
    if (snapshot) return snapshot
    if (!nodes.length) return nodes
    parent ??= nodes[0].parentNode ?? undefined
    if (!parent || !this.has(parent)) return nodes
    let result: Node[] | undefined
    for (let i = 0; i < nodes.length; i++) {
      let end = this.ends.get(nodes[i])
      if (end) {
        result ??= nodes.slice(0, i)
        let endIndex = nodes.indexOf(end, i)
        invariant(endIndex !== -1, 'Portal end marker not found')
        i = endIndex
      } else {
        result?.push(nodes[i])
      }
    }
    if (!result) return nodes
    // A frame may revisit the same snapshot after disposing the last portal.
    this.#snapshots.set(nodes, result)
    return result
  }

  finishRemovals(container: ParentNode): void {
    let portals = this.get(container)
    if (!portals) return
    for (let portal of portals) {
      if (!portal._removed) continue
      let { _rangeStart: start, _rangeEnd: end } = portal
      if (
        start.parentNode === container &&
        end.parentNode === container &&
        start.nextSibling !== end
      ) {
        continue
      }
      portals.delete(portal)
      if (!portals.size) this.delete(container)
      start.remove()
      end.remove()
    }
  }

  setInnerHTML(element: Element, html: string): void {
    // A template's innerHTML updates its content fragment, leaving portal nodes untouched.
    if (element.localName === 'template') {
      element.innerHTML = html
      return
    }
    // Keeping portal nodes connected preserves focus and custom element lifecycles.
    for (let node of this.exclude(Array.from(element.childNodes), element)) {
      element.removeChild(node)
    }
    if (element.localName === 'html') {
      // insertAdjacentHTML uses a body context for html elements, unlike innerHTML.
      let parsed = element.ownerDocument.createElement('html')
      parsed.innerHTML = html
      let anchor = element.firstChild
      while (parsed.firstChild) element.insertBefore(parsed.firstChild, anchor)
    } else {
      element.insertAdjacentHTML('afterbegin', html)
    }
  }
}
