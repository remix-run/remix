import { invariant } from './invariant.ts'
import { excludePortalRanges, getStableIndexes } from './reconcile.ts'
import {
  getFrameId,
  getHydrationId,
  isCommentNode,
  isFrameEnd,
  isFrameStart,
  isHydrationEnd,
  isHydrationStart,
} from './stream-protocol.ts'
import type { FrameContext } from './frame.ts'
import {
  disposeClientEntryBoundary,
  getClientEntryBoundaryOwner,
  type ClientEntryIdentity,
} from './frame-runtime.ts'

const HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN = /^t=\d{13}$/

export function getClientEntryKey(identity: ClientEntryIdentity): string {
  return JSON.stringify([getClientEntryComparisonUrl(identity.moduleUrl), identity.exportName])
}

function getClientEntryComparisonUrl(moduleUrl: string): string {
  return moduleUrl.replace(/^[^?#]*\?([^#]*)/, (prefix: string, query: string) => {
    let segments = query.split('&')
    let matches = segments.filter((segment) => HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN.test(segment))
    if (matches.length !== 1) return prefix
    segments.splice(segments.indexOf(matches[0]), 1)
    let path = prefix.slice(0, prefix.indexOf('?'))
    return segments.length ? path + '?' + segments.join('&') : path
  })
}

type NodeSiblingUnit = {
  kind: 'node'
  start: Node
}

type BoundarySiblingUnit = {
  kind: 'frame' | 'hydration'
  start: Comment
  end: Comment
  startIndex: number
  endIndex: number
}

type SiblingUnit = (NodeSiblingUnit | BoundarySiblingUnit) & {
  key?: string
  identity?: string
  currentIndex?: number
  match?: SiblingUnit
}

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

// Sibling matching has already paired the elements by tag and split marker ranges into units.
function diffMatchedNode(current: Node, next: Node, context: FrameContext): void {
  if (isElement(current) && isElement(next)) {
    if (shouldPreserveDomElement(current, next)) return
    diffElementAttributes(current, next)
    if (!shouldPreserveElementChildren(current, next)) diffElementChildren(current, next, context)
  } else if (current.nodeValue !== next.nodeValue) {
    current.nodeValue = next.nodeValue
  }
}

