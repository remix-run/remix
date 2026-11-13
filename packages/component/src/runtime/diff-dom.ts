import { invariant } from './invariant.ts'
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

type MarkerKind = 'frame-start' | 'frame-end' | 'virtual-root-start' | 'virtual-root-end'

type NodeSiblingUnit = {
  kind: 'node'
  node: Node
  clientOwned: boolean
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

type SiblingDiff = {
  parent: ParentNode
  currentNodes: Node[]
  nextNodes: Node[]
  currentUnits: SiblingUnit[]
  nextUnits: SiblingUnit[]
  used: boolean[]
  matchIndexForNext: number[]
}

const REMIX_PRESERVE_DOM_ATTRIBUTE = 'data-rmx-preserve-dom'
const REMIX_CLIENT_DOM_ATTRIBUTE = 'data-rmx-client-dom'

export function diffNodes(curr: Node[], next: Node[], context: FrameContext) {
  let parent = curr[0]?.parentNode ?? context.regionParent ?? null
  invariant(parent, 'Parent node not found')

  // When diffing a bounded region (e.g. between frame comments), we should insert new
  // nodes before the region tail ref rather than appending to the parent.
  let regionTailRef: ChildNode | null =
    context.regionTailRef ??
    (curr.length > 0 ? (curr[curr.length - 1].nextSibling as ChildNode | null) : null)

  // Frame regions rendered inside the head still hold head resources.
  if (isDocumentHead(parent)) diffHeadUnits(curr, next, parent, regionTailRef, context)
  else diffSiblingUnits(curr, next, parent, regionTailRef, context)
}

function diffNode(current: Node, next: Node, context: FrameContext): ChildNode | undefined {
  // Text -> Text
  if (isTextNode(current) && isTextNode(next)) {
    let newText = next.textContent || ''
    if (current.textContent !== newText) current.textContent = newText
    return
  }

  // Hydration marker range -> Hydration marker range
  if (isHydrationStart(current) && isHydrationStart(next)) {
    let nextData = next.data
    if (current.data !== nextData) {
      current.data = nextData
    }

    // Fast-forward across this hydrated region.
    return findHydrationEndMarker(next)
  }

  // Comment -> Comment
  if (isCommentNode(current) && isCommentNode(next) && markerKindsMatch(current, next)) {
    let newData = next.data
    if (isFrameStartMarker(current)) {
      if (shouldPreserveFrameStartMarker(current, next, context)) {
        if (current.data !== newData) {
          current.data = newData
        }

        let frame = context.frameInstances.get(current)
        let nextMarkerData = getFrameMarkerData(next, context)
        if (frame && nextMarkerData) {
          if (nextMarkerData.status === 'resolved') {
            let nextEnd = findFrameEndMarker(next)
            let nextContent = collectFrameContentFragment(current.ownerDocument, next, nextEnd)
            let render = frame.renderMarkerContent(
              { ...nextMarkerData, id: getFrameId(next) },
              nextContent,
              {
                nonce: context.nonce,
                transition: context.transition,
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
            return findFrameEndMarker(next)
          }
        }
      } else if (current.data !== newData) {
        disposeFrameStartMarker(current, context)
      }
    }
    if (current.data !== newData) {
      current.data = newData
    }
    return
  }

  // Same element tag: update attributes then children
  if (isElement(current) && isElement(next) && current.tagName === next.tagName) {
    if (shouldPreserveDomElement(current, next)) return
    diffElementAttributes(current, next)
    if (shouldPreserveElementChildren(current, next)) return
    diffElementChildren(current, next, context)
    return
  }

  // Different tags or type mismatch: replace
  let parent = current.parentNode
  if (parent) {
    parent.insertBefore(next, current)
    removeNode(current, parent, context)
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
  if (next.hasAttribute(REMIX_CLIENT_DOM_ATTRIBUTE)) {
    current.setAttribute(REMIX_CLIENT_DOM_ATTRIBUTE, '')
    return true
  }
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
  diffHeadUnits(currentChildren, Array.from(next.childNodes), head, regionTailRef, context)
}

function diffHeadUnits(
  currentNodes: Node[],
  nextNodes: Node[],
  head: ParentNode,
  regionTailRef: ChildNode | null,
  context: FrameContext,
): void {
  let diff = createSiblingDiff(currentNodes, nextNodes, head)
  matchKeyedSiblingUnits(diff, context)
  matchPositionalSiblingUnits(diff)
  matchShiftedHeadUnits(diff)
  let committed = commitSiblingUnits(diff, context)
  removeUnusedSiblingUnits(diff, context)
  placeSiblingUnits(diff, committed, regionTailRef)
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
  let committed = commitSiblingUnits(diff, context)
  removeUnusedSiblingUnits(diff, context)
  placeSiblingUnits(diff, committed, regionTailRef)
}

function createSiblingDiff(
  currentNodes: Node[],
  nextNodes: Node[],
  parent: ParentNode,
): SiblingDiff {
  let currentUnits = parseSiblingUnits(currentNodes, 'current')
  let nextUnits = parseSiblingUnits(nextNodes, 'next')
  return {
    parent,
    currentNodes,
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
    if (isClientOwnedUnit(currentUnits[i])) continue
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
}

function matchPositionalSiblingUnits(diff: SiblingDiff): void {
  let { currentUnits, nextUnits, used, matchIndexForNext } = diff

  let remainingCurrentIndexes: number[] = []
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i] && !isClientOwnedUnit(currentUnits[i])) {
      remainingCurrentIndexes.push(i)
    }
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
      getSiblingUnitKey(nextUnit) !== undefined
    ) {
      continue
    }

    let identity = getUnkeyedNodeIdentity(currentUnit.node)
    if (identity === undefined || identity !== getUnkeyedNodeIdentity(nextUnit.node)) continue

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
    if (
      used[i] ||
      currentUnit.kind !== 'node' ||
      currentUnit.clientOwned ||
      getSiblingUnitKey(currentUnit) !== undefined
    ) {
      continue
    }
    let identity = getUnkeyedNodeIdentity(currentUnit.node)
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
    let identity = getUnkeyedNodeIdentity(nextUnit.node)
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
  let { parent, currentNodes, nextNodes, currentUnits, nextUnits, matchIndexForNext } = diff
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

    // Comment markers can represent owned DOM ranges, not standalone comments. If
    // the incoming range no longer has the same identity, replace the whole range
    // before regular node diffing mutates either marker.
    if (!shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
      replaceCommentMarkerRange(currentUnit.start, nextUnit.start, parent, context)
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

  return committed
}

// Remove obsolete siblings before placement so they do not force surviving
// nodes to move and lose focus. Explicitly client-owned elements survive omission.
function removeUnusedSiblingUnits(diff: SiblingDiff, context: FrameContext): void {
  let { parent, currentUnits, used } = diff
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i] && !isClientOwnedUnit(currentUnits[i]))
      removeSiblingUnit(currentUnits[i], parent, context)
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
  let { parent, currentUnits, used } = diff
  let stable = getStableCommittedIndexes(diff, committed)

  // Unmatched client-owned elements stay in place. Insert before the trailing ones so
  // client-owned nodes keep trailing the region, instead of appending after them.
  let anchor: Node | null = regionTailRef
  for (let i = currentUnits.length - 1; i >= 0 && !used[i]; i--) {
    let unit = currentUnits[i]
    if (unit.kind === 'node' && isClientOwnedUnit(unit)) anchor = unit.node
  }

  for (let i = committed.length - 1; i >= 0; i--) {
    let unit = committed[i]
    let first = getSiblingUnitFirstNode(unit)
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
      isPreservedDomElement(unit.node) &&
      unit.node.parentNode === parent
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
      getSiblingUnitFirstNode(committed[i]).parentNode !== parent
    ) {
      continue
    }
    committedIndexes.push(i)
    currentIndexes.push(matchIndex)
  }

  for (let index of getLongestIncreasingSubsequence(currentIndexes)) {
    stable.add(committedIndexes[index])
  }
  return stable
}

