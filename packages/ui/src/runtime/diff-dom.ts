import { invariant } from './invariant.ts'
import type { FrameContext } from './frame.ts'
import { disposeClientEntryBoundary, getClientEntryBoundaryOwner } from './client-entry-boundary.ts'
import {
  findFrameEndMarkerIndex,
  findHydrationEndMarkerIndex,
  getFrameEndMarker,
  getFrameMarkerId,
  getHydrationEndMarker,
  getHydrationMarkerId,
  isCommentNode,
  isFrameEndMarker,
  isFrameStartMarker,
  isHydrationEndMarker,
  isHydrationStartMarker,
} from './core/markers.ts'

type MarkerKind = 'frame-start' | 'frame-end' | 'hydration-start' | 'hydration-end'

type CommentMarkerRangeReplacement = {
  currentStart: Comment
  nextStart: Comment
  currentEndIndex: number
  nextEndIndex: number
}

type NodeSiblingUnit = {
  kind: 'node'
  node: Node
  startIndex: number
  endIndex: number
}

type BoundarySiblingUnit = {
  kind: 'frame' | 'hydration'
  start: Comment
  end: Comment
  startIndex: number
  endIndex: number
}

type SiblingUnit = NodeSiblingUnit | BoundarySiblingUnit

const REMIX_PRESERVE_DOM_ATTRIBUTE = 'data-rmx-preserve-dom'

export function diffNodes(curr: Node[], next: Node[], context: FrameContext) {
  let parent = curr[0]?.parentNode ?? context.regionParent ?? null
  invariant(parent, 'Parent node not found')

  // When diffing a bounded region (e.g. between frame comments), we should insert new
  // nodes before the region tail ref rather than appending to the parent.
  let regionTailRef: ChildNode | null =
    context.regionTailRef ??
    (curr.length > 0 ? (curr[curr.length - 1].nextSibling as ChildNode | null) : null)

  diffSiblingUnits(curr, next, parent, regionTailRef, context)
}

function diffNode(current: Node, next: Node, context: FrameContext): ChildNode | undefined {
  // Text -> Text
  if (isTextNode(current) && isTextNode(next)) {
    let newText = next.textContent || ''
    if (current.textContent !== newText) current.textContent = newText
    return
  }

  // Hydration marker range -> Hydration marker range
  if (isHydrationStartMarker(current) && isHydrationStartMarker(next)) {
    let nextData = next.data
    if (current.data !== nextData) {
      current.data = nextData
    }

    let end = getHydrationEndMarker(next)
    // Fast-forward across this hydrated region.
    return end
  }

  // Comment -> Comment
  if (isCommentNode(current) && isCommentNode(next) && markerKindsMatch(current, next)) {
    let newData = next.data
    let updated = false
    if (isFrameStartMarker(current)) {
      if (shouldPreserveFrameStartMarker(current, next, context)) {
        if (current.data !== newData) {
          current.data = newData
        }
        updated = true

        let frame = context.frameInstances.get(current)
        let nextMarkerData = getFrameMarkerData(next, context)
        if (frame && nextMarkerData) {
          if (nextMarkerData.status === 'resolved') {
            let nextEnd = getFrameEndMarker(next)
            let nextContent = collectFrameContentFragment(current.ownerDocument, next, nextEnd)
            let render = frame.renderMarkerContent(
              { ...nextMarkerData, id: getFrameMarkerId(next) },
              nextContent,
              {
                data: context.data,
                signal: context.signal,
                reconciliationTracker: context.reconciliationTracker,
              },
            )
            if (context.reconciliationTracker) context.reconciliationTracker.waitFor(render)
            else void render
            return nextEnd
          }

          if (frame.isDisplayingResolvedContent()) {
            return getFrameEndMarker(next)
          }
        }
      } else if (current.data !== newData) {
        disposeFrameStartMarker(current, context)
        current.data = newData
        updated = true
      }
    }
    if (!updated && current.data !== newData) {
      current.data = newData
    }
    return
  }

  // Element -> Element
  if (isElement(current) && isElement(next)) {
    // Different tags: replace
    if (current.tagName !== next.tagName) {
      let parent = current.parentNode
      if (parent) {
        parent.insertBefore(next, current)
        removeNode(current, parent, context)
      }
      return
    }

    // Same tag: update attributes then children
    if (shouldPreserveDomElement(current, next)) return
    diffElementAttributes(current, next)
    if (shouldPreserveElementChildren(current, next)) return
    diffElementChildren(current, next, context)
    return
  }

  // Type mismatch: replace
  let parent = current.parentNode
  if (parent) {
    parent.insertBefore(next, current)
    removeNode(current, parent, context)
  }
}