export function diffElementAttributes(current: Element, next: Element): void {
  let prevAttrNames = current.getAttributeNames()
  let nextAttrNames = next.getAttributeNames()
  let preservedNames = next.getAttribute('data-rmx-preserve-attrs')?.split(/[\t\n\f\r ]+/)

  let nextNameSet = new Set(nextAttrNames)

  // Removals
  for (let name of prevAttrNames) {
    if (preservedNames?.includes(name)) continue
    if (!nextNameSet.has(name)) {
      if (shouldPreserveLiveAttribute(current, next, name)) continue
      current.removeAttribute(name)
    }
  }

  // Additions/updates
  for (let name of nextAttrNames) {
    if (preservedNames?.includes(name)) continue
    // Header CSP hides nonce attributes, but their IDL properties retain the value.
    let prevVal =
      name === 'nonce' && 'nonce' in current ? current.nonce : current.getAttribute(name)
    let nextVal = name === 'nonce' && 'nonce' in next ? next.nonce : next.getAttribute(name)
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
  return !['button', 'checkbox', 'hidden', 'image', 'radio', 'reset', 'submit'].includes(input.type)
}

function isPopoverOpen(element: Element): boolean {
  try {
    return element.matches(':popover-open')
  } catch {
    return false
  }
}

function diffElementChildren(current: Element, next: Element, context: FrameContext): void {
  let shouldPreserveHeadNode = context.shouldPreserveHeadNode
  let regionTailRef: ChildNode | null = null
  let currentChildren = Array.from(current.childNodes)
  if (shouldPreserveHeadNode && isDocumentHead(current)) {
    // Only preserved nodes after every diffed child can anchor the diff. Using a
    // leading one would move every diffed node in front of it.
    let lastDiffedIndex = currentChildren.findLastIndex((node) => !shouldPreserveHeadNode(node))
    regionTailRef = currentChildren[lastDiffedIndex + 1] ?? null
    currentChildren = currentChildren.filter((node) => !shouldPreserveHeadNode(node))
  }
  diffSiblingUnits(currentChildren, Array.from(next.childNodes), current, regionTailRef, context)
}

function diffSiblingUnits(
  currentNodes: Node[],
  nextNodes: Node[],
  parent: ParentNode,
  regionTailRef: ChildNode | null,
  context: FrameContext,
): void {
  let currentUnits = parseSiblingUnits(excludePortalRanges(currentNodes, parent))
  let nextUnits = parseSiblingUnits(nextNodes)
  matchSiblingUnits(currentUnits, nextUnits, isDocumentHead(parent), context)
  // Patch each matched unit and reuse its slot to record what will occupy this position.
  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i]
    let currentUnit = nextUnit.match
    if (!currentUnit) continue
    if (currentUnit.kind === 'node' && nextUnit.kind === 'node') {
      diffMatchedNode(currentUnit.start, nextUnit.start, context)
      nextUnits[i] = currentUnit
      continue
    }

    invariant(currentUnit.kind !== 'node' && nextUnit.kind !== 'node', 'Expected boundaries')

    // Comment markers can represent owned DOM ranges, not standalone comments. If
    // the incoming range no longer has the same identity, replace the whole range
    // before regular node diffing mutates either marker.
    if (!shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
      let oldNodes = collectNodeRange(currentUnit.start, currentUnit.end)
      for (let node of collectNodeRange(nextUnit.start, nextUnit.end)) {
        parent.insertBefore(node, currentUnit.start)
      }
      for (let node of oldNodes) removeNode(node, parent, context)
      continue
    }

    if (currentUnit.start.data !== nextUnit.start.data) currentUnit.start.data = nextUnit.start.data
    if (currentUnit.kind === 'frame') {
      let frame = context.registry.instances.get(currentUnit.start)
      let marker = getFrameMarkerData(nextUnit.start, context)
      if (frame && marker?.status === 'resolved') {
        let fragment = currentUnit.start.ownerDocument.createDocumentFragment()
        // Move the original response nodes so runtime metadata remains associated with them.
        for (let node of collectNodesBetween(nextUnit.start, nextUnit.end))
          fragment.appendChild(node)
        let render = frame.renderMarkerContent(
          { ...marker, id: getFrameId(nextUnit.start) },
          fragment,
          {
            reloadOrigin: context.reloadOrigin,
            nonce: context.nonce,
            navigationType: context.navigationType,
            from: context.from,
            data: context.data,
            signal: context.signal,
            reconciliationTracker: context.reconciliationTracker,
          },
        )
        context.reconciliationTracker?.waitFor(render)
      } else if (!frame?.isDisplayingResolvedContent()) {
        diffNodes(
          collectNodesBetween(currentUnit.start, currentUnit.end),
          nextNodes.slice(nextUnit.startIndex + 1, nextUnit.endIndex),
          { ...context, regionParent: parent, regionTailRef: currentUnit.end },
        )
      }
    }
    nextUnits[i] = currentUnit
  }

  // Obsolete siblings must go before placement so surviving nodes keep focus.
  for (let i = 0; i < currentUnits.length; i++) {
    if (currentUnits[i].currentIndex === undefined)
      removeSiblingUnit(currentUnits[i], parent, context)
  }

  let stable = getStableCommittedIndexes(nextUnits, parent)
  let anchor: Node | null = regionTailRef
  for (let i = nextUnits.length - 1; i >= 0; i--) {
    let unit = nextUnits[i]
    let first = unit.start
    let ref = anchor?.parentNode === parent ? anchor : null

    if (stable.has(i)) {
      anchor = first
      continue
    }

    placeSiblingUnitBefore(unit, parent, ref)
    if (first.parentNode === parent) anchor = first
  }
}