// Returns the positions in `values` that form one longest strictly increasing
// subsequence, in O(n log n).
function getLongestIncreasingSubsequence(values: number[]): number[] {
  let tails: number[] = []
  let previous = new Array<number>(values.length).fill(-1)

  for (let i = 0; i < values.length; i++) {
    let low = 0
    let high = tails.length
    while (low < high) {
      let middle = (low + high) >> 1
      if (values[tails[middle]] < values[i]) low = middle + 1
      else high = middle
    }
    if (low > 0) previous[i] = tails[low - 1]
    tails[low] = i
  }

  let result = new Array<number>(tails.length)
  let index = tails.length > 0 ? tails[tails.length - 1] : -1
  for (let i = tails.length - 1; i >= 0; i--) {
    result[i] = index
    index = previous[index]
  }
  return result
}

function getUnkeyedNodeIdentity(node: Node): string | undefined {
  if (isTextNode(node)) return '#text'
  if (isCommentNode(node)) return `#comment:${getMarkerKind(node) ?? ''}`
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

function parseSiblingUnits(nodes: Node[], source: 'current' | 'next'): SiblingUnit[] {
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

    if (isFrameStartMarker(node)) {
      let endIndex = findEndIndex(nodes, i, isFrameStartMarker, isFrameEndMarker)
      invariant(endIndex > i, 'Frame end marker not found')
      let end = nodes[endIndex]
      invariant(isFrameEndMarker(end), 'Expected frame end marker')
      units.push({ kind: 'frame', start: node, end, startIndex: i, endIndex })
      i = endIndex
      continue
    }

    invariant(!isHydrationEnd(node), 'Unexpected hydration end marker')
    invariant(!isFrameEndMarker(node), 'Unexpected frame end marker')
    units.push({
      kind: 'node',
      node,
      clientOwned:
        source === 'current' && isElement(node) && node.hasAttribute(REMIX_CLIENT_DOM_ATTRIBUTE),
      startIndex: i,
      endIndex: i,
    })
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

function isClientOwnedUnit(unit: SiblingUnit): boolean {
  return unit.kind === 'node' && unit.clientOwned
}

function isPreservedDomElement(node: Node): node is Element {
  return (
    isElement(node) &&
    (node.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE) ||
      node.hasAttribute(REMIX_CLIENT_DOM_ATTRIBUTE))
  )
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
  if (isHydrationStart(node)) return 'virtual-root-start'
  if (isHydrationEnd(node)) return 'virtual-root-end'
  return undefined
}

function markerKindsMatch(a: Node, b: Node): boolean {
  return getMarkerKind(a) === getMarkerKind(b)
}

function findHydrationEndMarker(start: Comment): Comment {
  return findEndMarker(start, isHydrationStart, isHydrationEnd, 'Hydration end marker not found')
}

function findFrameEndMarker(start: Comment): Comment {
  return findEndMarker(start, isFrameStartMarker, isFrameEndMarker, 'Frame end marker not found')
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

function isFrameStartMarker(node: Node): node is Comment {
  return node instanceof Comment && node.data.trim().startsWith('rmx:f:')
}

function isFrameEndMarker(node: Node): node is Comment {
  return node instanceof Comment && node.data.trim() === '/rmx:f'
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

function getHydrationId(marker: Comment): string {
  let trimmed = marker.data.trim()
  invariant(trimmed.startsWith('rmx:h:'), 'Invalid hydration start marker')
  return trimmed.slice('rmx:h:'.length)
}

function getFrameMarkerData(marker: Comment, context: FrameContext) {
  let id = getFrameId(marker)
  return context.data.f?.[id]
}

function replaceCommentMarkerRange(
  currentStart: Comment,
  nextStart: Comment,
  parent: ParentNode,
  context: FrameContext,
): void {
  let currentEnd = findCommentMarkerRangeEnd(currentStart)
  let nextEnd = findCommentMarkerRangeEnd(nextStart)
  let nextNodes = collectNodeRange(nextStart, nextEnd)
  let currentNodes = collectNodeRange(currentStart, currentEnd)

  for (let node of nextNodes) {
    parent.insertBefore(node, currentStart)
  }

  for (let node of currentNodes) {
    removeNode(node, parent, context)
  }
}

function findCommentMarkerRangeEnd(start: Comment): Comment {
  if (isFrameStartMarker(start)) return findFrameEndMarker(start)
  if (isHydrationStart(start)) return findHydrationEndMarker(start)
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
  visitSubtree(node, (next) => isHydrationStart(next) && disposeClientEntryBoundary(next))
  visitSubtree(node, (next) => {
    if (isFrameStartMarker(next)) disposeFrameStartMarker(next, context)
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