function diffElementAttributes(current: Element, next: Element): void {
  let prevAttrNames = current.getAttributeNames()
  let nextAttrNames = next.getAttributeNames()

  let nextNameSet = new Set(nextAttrNames)

  // Removals
  for (let name of prevAttrNames) {
    if (!nextNameSet.has(name)) {
      if (shouldPreserveLiveAttribute(current, next, name)) continue
      current.removeAttribute(name)
    }
  }

  // Additions/updates
  for (let name of nextAttrNames) {
    let prevVal = current.getAttribute(name)
    let nextVal = next.getAttribute(name)
    if (prevVal !== nextVal) {
      if (shouldPreserveLiveAttribute(current, next, name)) continue
      current.setAttribute(name, nextVal == null ? '' : String(nextVal))
    }
  }
}

function shouldPreserveDomElement(current: Element, next: Element): boolean {
  if (!next.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)) return false
  if (!current.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)) {
    current.setAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE, '')
  }
  return true
}

function shouldPreserveLiveAttribute(current: Element, next: Element, name: string): boolean {
  if (name === 'open') {
    if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement) {
      return current.open !== next.open
    }

    if (current instanceof HTMLDialogElement && next instanceof HTMLDialogElement) {
      return current.open !== next.open
    }
  }

  if (name === 'checked') {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
      return current.checked !== next.checked
    }
  }

  if (name === 'value') {
    if (
      current instanceof HTMLInputElement &&
      next instanceof HTMLInputElement &&
      shouldPreserveInputValue(current)
    ) {
      return current.value !== next.value
    }
  }

  if (name === 'selected') {
    if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
      return current.selected !== next.selected
    }
  }

  if (name === 'popover') {
    return isPopoverOpen(current) !== isPopoverOpen(next)
  }

  return false
}

function shouldPreserveElementChildren(current: Element, next: Element): boolean {
  if (current instanceof HTMLTextAreaElement && next instanceof HTMLTextAreaElement) {
    return current.value !== next.value
  }

  return false
}

function shouldPreserveInputValue(input: HTMLInputElement): boolean {
  return (
    input.type !== 'button' &&
    input.type !== 'checkbox' &&
    input.type !== 'hidden' &&
    input.type !== 'image' &&
    input.type !== 'radio' &&
    input.type !== 'reset' &&
    input.type !== 'submit'
  )
}

function isPopoverOpen(element: Element): boolean {
  try {
    return element.matches(':popover-open')
  } catch {
    return false
  }
}

function diffElementChildren(current: Element, next: Element, context: FrameContext): void {
  let currentChildren: Node[]

  // Allow actively managed preload link tags in the head to stay in the document
  // during diffing rather than removing them which aborts the preload in Safari
  if (context.isActiveModulePreload && current === current.ownerDocument.head) {
    currentChildren = []
    for (let node of current.childNodes) {
      if (!context.isActiveModulePreload(node)) currentChildren.push(node)
    }
  } else {
    currentChildren = Array.from(current.childNodes)
  }
  let nextChildren = Array.from(next.childNodes)
  diffSiblingUnits(currentChildren, nextChildren, current, null, context)
}

