import { invariant } from './invariant.ts'
import type { FrameContext } from './frame.ts'

export function diffNodes(curr: Node[], next: Node[], context: FrameContext) {
  let parent = curr[0]?.parentNode ?? context.regionParent ?? null
  invariant(parent, 'Parent node not found')

  // When diffing a bounded region (e.g. between frame comments), we should insert new
  // nodes before the region tail ref rather than appending to the parent.
  let regionTailRef: ChildNode | null =
    context.regionTailRef ??
    (curr.length > 0 ? (curr[curr.length - 1].nextSibling as ChildNode | null) : null)

  let max = Math.max(curr.length, next.length)
  for (let i = 0; i < max; i++) {
    let c = curr[i]
    let n = next[i]

    if (!c && n) {
      if (regionTailRef) {
        parent.insertBefore(n, regionTailRef)
      } else {
        parent.appendChild(n)
      }
    } else if (c && !n) {
      parent.removeChild(c)
    } else if (c && n) {
      // Skip hydrated client-entry boundary ranges; hydration pass re-renders
      // roots with new props from incoming payload
      if (isVirtualRootStartMarker(c) && isVirtualRootStartMarker(n)) {
        let currentEnd = findHydrationEndMarker(c)
        let nextEnd = findHydrationEndMarker(n)
        let nextData = n.data
        if (c.data !== nextData) c.data = nextData

        let currentEndIndex = curr.indexOf(currentEnd)
        let nextEndIndex = next.indexOf(nextEnd)
        i = Math.max(currentEndIndex, nextEndIndex)
        continue
      }

      let cursor = diffNode(c, n, context)
      if (cursor) {
        i = next.indexOf(cursor)
      }
    }
  }
}

function diffNode(current: Node, next: Node, context: FrameContext): ChildNode | undefined {
  // Text -> Text
  if (isTextNode(current) && isTextNode(next)) {
    let newText = next.textContent || ''
    if (current.textContent !== newText) current.textContent = newText
    return
  }

  // Hydration boundary -> Hydration boundary
  if (isVirtualRootStartMarker(current) && isVirtualRootStartMarker(next)) {
    let nextData = next.data
    if (current.data !== nextData) {
      current.data = nextData
    }

    let end = findHydrationEndMarker(next)
    // Fast-forward across this hydrated region.
    return end
  }

  // Comment -> Comment
  if (isCommentNode(current) && isCommentNode(next)) {
    let newData = next.data
    if (current.data !== newData) current.data = newData
    return
  }

  // Element -> Element
  if (isElement(current) && isElement(next)) {
    // Different tags: replace
    if (current.tagName !== next.tagName) {
      let parent = current.parentNode
      if (parent) parent.replaceChild(next, current)
      return
    }

    // Same tag: update attributes then children
    diffElementAttributes(current, next)
    diffElementChildren(current, next, context)
    return
  }

  // Type mismatch: replace
  let parent = current.parentNode
  if (parent) parent.replaceChild(next, current)
}

function diffElementAttributes(current: Element, next: Element): void {
  let prevAttrNames = current.getAttributeNames()
  let nextAttrNames = next.getAttributeNames()

  let nextNameSet = new Set(nextAttrNames)

  // Removals
  for (let name of prevAttrNames) {
    if (!nextNameSet.has(name)) current.removeAttribute(name)
  }

  // Additions/updates
  for (let name of nextAttrNames) {
    let prevVal = current.getAttribute(name)
    let nextVal = next.getAttribute(name)
    if (prevVal !== nextVal) current.setAttribute(name, nextVal == null ? '' : String(nextVal))
  }
}

