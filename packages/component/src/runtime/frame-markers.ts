import { invariant } from './invariant.ts'

export function isCommentNode(node: Node | null | undefined): node is Comment {
  return node?.nodeType === Node.COMMENT_NODE
}

export function isFrameStart(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim().startsWith('rmx:f:')
}

export function isFrameEnd(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim() === '/rmx:f'
}

export function isHydrationStart(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim().startsWith('rmx:h:')
}

export function isHydrationEnd(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim() === '/rmx:h'
}

export function getFrameId(start: Comment): string {
  let trimmed = start.data.trim()
  invariant(trimmed.startsWith('rmx:f:'), 'Invalid frame start marker')
  return trimmed.slice('rmx:f:'.length)
}

export function findEndMarker(
  start: Comment,
  isStart: (node: Node) => boolean,
  isEnd: (node: Node) => node is Comment,
  message = 'End marker not found',
): Comment {
  let node = start.nextSibling
  let depth = 1

  while (node) {
    if (isStart(node)) depth++
    else if (isEnd(node)) {
      depth--
      if (depth === 0) return node
    }
    node = node.nextSibling
  }

  throw new Error(message)
}

export function collectNodesBetween(start: Comment, end: Comment): Node[] {
  let nodes: Node[] = []
  let node = start.nextSibling
  while (node && node !== end) {
    nodes.push(node)
    node = node.nextSibling
  }
  return nodes
}