function diffSiblingUnits(
  currentNodes: Node[],
  nextNodes: Node[],
  parent: ParentNode,
  regionTailRef: ChildNode | null,
  context: FrameContext,
): void {
  let currentUnits = parseSiblingUnits(currentNodes)
  let nextUnits = parseSiblingUnits(nextNodes)
  let keyToIndex = new Map<string, number>()

  for (let i = 0; i < currentUnits.length; i++) {
    let key = getSiblingUnitKey(currentUnits[i])
    if (key !== undefined) keyToIndex.set(key, i)
  }

  let used = new Array<boolean>(currentUnits.length).fill(false)
  let matchIndexForNext = new Array<number>(nextUnits.length).fill(-1)

  // Reserve globally matched keyed elements and semantic boundaries before
  // positionally pairing the remaining ordinary siblings.
  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i]
    let matchIndex = -1
    let key = getSiblingUnitKey(nextUnit)

    if (key !== undefined) {
      let keyedIndex = keyToIndex.get(key)
      if (
        keyedIndex !== undefined &&
        !used[keyedIndex] &&
        siblingUnitsComparable(currentUnits[keyedIndex], nextUnit)
      ) {
        matchIndex = keyedIndex
      }
    }

    // Boundary identities behave like implicit keys. Repeated boundaries with
    // the same identity are paired in source order because server markers do
    // not carry a separate application key.
    if (matchIndex === -1 && nextUnit.kind !== 'node') {
      for (let j = 0; j < currentUnits.length; j++) {
        let currentUnit = currentUnits[j]
        if (used[j] || currentUnit.kind !== nextUnit.kind) continue
        if (shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
          matchIndex = j
          break
        }
      }
    }

    if (matchIndex !== -1) used[matchIndex] = true
    matchIndexForNext[i] = matchIndex
  }

  let remainingCurrentIndexes: number[] = []
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i]) remainingCurrentIndexes.push(i)
  }

  let remainingNextIndexes: number[] = []
  for (let i = 0; i < nextUnits.length; i++) {
    if (matchIndexForNext[i] === -1) remainingNextIndexes.push(i)
  }

  let remainingLength = Math.min(remainingCurrentIndexes.length, remainingNextIndexes.length)
  for (let i = 0; i < remainingLength; i++) {
    let currentIndex = remainingCurrentIndexes[i]
    let nextIndex = remainingNextIndexes[i]
    let currentUnit = currentUnits[currentIndex]
    let nextUnit = nextUnits[nextIndex]

    if (
      currentUnit.kind !== 'node' ||
      nextUnit.kind !== 'node' ||
      getSiblingUnitKey(currentUnit) !== undefined ||
      getSiblingUnitKey(nextUnit) !== undefined ||
      !siblingUnitsComparable(currentUnit, nextUnit)
    ) {
      continue
    }

    used[currentIndex] = true
    matchIndexForNext[nextIndex] = currentIndex
  }

  let committed = new Array<SiblingUnit>(nextUnits.length)
  for (let i = 0; i < nextUnits.length; i++) {
    let matchIndex = matchIndexForNext[i]
    let nextUnit = nextUnits[i]
    if (matchIndex === -1) {
      committed[i] = nextUnit
      continue
    }

    let currentUnit = currentUnits[matchIndex]
    if (currentUnit.kind === 'node' && nextUnit.kind === 'node') {
      diffNode(currentUnit.node, nextUnit.node, context)
      committed[i] = currentUnit
      continue
    }

    invariant(currentUnit.kind !== 'node' && nextUnit.kind !== 'node', 'Expected boundaries')

    let replacement = getCommentMarkerRangeReplacement(
      currentUnit.start,
      nextUnit.start,
      currentNodes,
      nextNodes,
      currentUnit.startIndex,
      nextUnit.startIndex,
      context,
    )
    if (replacement) {
      replaceCommentMarkerRange(replacement, parent, context)
      committed[i] = nextUnit
      continue
    }

    let cursor = diffNode(currentUnit.start, nextUnit.start, context)
    if (!cursor && currentUnit.kind === 'frame' && nextUnit.kind === 'frame') {
      diffNodes(
        collectNodesBetween(currentUnit.start, currentUnit.end),
        nextNodes.slice(nextUnit.startIndex + 1, nextUnit.endIndex),
        {
          ...context,
          regionParent: parent,
          regionTailRef: currentUnit.end,
        },
      )
    }
    committed[i] = currentUnit
  }

  let anchor: Node | null = regionTailRef
  for (let i = committed.length - 1; i >= 0; i--) {
    let unit = committed[i]
    let first = getSiblingUnitFirstNode(unit)
    let ref = anchor?.parentNode === parent ? anchor : null

    if (
      unit.kind === 'node' &&
      isPreservedDomElement(unit.node) &&
      unit.node.parentNode === parent
    ) {
      anchor = unit.node
      continue
    }

    placeSiblingUnitBefore(unit, parent, ref)
    if (first.parentNode === parent) anchor = first
  }

  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i]) removeSiblingUnit(currentUnits[i], parent, context)
  }
}

function parseSiblingUnits(nodes: Node[]): SiblingUnit[] {
  let units: SiblingUnit[] = []

  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (isHydrationStartMarker(node)) {
      let endIndex = findHydrationEndMarkerIndex(nodes, i)
      invariant(endIndex > i, 'Hydration end marker not found')
      let end = nodes[endIndex]
      invariant(isHydrationEndMarker(end), 'Expected hydration end marker')
      units.push({ kind: 'hydration', start: node, end, startIndex: i, endIndex })
      i = endIndex
      continue
    }

    if (isFrameStartMarker(node)) {
      let endIndex = findFrameEndMarkerIndex(nodes, i)
      invariant(endIndex > i, 'Frame end marker not found')
      let end = nodes[endIndex]
      invariant(isFrameEndMarker(end), 'Expected frame end marker')
      units.push({ kind: 'frame', start: node, end, startIndex: i, endIndex })
      i = endIndex
      continue
    }

    invariant(!isHydrationEndMarker(node), 'Unexpected hydration end marker')
    invariant(!isFrameEndMarker(node), 'Unexpected frame end marker')
    units.push({ kind: 'node', node, startIndex: i, endIndex: i })
  }

  return units
}

