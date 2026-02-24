import { TypedEventTarget } from '@remix-run/typed-event-target'
import type { NodePolicy } from '../lib/types.ts'

export type TestContainerNode = {
  kind: 'container'
  children: TestNode[]
}

type TestElementEventMap = Record<string, Event>

export type TestElementNode = TypedEventTarget<TestElementEventMap> & {
  kind: 'element'
  type: string
  parent: null | TestContainerNode | TestElementNode
  children: TestNode[]
}

export type TestTextNode = {
  kind: 'text'
  value: string
  parent: null | TestContainerNode | TestElementNode
}

export type TestNode = TestElementNode | TestTextNode

export type TestTraversal = {
  next: null | TestNode
}

export type TestNodePolicy = NodePolicy<
  TestContainerNode,
  TestNode,
  TestTextNode,
  TestElementNode
> & {
  operations: string[]
  assertTreeConsistency(container: TestContainerNode): void
}

export function createTestContainer(): TestContainerNode {
  return {
    kind: 'container',
    children: [],
  }
}

export function createTestNodePolicy(): TestNodePolicy {
  let operations: string[] = []

  return {
    operations,
    createText(_parent, value) {
      return {
        kind: 'text',
        value,
        parent: null,
      }
    },
    setText(node, value) {
      node.value = value
      operations.push(`setText:${value}`)
    },
    createElement(_parent, type) {
      return Object.assign(new TypedEventTarget<TestElementEventMap>(), {
        kind: 'element' as const,
        type,
        parent: null as null | TestContainerNode | TestElementNode,
        children: [] as TestNode[],
      })
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
      operations.push(`insert:${describeNode(node)}`)
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
      operations.push(`move:${describeNode(node)}`)
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
      operations.push(`remove:${describeNode(node)}`)
    },
    assertTreeConsistency(container) {
      assertParentLinks(null, container)
    },
  }
}

export function stringifyTestNode(node: TestContainerNode | TestNode): string {
  if (node.kind === 'container') {
    return node.children.map((child) => stringifyTestNode(child)).join('')
  }
  if (node.kind === 'text') return node.value
  let children = node.children.map((child) => stringifyTestNode(child)).join('')
  return `<${node.type}>${children}</${node.type}>`
}

function assertAnchor(parent: TestContainerNode | TestElementNode, anchor: null | TestNode) {
  if (!anchor) return
  if (anchor.parent !== parent) {
    throw new Error('illegal operation: anchor is not a child of parent')
  }
}

function describeNode(node: TestNode) {
  if (node.kind === 'text') return `text(${node.value})`
  return `element(${node.type})`
}

function assertParentLinks(
  parent: null | TestContainerNode | TestElementNode,
  node: TestContainerNode | TestNode,
) {
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