function matchSiblingUnits(
  currentUnits: SiblingUnit[],
  nextUnits: SiblingUnit[],
  inHead: boolean,
  context: FrameContext,
): void {
  function match(nextIndex: number, currentIndex: number): void {
    let current = currentUnits[currentIndex]
    current.currentIndex = currentIndex
    nextUnits[nextIndex].match = current
  }

  // Reserve globally matched keyed elements and semantic boundaries before
  // positionally pairing the remaining ordinary siblings.
  let keyToIndex = new Map<string, number>()

  for (let i = 0; i < currentUnits.length; i++) {
    let key = currentUnits[i].key
    if (key !== undefined) keyToIndex.set(key, i)
  }

  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i]
    let matchIndex = -1
    let key = nextUnit.key

    if (key !== undefined) {
      let keyedIndex = keyToIndex.get(key)
      if (
        keyedIndex !== undefined &&
        currentUnits[keyedIndex].currentIndex === undefined &&
        currentUnits[keyedIndex].start.nodeName === nextUnit.start.nodeName
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
        if (currentUnit.currentIndex !== undefined || currentUnit.kind !== nextUnit.kind) continue
        if (shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
          matchIndex = j
          break
        }
      }
    }

    if (matchIndex !== -1) match(i, matchIndex)
  }

  let cursor = 0
  for (let nextIndex = 0; nextIndex < nextUnits.length; nextIndex++) {
    if (nextUnits[nextIndex].match) continue
    while (currentUnits[cursor]?.currentIndex !== undefined) cursor++
    if (cursor === currentUnits.length) break
    let currentIndex = cursor++
    let currentUnit = currentUnits[currentIndex]
    let nextUnit = nextUnits[nextIndex]

    if (currentUnit.identity !== undefined && currentUnit.identity === nextUnit.identity) {
      match(nextIndex, currentIndex)
    }
  }

  // Head resources are routinely added or removed ahead of shared ones, which
  // shifts the shared ones out of positional pairing. Pair what is left in order
  // within each identity so they are reused instead of recreated. Outside the
  // head this could hand one element's live state, like typed input, to another.
  if (inHead) {
    let currentIndexesByIdentity = new Map<string, number[]>()
    for (let i = 0; i < currentUnits.length; i++) {
      let currentUnit = currentUnits[i]
      if (currentUnit.currentIndex !== undefined || currentUnit.identity === undefined) continue
      let identity = currentUnit.identity
      let indexes = currentIndexesByIdentity.get(identity)
      if (indexes) indexes.push(i)
      else currentIndexesByIdentity.set(identity, [i])
    }

    for (let i = 0; i < nextUnits.length; i++) {
      let nextUnit = nextUnits[i]
      if (nextUnit.match || nextUnit.identity === undefined) continue
      let currentIndex = currentIndexesByIdentity.get(nextUnit.identity)?.shift()
      if (currentIndex !== undefined) match(i, currentIndex)
    }
  }
}

function isDocumentHead(node: ParentNode): boolean {
  return isElement(node) && node === node.ownerDocument.head
}

// Preserved elements never move, so any other unit can only stay in place if it
// already sits between the same preserved neighbors it needs to end up between.
function getStableCommittedIndexes(committed: SiblingUnit[], parent: ParentNode): Set<number> {
  let stable = new Set<number>()
  let upperBounds = new Array<number>(committed.length)
  let upperBound = Infinity
  for (let i = committed.length - 1; i >= 0; i--) {
    upperBounds[i] = upperBound
    let unit = committed[i]
    if (
      unit.kind === 'node' &&
      isPreservedDomElement(unit.start) &&
      unit.start.parentNode === parent
    ) {
      stable.add(i)
      upperBound = unit.currentIndex ?? -1
    }
  }

  let committedIndexes: number[] = []
  let currentIndexes: number[] = []
  let lowerBound = -1
  for (let i = 0; i < committed.length; i++) {
    let matchIndex = committed[i].currentIndex ?? -1
    if (stable.has(i)) {
      lowerBound = matchIndex
      continue
    }
    if (
      matchIndex <= lowerBound ||
      matchIndex >= upperBounds[i] ||
      committed[i].start.parentNode !== parent
    ) {
      continue
    }
    committedIndexes.push(i)
    currentIndexes.push(matchIndex)
  }

  for (let index of getStableIndexes(currentIndexes)) {
    stable.add(committedIndexes[index])
  }
  return stable
}

function getUnkeyedNodeIdentity(node: Node): string | undefined {
  if (isTextNode(node)) return '#text'
  if (isCommentNode(node)) return '#comment'
  if (!isElement(node)) return undefined

  // A link's rel and href identify the resource it loads, and a meta tag's name
  // identifies what it describes. Morphing one into another would swap
  // stylesheets or start unrelated requests, so they are never paired.
  switch (node.tagName) {
    case 'LINK': {
      let rel = node.getAttribute('rel')?.trim().toLowerCase() ?? ''
      return `LINK:${rel}:${node.getAttribute('href') ?? ''}`
    }
    case 'META': {
      let name =
        node.getAttribute('name') ??
        node.getAttribute('property') ??
        node.getAttribute('http-equiv') ??
        (node.hasAttribute('charset') ? 'charset' : '')
      return `META:${name.toLowerCase()}`
    }
    default:
      return node.tagName
  }
}