function getSiblingUnitKey(unit: SiblingUnit): string | undefined {
  if (unit.kind !== 'node' || !isElement(unit.node)) return
  return unit.node.getAttribute('data-rmx-key') ?? undefined
}

function siblingUnitsComparable(current: SiblingUnit, next: SiblingUnit): boolean {
  if (current.kind !== next.kind) return false
  if (current.kind !== 'node' || next.kind !== 'node') return true
  return nodeTypesComparable(current.node, next.node)
}

function shouldPreserveBoundaryUnit(
  current: BoundarySiblingUnit,
  next: BoundarySiblingUnit,
  context: FrameContext,
): boolean {
  if (current.kind !== next.kind) return false
  return current.kind === 'frame'
    ? shouldPreserveFrameStartMarker(current.start, next.start, context)
    : shouldPreserveHydrationStartMarker(current.start, next.start, context)
}

function getSiblingUnitFirstNode(unit: SiblingUnit): Node {
  return unit.kind === 'node' ? unit.node : unit.start
}

function placeSiblingUnitBefore(unit: SiblingUnit, parent: ParentNode, ref: Node | null): void {
  if (unit.kind === 'node') {
    if (unit.node.parentNode !== parent || unit.node.nextSibling !== ref) {
      parent.insertBefore(unit.node, ref)
    }
    return
  }

  let nodes = collectNodeRange(unit.start, unit.end)
  if (unit.start.parentNode === parent && unit.end.nextSibling === ref) return

  let fragment = unit.start.ownerDocument.createDocumentFragment()
  for (let node of nodes) fragment.appendChild(node)
  parent.insertBefore(fragment, ref)
}

function removeSiblingUnit(unit: SiblingUnit, parent: ParentNode, context: FrameContext): void {
  if (unit.kind === 'node') {
    removeNode(unit.node, parent, context)
    return
  }

  for (let node of collectNodeRange(unit.start, unit.end)) {
    removeNode(node, parent, context)
  }
}

function collectNodesBetween(start: Comment, end: Comment): Node[] {
  let nodes: Node[] = []
  let node = start.nextSibling
  while (node && node !== end) {
    nodes.push(node)
    node = node.nextSibling
  }
  return nodes
}

function isPreservedDomElement(node: Node): node is Element {
  return isElement(node) && node.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)
}

function nodeTypesComparable(a: Node, b: Node): boolean {
  if (isTextNode(a) && isTextNode(b)) return true
  if (isElement(a) && isElement(b)) return a.tagName === b.tagName
  if (isCommentNode(a) && isCommentNode(b)) return markerKindsMatch(a, b)
  return false
}

function getMarkerKind(node: Node): MarkerKind | undefined {
  if (!isCommentNode(node)) return undefined
  if (isFrameStartMarker(node)) return 'frame-start'
  if (isFrameEndMarker(node)) return 'frame-end'
  if (isHydrationStartMarker(node)) return 'hydration-start'
  if (isHydrationEndMarker(node)) return 'hydration-end'
  return undefined
}

function markerKindsMatch(a: Node, b: Node): boolean {
  return getMarkerKind(a) === getMarkerKind(b)
}

function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

function shouldPreserveFrameStartMarker(
  current: Comment,
  next: Comment,
  context: FrameContext,
): boolean {
  if (!isFrameStartMarker(next)) return false

  let nextData = getFrameMarkerData(next, context)
  let currentFrame = context.frameInstances.get(current)

  return (
    currentFrame !== undefined &&
    nextData !== undefined &&
    currentFrame.matchesIdentity(nextData.src, nextData.name)
  )
}

function shouldPreserveHydrationStartMarker(
  current: Comment,
  next: Comment,
  context: FrameContext,
): boolean {
  if (!isHydrationStartMarker(next)) return false

  let currentOwner = getClientEntryBoundaryOwner(current)
  let nextData = getHydrationMarkerData(next, context)

  return (
    currentOwner !== undefined &&
    nextData !== undefined &&
    currentOwner.identity.moduleUrl === nextData.moduleUrl &&
    currentOwner.identity.exportName === nextData.exportName
  )
}

