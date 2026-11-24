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

function getHmrTimestampQuerySegmentIndex(querySegments: string[]): number | null {
  let timestampIndex = -1

  for (let index = 0; index < querySegments.length; index++) {
    if (!HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN.test(querySegments[index])) continue
    if (timestampIndex !== -1) return null
    timestampIndex = index
  }

  return timestampIndex === -1 ? null : timestampIndex
}

function getClientEntryComparisonUrl(moduleUrl: string): string {
  let hashIndex = moduleUrl.indexOf('#')
  let urlWithoutHash = hashIndex === -1 ? moduleUrl : moduleUrl.slice(0, hashIndex)
  let hash = hashIndex === -1 ? '' : moduleUrl.slice(hashIndex)
  let queryIndex = urlWithoutHash.indexOf('?')
  if (queryIndex === -1) return moduleUrl

  let pathname = urlWithoutHash.slice(0, queryIndex)
  let query = urlWithoutHash.slice(queryIndex + 1)
  let querySegments = query.split('&')
  let timestampIndex = getHmrTimestampQuerySegmentIndex(querySegments)
  if (timestampIndex === null) return moduleUrl

  querySegments.splice(timestampIndex, 1)
  let comparisonQuery = querySegments.length > 0 ? `?${querySegments.join('&')}` : ''
  return `${pathname}${comparisonQuery}${hash}`
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

type SiblingUnit = NodeSiblingUnit | BoundarySiblingUnit

type SiblingDiff = {
  parent: ParentNode
  nextNodes: Node[]
  currentUnits: SiblingUnit[]
  nextUnits: SiblingUnit[]
  used: boolean[]
  matchIndexForNext: number[]
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
  if (isDocumentHead(current)) {
    diffHeadChildren(current, next, context)
    return
  }
  diffSiblingUnits(
    Array.from(current.childNodes),
    Array.from(next.childNodes),
    current,
    null,
    context,
  )
}

function diffHeadChildren(head: Element, next: Element, context: FrameContext): void {
  let shouldPreserveHeadNode = context.shouldPreserveHeadNode
  let regionTailRef: ChildNode | null = null
  let currentChildren = Array.from(head.childNodes)
  if (shouldPreserveHeadNode) {
    // Only preserved nodes after every diffed child can anchor the diff. Using a
    // leading one would move every diffed node in front of it.
    let lastDiffedIndex = currentChildren.findLastIndex((node) => !shouldPreserveHeadNode(node))
    regionTailRef = currentChildren[lastDiffedIndex + 1] ?? null
    currentChildren = currentChildren.filter((node) => !shouldPreserveHeadNode(node))
  }
  diffSiblingUnits(currentChildren, Array.from(next.childNodes), head, regionTailRef, context)
}

function diffSiblingUnits(
  currentNodes: Node[],
  nextNodes: Node[],
  parent: ParentNode,
  regionTailRef: ChildNode | null,
  context: FrameContext,
): void {
  let diff = createSiblingDiff(currentNodes, nextNodes, parent)
  matchKeyedSiblingUnits(diff, context)
  matchPositionalSiblingUnits(diff)
  if (isDocumentHead(parent)) matchShiftedHeadUnits(diff)
  let committed = commitSiblingUnits(diff, context)
  removeUnusedSiblingUnits(diff, context)
  placeSiblingUnits(diff, committed, regionTailRef)
}

function createSiblingDiff(
  currentNodes: Node[],
  nextNodes: Node[],
  parent: ParentNode,
): SiblingDiff {
  currentNodes = excludePortalRanges(currentNodes, parent)
  let currentUnits = parseSiblingUnits(currentNodes)
  let nextUnits = parseSiblingUnits(nextNodes)
  return {
    parent,
    nextNodes,
    currentUnits,
    nextUnits,
    used: new Array<boolean>(currentUnits.length).fill(false),
    matchIndexForNext: new Array<number>(nextUnits.length).fill(-1),
  }
}

// Reserve globally matched keyed elements and semantic boundaries before
// positionally pairing the remaining ordinary siblings.
function matchKeyedSiblingUnits(diff: SiblingDiff, context: FrameContext): void {
  let { currentUnits, nextUnits, used, matchIndexForNext } = diff
  let keyToIndex = new Map<string, number>()

  for (let i = 0; i < currentUnits.length; i++) {
    let key = getSiblingUnitKey(currentUnits[i])
    if (key !== undefined) keyToIndex.set(key, i)
  }

  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i]
    let matchIndex = -1
    let key = getSiblingUnitKey(nextUnit)

    if (key !== undefined) {
      let keyedIndex = keyToIndex.get(key)
      if (
        keyedIndex !== undefined &&
        !used[keyedIndex] &&
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
}

function matchPositionalSiblingUnits(diff: SiblingDiff): void {
  let { currentUnits, nextUnits, used, matchIndexForNext } = diff

  let cursor = 0
  for (let nextIndex = 0; nextIndex < nextUnits.length; nextIndex++) {
    if (matchIndexForNext[nextIndex] !== -1) continue
    while (used[cursor]) cursor++
    if (cursor === currentUnits.length) break
    let currentIndex = cursor++
    let currentUnit = currentUnits[currentIndex]
    let nextUnit = nextUnits[nextIndex]

    if (
      currentUnit.kind !== 'node' ||
      nextUnit.kind !== 'node' ||
      getSiblingUnitKey(currentUnit) !== undefined ||
      getSiblingUnitKey(nextUnit) !== undefined
    ) {
      continue
    }

    let identity = getUnkeyedNodeIdentity(currentUnit.start)
    if (identity === undefined || identity !== getUnkeyedNodeIdentity(nextUnit.start)) continue

    used[currentIndex] = true
    matchIndexForNext[nextIndex] = currentIndex
  }
}

// Head resources are routinely added or removed ahead of shared ones, which
// shifts the shared ones out of positional pairing. Pair what is left in order
// within each identity so they are reused instead of recreated. Outside the
// head this could hand one element's live state, like typed input, to another.
function matchShiftedHeadUnits(diff: SiblingDiff): void {
  let { currentUnits, nextUnits, used, matchIndexForNext } = diff
  let currentIndexesByIdentity = new Map<string, number[]>()
  for (let i = 0; i < currentUnits.length; i++) {
    let currentUnit = currentUnits[i]
    if (used[i] || currentUnit.kind !== 'node' || getSiblingUnitKey(currentUnit) !== undefined) {
      continue
    }
    let identity = getUnkeyedNodeIdentity(currentUnit.start)
    if (identity === undefined) continue
    let indexes = currentIndexesByIdentity.get(identity)
    if (indexes) indexes.push(i)
    else currentIndexesByIdentity.set(identity, [i])
  }

  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i]
    if (
      matchIndexForNext[i] !== -1 ||
      nextUnit.kind !== 'node' ||
      getSiblingUnitKey(nextUnit) !== undefined
    ) {
      continue
    }
    let identity = getUnkeyedNodeIdentity(nextUnit.start)
    if (identity === undefined) continue
    let currentIndex = currentIndexesByIdentity.get(identity)?.shift()
    if (currentIndex === undefined) continue
    used[currentIndex] = true
    matchIndexForNext[i] = currentIndex
  }
}