function parseSiblingUnits(nodes: Node[]): SiblingUnit[] {
  let units: SiblingUnit[] = []

  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]
    if (isHydrationStart(node)) {
      i = addBoundary(node, i, 'hydration', isHydrationStart, isHydrationEnd)
      continue
    }
    if (isFrameStart(node)) {
      i = addBoundary(node, i, 'frame', isFrameStart, isFrameEnd)
      continue
    }
    invariant(!isHydrationEnd(node), 'Unexpected hydration end marker')
    invariant(!isFrameEnd(node), 'Unexpected frame end marker')
    let key = isElement(node) ? (node.getAttribute('data-rmx-key') ?? undefined) : undefined
    units.push({
      kind: 'node',
      start: node,
      key,
      identity: key === undefined ? getUnkeyedNodeIdentity(node) : undefined,
    })
  }

  function addBoundary(
    start: Comment,
    startIndex: number,
    kind: BoundarySiblingUnit['kind'],
    isStart: (node: Node) => boolean,
    isEnd: (node: Node) => node is Comment,
  ): number {
    let endIndex = findEndIndex(nodes, startIndex, isStart, isEnd)
    invariant(
      endIndex > startIndex,
      kind === 'frame' ? 'Frame end marker not found' : 'Hydration end marker not found',
    )
    let end = nodes[endIndex]
    invariant(
      isEnd(end),
      kind === 'frame' ? 'Expected frame end marker' : 'Expected hydration end marker',
    )
    units.push({ kind, start, end, startIndex, endIndex })
    return endIndex
  }

  return units
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

function placeSiblingUnitBefore(unit: SiblingUnit, parent: ParentNode, ref: Node | null): void {
  if (unit.kind === 'node') {
    if (unit.start.parentNode !== parent || unit.start.nextSibling !== ref) {
      parent.insertBefore(unit.start, ref)
    }
    return
  }

  if (unit.start.parentNode === parent && unit.end.nextSibling === ref) return

  let fragment = unit.start.ownerDocument.createDocumentFragment()
  for (let node of collectNodeRange(unit.start, unit.end)) fragment.appendChild(node)
  parent.insertBefore(fragment, ref)
}

function removeSiblingUnit(unit: SiblingUnit, parent: ParentNode, context: FrameContext): void {
  if (unit.kind === 'node') {
    removeNode(unit.start, parent, context)
    return
  }

  for (let node of collectNodeRange(unit.start, unit.end)) {
    removeNode(node, parent, context)
  }
}

function isPreservedDomElement(node: Node): node is Element {
  return isElement(node) && node.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)
}

function findEndIndex(
  nodes: Node[],
  startIndex: number,
  isStart: (node: Node) => boolean,
  isEnd: (node: Node) => boolean,
): number {
  let depth = 1

  for (let j = startIndex + 1; j < nodes.length; j++) {
    let node = nodes[j]
    if (isStart(node)) depth++
    else if (isEnd(node)) {
      depth--
      if (depth === 0) return j
    }
  }

  return startIndex
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
  let nextData = getFrameMarkerData(next, context)
  let currentFrame = context.registry.instances.get(current)

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
  let currentOwner = getClientEntryBoundaryOwner(current)
  let nextData = getHydrationMarkerData(next, context)

  return (
    currentOwner !== undefined &&
    nextData !== undefined &&
    getClientEntryKey(currentOwner.identity) === getClientEntryKey(nextData)
  )
}

function getHydrationMarkerData(marker: Comment, context: FrameContext) {
  let id = getHydrationId(marker)
  return context.data.h?.[id]
}

function getFrameMarkerData(marker: Comment, context: FrameContext) {
  let id = getFrameId(marker)
  return context.data.f?.[id]
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

function removeNode(node: Node, parent: ParentNode, context: FrameContext): void {
  visitSubtree(node, (next) => isHydrationStart(next) && disposeClientEntryBoundary(next))
  visitSubtree(node, (next) => {
    if (isFrameStart(next)) disposeFrameStartMarker(next, context)
  })

  if (node.parentNode === parent) {
    parent.removeChild(node)
  }
}

// A visitor returns true to skip the node's children.
function visitSubtree(node: Node, visit: (node: Node) => boolean | void): void {
  let stack: Node[] = [node]
  while (stack.length > 0) {
    let next = stack.pop()!
    if (visit(next)) continue

    for (let child of excludePortalRanges(Array.from(next.childNodes), next)) {
      stack.push(child)
    }
  }
}

function disposeFrameStartMarker(marker: Comment, context: FrameContext): void {
  let subFrame = context.registry.instances.get(marker)
  if (subFrame) {
    subFrame.dispose()
    context.registry.instances.delete(marker)
  }
}

export function findEndMarker(
  start: Comment,
  isStart: (node: Node) => boolean,
  isEnd: (node: Node) => node is Comment,
  message = 'End marker not found',
): Comment {
  let end = findOptionalEndMarker(start, isStart, isEnd)
  if (!end) throw new Error(message)
  return end
}

export function findOptionalEndMarker(
  start: Comment,
  isStart: (node: Node) => boolean,
  isEnd: (node: Node) => node is Comment,
): Comment | null {
  let depth = 1
  for (let node = start.nextSibling; node; node = node.nextSibling) {
    if (isStart(node)) depth++
    else if (isEnd(node) && --depth === 0) return node
  }
  return null
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