function getCommentMarkerRangeReplacement(
  current: Node,
  next: Node,
  currentNodes: Node[],
  nextNodes: Node[],
  currentIndex: number,
  nextIndex: number,
  context: FrameContext,
): CommentMarkerRangeReplacement | undefined {
  // Comment markers can represent owned DOM ranges, not standalone comments. If
  // the incoming range no longer has the same identity, replace the whole range
  // before regular node diffing mutates either marker.
  if (
    isFrameStartMarker(current) &&
    isFrameStartMarker(next) &&
    !shouldPreserveFrameStartMarker(current, next, context)
  ) {
    return {
      currentStart: current,
      nextStart: next,
      currentEndIndex: findFrameEndMarkerIndex(currentNodes, currentIndex),
      nextEndIndex: findFrameEndMarkerIndex(nextNodes, nextIndex),
    }
  }

  if (
    isHydrationStartMarker(current) &&
    isHydrationStartMarker(next) &&
    !shouldPreserveHydrationStartMarker(current, next, context)
  ) {
    return {
      currentStart: current,
      nextStart: next,
      currentEndIndex: findHydrationEndMarkerIndex(currentNodes, currentIndex),
      nextEndIndex: findHydrationEndMarkerIndex(nextNodes, nextIndex),
    }
  }
}

function getHydrationMarkerData(marker: Comment, context: FrameContext) {
  let id = getHydrationMarkerId(marker)
  return context.data.h?.[id]
}

function getFrameMarkerData(marker: Comment, context: FrameContext) {
  let id = getFrameMarkerId(marker)
  return context.data.f?.[id]
}

function replaceCommentMarkerRange(
  replacement: CommentMarkerRangeReplacement,
  parent: ParentNode,
  context: FrameContext,
): void {
  let currentEnd = findCommentMarkerRangeEnd(replacement.currentStart)
  let nextEnd = findCommentMarkerRangeEnd(replacement.nextStart)
  let nextNodes = collectNodeRange(replacement.nextStart, nextEnd)
  let currentNodes = collectNodeRange(replacement.currentStart, currentEnd)

  for (let node of nextNodes) {
    parent.insertBefore(node, replacement.currentStart)
  }

  for (let node of currentNodes) {
    removeNode(node, parent, context)
  }
}

function findCommentMarkerRangeEnd(start: Comment): Comment {
  if (isFrameStartMarker(start)) return getFrameEndMarker(start)
  if (isHydrationStartMarker(start)) return getHydrationEndMarker(start)
  throw new Error('Comment marker range start not found')
}

function collectNodeRange(start: Node, end: Node): Node[] {
  let nodes: Node[] = []
  let node: Node | null = start

  while (node) {
    nodes.push(node)
    if (node === end) break
    node = node.nextSibling
  }

  return nodes
}

function collectFrameContentFragment(
  doc: Document,
  start: Comment,
  end: Comment,
): DocumentFragment {
  let fragment = doc.createDocumentFragment()
  let node = start.nextSibling

  while (node && node !== end) {
    let next = node.nextSibling
    fragment.appendChild(node)
    node = next
  }

  return fragment
}

function removeNode(node: Node, parent: ParentNode, context: FrameContext): void {
  disposeRemovedVirtualRoots(node)
  disposeRemovedSubFrames(node, context)

  if (node.parentNode === parent) {
    parent.removeChild(node)
  }
}

function disposeRemovedVirtualRoots(node: Node): void {
  let stack: Node[] = [node]
  while (stack.length > 0) {
    let next = stack.pop()
    if (!next) continue

    if (isHydrationStartMarker(next) && disposeClientEntryBoundary(next)) {
      continue
    }

    for (let child of Array.from(next.childNodes)) {
      stack.push(child)
    }
  }
}

function disposeRemovedSubFrames(node: Node, context: FrameContext): void {
  let stack: Node[] = [node]
  while (stack.length > 0) {
    let next = stack.pop()
    if (!next) continue

    if (isFrameStartMarker(next)) {
      disposeFrameStartMarker(next, context)
    }

    for (let child of Array.from(next.childNodes)) {
      stack.push(child)
    }
  }
}

function disposeFrameStartMarker(marker: Comment, context: FrameContext): void {
  let subFrame = context.frameInstances.get(marker)
  if (subFrame) {
    subFrame.dispose()
    context.frameInstances.delete(marker)
  }
}
