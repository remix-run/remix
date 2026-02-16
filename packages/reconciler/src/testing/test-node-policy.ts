import type { NodePolicy, ResolvedElement, ResolvedText } from '../lib/types.ts'

export type TestTextNode = {
  kind: 'text'
  value: string
  parent: null | TestParentNode
}

export type TestElementNode = {
  kind: 'element'
  type: string
  attributes: Record<string, string>
  children: TestNode[]
  parent: null | TestParentNode
}

export type TestNode = TestTextNode | TestElementNode

export type TestContainerNode = {
  kind: 'container'
  children: TestNode[]
}

export type TestParentNode = TestContainerNode | TestElementNode

export type TestTraversal = null | TestNode

export type TestNodePolicy = NodePolicy<
  TestParentNode,
  TestNode,
  TestTextNode,
  TestElementNode,
  TestTraversal
> & {
  createText(parent: TestParentNode, value: string): TestTextNode
  createElement(parent: TestParentNode, type: string): TestElementNode
  operations: {
    createText: number
    createElement: number
    insert: number
    move: number
    remove: number
  }
}

export function createTestContainer(): TestContainerNode {
  return {
    kind: 'container',
    children: [],
  }
}

export function createTestNodePolicy(): TestNodePolicy {
  let operations = {
    createText: 0,
    createElement: 0,
    insert: 0,
    move: 0,
    remove: 0,
  }

  return {
    operations,
    firstChild(parent) {
      return parent.children[0] ?? null
    },
    nextSibling(node) {
      let parent = node.parent
      if (!parent) return null
      let index = parent.children.indexOf(node)
      if (index === -1) return null
      return parent.children[index + 1] ?? null
    },
    begin(parent) {
      return parent.children[0] ?? null
    },
    enter(parent) {
      return parent.children[0] ?? null
    },
    createText(_parent, value) {
      return createTextNode(value)
    },
    createElement(_parent, type) {
      return createElementNode(type)
    },
    insert(parent, node, anchor) {
      operations.insert++
      insertNode(parent, node, anchor)
    },
    move(parent, node, anchor) {
      operations.move++
      insertNode(parent, node, anchor)
    },
    remove(parent, node) {
      operations.remove++
      removeNode(parent, node)
    },
    resolveText(parent, traversal, value): ResolvedText<TestTextNode, TestTraversal> {
      let candidate = traversal
      if (!candidate || candidate.kind !== 'text') {
        let node = createTextNode(value)
        return {
          node,
          next: candidate,
        }
      }
      candidate.value = value
      return {
        node: candidate,
        next: this.nextSibling(candidate),
      }
    },
    resolveElement(parent, traversal, type): ResolvedElement<TestElementNode, TestTraversal> {
      let candidate = traversal
      if (candidate && candidate.kind === 'element' && candidate.type === type) {
        return {
          node: candidate,
          next: this.nextSibling(candidate),
        }
      }

      let retry = candidate ? this.nextSibling(candidate) : null
      if (retry && retry.kind === 'element' && retry.type === type) {
        return {
          node: retry,
          next: this.nextSibling(retry),
        }
      }

      let next = candidate ? this.nextSibling(candidate) : null
      let node = createElementNode(type)
      return {
        node,
        next,
      }
    },
  }

  function createTextNode(value: string): TestTextNode {
    operations.createText++
    return {
      kind: 'text',
      value,
      parent: null,
    }
  }

  function createElementNode(type: string): TestElementNode {
    operations.createElement++
    return {
      kind: 'element',
      type,
      attributes: {},
      children: [],
      parent: null,
    }
  }
}

function insertNode(parent: TestParentNode, node: TestNode, anchor: null | TestNode) {
  if (anchor && anchor.parent !== parent) {
    throw new Error('anchor is not a child of parent')
  }
  if (node.parent && !node.parent.children.includes(node)) {
    throw new Error('node parent relationship is invalid')
  }
  if (node.parent) {
    let currentParent = node.parent
    let index = currentParent.children.indexOf(node)
    if (index >= 0) {
      currentParent.children.splice(index, 1)
    }
  }
  node.parent = parent
  let anchorIndex = anchor ? parent.children.indexOf(anchor) : -1
  if (anchorIndex === -1) {
    parent.children.push(node)
  } else {
    parent.children.splice(anchorIndex, 0, node)
  }
}

export function stringifyTestNode(parent: TestParentNode): string {
  let parts: string[] = []
  for (let child of parent.children) {
    parts.push(stringifyChild(child))
  }
  return parts.join('')
}

function removeNode(parent: TestParentNode, node: TestNode) {
  if (node.parent !== parent) {
    throw new Error('node is not a child of parent')
  }
  let index = parent.children.indexOf(node)
  if (index === -1) {
    throw new Error('node parent relationship is invalid')
  }
  parent.children.splice(index, 1)
  node.parent = null
}

function stringifyChild(node: TestNode): string {
  if (node.kind === 'text') return node.value
  let attrs = stringifyAttributes(node.attributes)
  let open = attrs === '' ? `<${node.type}>` : `<${node.type} ${attrs}>`
  let children = node.children.map((child) => stringifyChild(child)).join('')
  return `${open}${children}</${node.type}>`
}

function stringifyAttributes(attributes: Record<string, string>) {
  let entries = Object.entries(attributes)
  if (entries.length === 0) return ''
  return entries.map(([key, value]) => `${key}="${escapeAttribute(value)}"`).join(' ')
}

function escapeAttribute(value: string) {
  return value.replace(/"/g, '&quot;')
}