// Patches each matched current unit from its next unit and returns the units
// that will occupy each next position.
function commitSiblingUnits(diff: SiblingDiff, context: FrameContext): SiblingUnit[] {
  let { parent, nextNodes, currentUnits, nextUnits, matchIndexForNext } = diff
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
      diffMatchedNode(currentUnit.start, nextUnit.start, context)
      committed[i] = currentUnit
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
      committed[i] = nextUnit
      continue
    }

    if (currentUnit.start.data !== nextUnit.start.data) currentUnit.start.data = nextUnit.start.data
    if (currentUnit.kind === 'frame') {
      let frame = context.frameInstances.get(currentUnit.start)
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
    committed[i] = currentUnit
  }

  return committed
}

// Remove obsolete siblings before placement so they do not force surviving
// nodes to move and lose focus.
function removeUnusedSiblingUnits(diff: SiblingDiff, context: FrameContext): void {
  let { parent, currentUnits, used } = diff
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i]) removeSiblingUnit(currentUnits[i], parent, context)
  }
}

// Moving a node detaches it, which reloads stylesheets, restarts iframes and
// drops focus, so keep the longest run of reused units that are already in
// order where they are and only move the rest around them.
function placeSiblingUnits(
  diff: SiblingDiff,
  committed: SiblingUnit[],
  regionTailRef: ChildNode | null,
): void {
  let { parent } = diff
  let stable = getStableCommittedIndexes(diff, committed)
  let anchor: Node | null = regionTailRef
  for (let i = committed.length - 1; i >= 0; i--) {
    let unit = committed[i]
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

function isDocumentHead(node: ParentNode): boolean {
  return isElement(node) && node === node.ownerDocument.head
}

// Preserved elements never move, so any other unit can only stay in place if it
// already sits between the same preserved neighbors it needs to end up between.
function getStableCommittedIndexes(diff: SiblingDiff, committed: SiblingUnit[]): Set<number> {
  let { parent, currentUnits, matchIndexForNext } = diff
  let stable = new Set<number>()
  let upperBounds = new Array<number>(committed.length)
  let upperBound = currentUnits.length
  for (let i = committed.length - 1; i >= 0; i--) {
    upperBounds[i] = upperBound
    let unit = committed[i]
    if (
      unit.kind === 'node' &&
      isPreservedDomElement(unit.start) &&
      unit.start.parentNode === parent
    ) {
      stable.add(i)
      upperBound = matchIndexForNext[i]
    }
  }

  let committedIndexes: number[] = []
  let currentIndexes: number[] = []
  let lowerBound = -1
  for (let i = 0; i < committed.length; i++) {
    let matchIndex = matchIndexForNext[i]
    if (stable.has(i)) {
      lowerBound = matchIndex
      continue
    }
    if (
      matchIndex <= lowerBound ||
      matchIndex >= upperBounds[i] ||
      committed[i] !== currentUnits[matchIndex] ||
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
      let endIndex = findEndIndex(nodes, i, isHydrationStart, isHydrationEnd)
      invariant(endIndex > i, 'Hydration end marker not found')
      let end = nodes[endIndex]
      invariant(isHydrationEnd(end), 'Expected hydration end marker')
      units.push({ kind: 'hydration', start: node, end, startIndex: i, endIndex })
      i = endIndex
      continue
    }

    if (isFrameStart(node)) {
      let endIndex = findEndIndex(nodes, i, isFrameStart, isFrameEnd)
      invariant(endIndex > i, 'Frame end marker not found')
      let end = nodes[endIndex]
      invariant(isFrameEnd(end), 'Expected frame end marker')
      units.push({ kind: 'frame', start: node, end, startIndex: i, endIndex })
      i = endIndex
      continue
    }

    invariant(!isHydrationEnd(node), 'Unexpected hydration end marker')
    invariant(!isFrameEnd(node), 'Unexpected frame end marker')
    units.push({ kind: 'node', start: node })
  }

  return units
}

function getSiblingUnitKey(unit: SiblingUnit): string | undefined {
  if (unit.kind !== 'node' || !isElement(unit.start)) return
  return unit.start.getAttribute('data-rmx-key') ?? undefined
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

  let nodes = collectNodeRange(unit.start, unit.end)
  if (unit.start.parentNode === parent && unit.end.nextSibling === ref) return

  let fragment = unit.start.ownerDocument.createDocumentFragment()
  for (let node of nodes) fragment.appendChild(node)
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
  if (!isFrameStart(next)) return false

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
  if (!isHydrationStart(next)) return false

  let currentOwner = getClientEntryBoundaryOwner(current)
  let nextData = getHydrationMarkerData(next, context)

  return (
    currentOwner !== undefined &&
    nextData !== undefined &&
    getClientEntryKey(currentOwner.identity) ===
      getClientEntryKey({ moduleUrl: nextData.moduleUrl, exportName: nextData.exportName })
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
  let subFrame = context.frameInstances.get(marker)
  if (subFrame) {
    subFrame.dispose()
    context.frameInstances.delete(marker)
  }
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