function diffElementChildren(current: Element, next: Element, context: FrameContext): void {
  let currentChildren = Array.from(current.childNodes)
  let nextChildren = Array.from(next.childNodes)

  // Keyed map by data-key for current children
  let keyToIndex = new Map<string, number>()
  for (let i = 0; i < currentChildren.length; i++) {
    let node = currentChildren[i]
    if (isElement(node)) {
      let key = node.getAttribute('data-key')
      if (key != null) keyToIndex.set(key, i)
    }
  }

  let used = new Array<boolean>(currentChildren.length).fill(false)
  let matchIndexForNext = new Array<number>(nextChildren.length).fill(-1)

  for (let i = 0; i < nextChildren.length; i++) {
    let nextChild = nextChildren[i]
    let matchIndex = -1

    if (isElement(nextChild)) {
      let key = nextChild.getAttribute('data-key')
      if (key != null && keyToIndex.has(key)) {
        let idx = keyToIndex.get(key)!
        if (!used[idx]) matchIndex = idx
      }
    }

    if (matchIndex === -1) {
      let candidateIndex = i
      if (
        candidateIndex < currentChildren.length &&
        !used[candidateIndex] &&
        nodeTypesComparable(currentChildren[candidateIndex], nextChild)
      ) {
        matchIndex = candidateIndex
      }
    }

    if (matchIndex !== -1) used[matchIndex] = true
    matchIndexForNext[i] = matchIndex
  }

  // Forward pass: update matched, collect committed
  let committed: Array<Node | undefined> = new Array(nextChildren.length)
  for (let i = 0; i < nextChildren.length; i++) {
    let mi = matchIndexForNext[i]
    if (mi !== -1) {
      let curChild = currentChildren[mi]
      let cursor = diffNode(curChild, nextChildren[i], context)
      if (cursor) {
        // Fast-forward across a hydrated virtual root region.
        let nextEndIdx = nextChildren.indexOf(cursor)
        let currEndIdx = findHydrationEndIndex(currentChildren, mi)

        // Mark the entire current region as used to avoid removals.
        for (let k = mi; k <= currEndIdx; k++) used[k] = true

        // Preserve both boundary markers in committed; skip interior in reorder pass.
        committed[i] = curChild // start marker
        committed[nextEndIdx] = currentChildren[currEndIdx] // end marker
        for (let j = i + 1; j < nextEndIdx; j++) committed[j] = undefined

        // Jump to end of region.
        i = nextEndIdx
        continue
      }
      committed[i] = curChild
    } else {
      committed[i] = nextChildren[i]
    }
  }

  // Backward pass: reorder via inserts while avoiding redundant moves
  let anchor: Node | undefined = undefined
  for (let i = committed.length - 1; i >= 0; i--) {
    let node = committed[i]
    if (!node) continue

    // Use only an anchor that is actually a child of the current parent
    let ref = anchor && anchor.parentNode === current ? anchor : null

    // Do not move hydration boundary markers; keep region stable.
    // If a boundary marker is new, ensure it is inserted before using it as an anchor.
    if (isVirtualRootStartMarker(node) || isVirtualRootEndMarker(node)) {
      if (node.parentNode !== current) {
        current.insertBefore(node, ref)
      }
      anchor = node
      continue
    }

    if (node.parentNode === current) {
      // Node already in parent: move only if its nextSibling is not the desired ref.
      let targetNext = ref
      let alreadyInPlace =
        (targetNext === null && node.nextSibling === null) || node.nextSibling === targetNext
      if (!alreadyInPlace) {
        current.insertBefore(node, targetNext)
      }
    } else {
      // New node: insert relative to a valid ref or append
      current.insertBefore(node, ref)
    }

    // Advance anchor only after the node is placed in the correct parent
    if (node.parentNode === current) {
      anchor = node
    }
  }

  // Remove any current children not used
  for (let i = 0; i < currentChildren.length; i++) {
    if (!used[i]) {
      current.removeChild(currentChildren[i])
    }
  }
}

function nodeTypesComparable(a: Node, b: Node): boolean {
  if (isTextNode(a) && isTextNode(b)) return true
  if (isElement(a) && isElement(b)) return a.tagName === b.tagName
  if (isVirtualRootStartMarker(a) && isVirtualRootStartMarker(b)) return true
  if (isVirtualRootEndMarker(a) && isVirtualRootEndMarker(b)) return true
  if (isCommentNode(a) && isCommentNode(b)) return true
  return false
}

function isHydrationEndComment(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim() === '/rmx:h'
}

function findHydrationEndMarker(start: Comment): Comment {
  let node: Node | null = start.nextSibling
  let depth = 1

  while (node) {
    if (isCommentNode(node)) {
      if (isVirtualRootStartMarker(node)) depth++
      if (isVirtualRootEndMarker(node)) {
        depth--
        if (depth === 0) return node
      }
    }
    node = node.nextSibling
  }

  throw new Error('Hydration end marker not found')
}

function findHydrationEndIndex(nodes: Node[], startIdx: number): number {
  for (let j = startIdx + 1; j < nodes.length; j++) {
    if (isHydrationEndComment(nodes[j])) return j
  }
  return startIdx
}

function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

function isCommentNode(node: Node): node is Comment {
  return node.nodeType === Node.COMMENT_NODE
}

function isVirtualRootStartMarker(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim().startsWith('rmx:h:')
}

function isVirtualRootEndMarker(node: Node): node is Comment {
  return isCommentNode(node) && node.data.trim() === '/rmx:h'
}
