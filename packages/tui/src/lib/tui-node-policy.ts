import { createNodePolicy } from '@remix-run/reconciler'
import type { NodePolicy, NodePolicyDefinition } from '@remix-run/reconciler'
import type { TuiHostBridge, TuiHostNode } from './tui-host.ts'

export type TuiContainerNode = {
  kind: 'container'
  host: unknown
  bridge: TuiHostBridge
  children: TuiNode[]
}

export type TuiElementNode = {
  kind: 'element'
  type: string
  host: TuiHostNode
  parent: null | TuiContainerNode | TuiElementNode
  children: TuiNode[]
  bridge: TuiHostBridge
}

export type TuiTextNode = {
  kind: 'text'
  host: TuiHostNode
  parent: null | TuiContainerNode | TuiElementNode
  bridge: TuiHostBridge
}

export type TuiNode = TuiElementNode | TuiTextNode
export type TuiParentNode = TuiContainerNode | TuiElementNode

export type TuiNodePolicy = NodePolicy<TuiContainerNode, TuiNode, TuiTextNode, TuiElementNode>
export type TuiNodePolicyDefinition = NodePolicyDefinition<
  TuiContainerNode,
  TuiNode,
  TuiTextNode,
  TuiElementNode
>

export function createTuiContainer(host: unknown, bridge: TuiHostBridge): TuiContainerNode {
  return {
    kind: 'container',
    host,
    bridge,
    children: [],
  }
}

export function createTuiNodePolicy(): TuiNodePolicyDefinition {
  return createNodePolicy(() => {
    return {
      createText(parent, value) {
        let bridge = parent.bridge
        return {
          kind: 'text',
          host: bridge.createText(value),
          parent: null,
          bridge,
        }
      },
      setText(node, value) {
        let bridge = node.parent?.bridge ?? node.bridge
        bridge.setText(node.host, value)
      },
      createElement(parent, type) {
        let bridge = parent.bridge
        return {
          kind: 'element',
          type,
          host: bridge.createElement(type),
          parent: null,
          children: [],
          bridge,
        }
      },
      getType(node) {
        return node.type
      },
      getParent(node) {
        return node.parent
      },
      firstChild(parent) {
        return parent.children[0] ?? null
      },
      nextSibling(node) {
        let parent = node.parent
        if (!parent) return null
        let index = parent.children.indexOf(node)
        if (index < 0) return null
        return parent.children[index + 1] ?? null
      },
      insert(parent, node, anchor) {
        assertAnchor(parent, anchor)
        if (node.parent) {
          throw new Error('illegal insert: node already has a parent')
        }
        let index = anchor ? parent.children.indexOf(anchor) : -1
        if (index < 0) {
          parent.children.push(node)
        } else {
          parent.children.splice(index, 0, node)
        }
        node.parent = parent
        node.bridge = parent.bridge
        parent.bridge.insert(parent.host, node.host, anchor?.host ?? null)
      },
      move(parent, node, anchor) {
        assertAnchor(parent, anchor)
        if (node.parent !== parent) {
          throw new Error('illegal move: node is not a child of target parent')
        }
        if (anchor === node) {
          throw new Error('illegal move: anchor cannot be the same node')
        }
        let currentIndex = parent.children.indexOf(node)
        if (currentIndex < 0) {
          throw new Error('illegal move: node is not present in parent children')
        }
        parent.children.splice(currentIndex, 1)
        let nextIndex = anchor ? parent.children.indexOf(anchor) : -1
        if (nextIndex < 0) {
          parent.children.push(node)
        } else {
          parent.children.splice(nextIndex, 0, node)
        }
        parent.bridge.move(parent.host, node.host, anchor?.host ?? null)
      },
      remove(parent, node) {
        if (node.parent !== parent) {
          throw new Error('illegal remove: node is not owned by parent')
        }
        let index = parent.children.indexOf(node)
        if (index < 0) {
          throw new Error('illegal remove: node is missing from parent children')
        }
        parent.children.splice(index, 1)
        node.parent = null
        parent.bridge.remove(parent.host, node.host)
      },
    }
  })
}

export function assertTuiTreeConsistency(container: TuiContainerNode) {
  assertParentLinks(null, container)
}

function assertAnchor(parent: TuiParentNode, anchor: null | TuiNode) {
  if (!anchor) return
  if (anchor.parent !== parent) {
    throw new Error('illegal operation: anchor is not a child of parent')
  }
}

function assertParentLinks(parent: null | TuiParentNode, node: TuiContainerNode | TuiNode) {
  if (node.kind === 'container') {
    for (let child of node.children) assertParentLinks(node, child)
    return
  }
  if (node.parent !== parent) {
    throw new Error('tree invariant broken: incorrect parent link')
  }
  if (node.kind === 'element') {
    for (let child of node.children) assertParentLinks(node, child)
  }
}

