import { invariant } from './invariant.ts'
import {
  canMoveBefore,
  excludePortalRanges,
  getStableIndexes,
  moveNodeBefore,
} from './reconcile.ts'
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
  return moduleUrl.replace(/^([^?#]*)\?([^#]*)/, (prefix: string, path: string, query: string) => {
    let segments = query.split('&')
    let kept = segments.filter((segment) => !HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN.test(segment))
    if (kept.length !== segments.length - 1) return prefix
    return kept.length ? path + '?' + kept.join('&') : path
  })
}

type NodeSiblingUnit = {
  kind?: never
  start: Node
  end?: never
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

// Sibling matching has already paired the elements by tag and split marker ranges into units.
function diffMatchedNode(current: Node, next: Node, context: FrameContext): void {
  if (isElement(current) && isElement(next)) {
    if (next.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)) {
      current.toggleAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE, true)
      return
    }
    diffElementAttributes(current, next)
    if (
      current instanceof HTMLTextAreaElement &&
      next instanceof HTMLTextAreaElement &&
      current.value !== next.value
    )
      return
    if (current.firstChild || next.firstChild) diffElementChildren(current, next, context)
  } else if (current.nodeValue !== next.nodeValue) {
    current.nodeValue = next.nodeValue
  }
}

export function diffElementAttributes(current: Element, next: Element): void {
  if (!current.hasAttributes() && !next.hasAttributes()) return
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
    let prevVal = readAttribute(current, name)
    let nextVal = readAttribute(next, name)
    if (prevVal !== nextVal) {
      if (shouldPreserveLiveAttribute(current, next, name)) continue
      current.setAttribute(name, nextVal == null ? '' : String(nextVal))
    }
  }
}

function readAttribute(node: Element, name: string) {
  return name === 'nonce' && 'nonce' in node ? node.nonce : node.getAttribute(name)
}

function shouldPreserveLiveAttribute(current: Element, next: Element, name: string): boolean {
  if (name === 'open') {
    if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement)
      return current.open !== next.open
    if (current instanceof HTMLDialogElement && next instanceof HTMLDialogElement)
      return current.open !== next.open
  }
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    if (name === 'checked') return current.checked !== next.checked
    if (name === 'value' && shouldPreserveInputValue(current)) return current.value !== next.value
  }
  if (
    name === 'selected' &&
    current instanceof HTMLOptionElement &&
    next instanceof HTMLOptionElement
  )
    return current.selected !== next.selected
  return name === 'popover' && isPopoverOpen(current) !== isPopoverOpen(next)
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
    regionTailRef = current.firstChild
    currentChildren = currentChildren.filter((node) => {
      if (shouldPreserveHeadNode(node)) return false
      regionTailRef = node.nextSibling
      return true
    })
  }
  diffNodes(currentChildren, Array.from(next.childNodes), context, current, regionTailRef)
}

export function diffNodes(
  currentNodes: Node[],
  nextNodes: Node[],
  context: FrameContext,
  parent = currentNodes[0]?.parentNode ?? context.regionParent,
  regionTailRef = context.regionTailRef ?? currentNodes.at(-1)?.nextSibling ?? null,
): void {
  invariant(parent, 'Parent node not found')
  let currentUnits = parseSiblingUnits(excludePortalRanges(currentNodes, parent), context, false)
  let nextUnits = parseSiblingUnits(nextNodes, context, true)
  matchSiblingUnits(currentUnits, nextUnits, isDocumentHead(parent))
  // Patch each matched unit and reuse its slot to record what will occupy this position.
  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i]
    let currentUnit = nextUnit.match
    if (!currentUnit) continue
    if (!currentUnit.kind) {
      diffMatchedNode(currentUnit.start, nextUnit.start, context)
      nextUnits[i] = currentUnit
      continue
    }

    invariant(nextUnit.kind, 'Expected boundary')

    // Updating an earlier sibling can synchronously change this boundary's owner.
    let activeKey = getBoundaryKey(currentUnit, context, false)
    if (activeKey === undefined || activeKey !== getBoundaryKey(nextUnit, context, true)) {
      let oldNodes = collectNodeRange(currentUnit.start, currentUnit.end, true)
      for (let node of collectNodeRange(nextUnit.start, nextUnit.end, true)) {
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
        // Move the original response nodes so runtime metadata remains associated with them.
        let fragment = createFragment(
          currentUnit.start.ownerDocument,
          collectNodeRange(nextUnit.start.nextSibling, nextUnit.end),
        )
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
          collectNodeRange(currentUnit.start.nextSibling, currentUnit.end),
          nextNodes.slice(nextUnit.startIndex + 1, nextUnit.endIndex),
          { ...context, regionParent: parent, regionTailRef: currentUnit.end },
        )
      }
    }
    nextUnits[i] = currentUnit
  }

  // Obsolete siblings must go before placement so surviving nodes keep focus.
  for (let current of currentUnits) {
    if (!current.match) removeSiblingUnit(current, parent, context)
  }

  let stable = getStableCommittedIndexes(nextUnits, parent)
  let anchor: Node | null = regionTailRef
  for (let i = nextUnits.length - 1; i >= 0; i--) {
    let unit = nextUnits[i]
    if (!stable.has(i))
      placeSiblingUnitBefore(unit, parent, anchor?.parentNode === parent ? anchor : null)
    if (unit.start.parentNode === parent) anchor = unit.start
  }
}

function matchSiblingUnits(
  currentUnits: SiblingUnit[],
  nextUnits: SiblingUnit[],
  inHead: boolean,
): void {
  function match(next: SiblingUnit, current: SiblingUnit) {
    next.match = current
    current.match = next
  }

  // Explicit keys keep the last old element. Repeated boundaries pair in source order.
  let keyed = new Map<string, SiblingUnit[]>()
  for (let i = currentUnits.length - 1; i >= 0; i--) {
    let unit = currentUnits[i]
    unit.currentIndex = i
    if (unit.key === undefined) continue
    let units = keyed.get(unit.key)
    if (!units) keyed.set(unit.key, [unit])
    else if (unit.kind) units.push(unit)
  }
  for (let next of nextUnits) {
    if (next.key === undefined) continue
    let units = keyed.get(next.key)
    if (units?.at(-1)?.start.nodeName === next.start.nodeName) {
      match(next, units.pop()!)
    }
  }

  let cursor = 0
  for (let next of nextUnits) {
    if (next.match) continue
    while (currentUnits[cursor]?.match) cursor++
    let current = currentUnits[cursor++]
    if (!current) break
    if (next.identity !== undefined && next.identity === current.identity) match(next, current)
  }

  // Head resources are routinely added or removed ahead of shared ones, which
  // shifts the shared ones out of positional pairing. Pair what is left in order
  // within each identity so they are reused instead of recreated. Outside the
  // head this could hand one element's live state, like typed input, to another.
  if (inHead) {
    let remaining = Map.groupBy(currentUnits.toReversed(), (unit) =>
      unit.match ? undefined : unit.identity,
    )
    for (let next of nextUnits) {
      if (next.match || next.identity === undefined) continue
      let current = remaining.get(next.identity)?.pop()
      if (current) match(next, current)
    }
  }
}

function isDocumentHead(node: ParentNode): boolean {
  return node === node.ownerDocument?.head
}

// Preserved elements never move, so any other unit can only stay in place if it
// already sits between the same preserved neighbors it needs to end up between.
function getStableCommittedIndexes(committed: SiblingUnit[], parent: ParentNode): Set<number> {
  let stable = new Set<number>()
  let matches: number[] = []
  let lower = -1
  let first = 0
  for (let end = 0; end <= committed.length; end++) {
    let unit = committed[end]
    if (unit && !(isPreservedDomElement(unit.start) && unit.start.parentNode === parent)) continue

    let upper = unit ? (unit.currentIndex ?? -1) : Infinity
    for (let i = first; i < end; i++) {
      let candidate = committed[i]
      let index = candidate.currentIndex ?? -1
      matches[i] =
        index > lower && index < upper && candidate.start.parentNode === parent ? index : -1
    }
    if (unit) {
      stable.add(end)
      matches[end] = -1
      lower = upper
      first = end + 1
    }
  }
  for (let index of getStableIndexes(matches)) stable.add(index)
  return stable
}

function getUnkeyedNodeIdentity(node: Node): string | undefined {
  if (node.nodeType === Node.TEXT_NODE || isCommentNode(node)) return node.nodeName
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

function parseSiblingUnits(nodes: Node[], context: FrameContext, incoming: boolean): SiblingUnit[] {
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
      start: node,
      key: key === undefined ? undefined : 'node:' + key,
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
    let depth = 1
    let endIndex = startIndex
    while (++endIndex < nodes.length) {
      let end = nodes[endIndex]
      if (isStart(end)) depth++
      else if (isEnd(end) && --depth === 0) {
        let unit: SiblingUnit = { kind, start, end, startIndex, endIndex }
        unit.key = getBoundaryKey(unit, context, incoming)
        units.push(unit)
        return endIndex
      }
    }
    invariant(
      false,
      kind === 'frame' ? 'Frame end marker not found' : 'Hydration end marker not found',
    )
  }

  return units
}

function getBoundaryKey(
  unit: BoundarySiblingUnit,
  context: FrameContext,
  incoming: boolean,
): string | undefined {
  let start = unit.start
  if (unit.kind === 'frame') {
    let frame = incoming
      ? getFrameMarkerData(start, context)
      : context.registry.instances.get(start)?.identity
    // Object keys keep frames separate from client-entry tuple keys and prefixed element keys.
    if (frame) return JSON.stringify({ src: frame.src, name: frame.name })
  } else {
    let entry = incoming
      ? context.data.h?.[getHydrationId(start)]
      : getClientEntryBoundaryOwner(start)?.identity
    if (entry) return getClientEntryKey(entry)
  }
}

function placeSiblingUnitBefore(unit: SiblingUnit, parent: ParentNode, ref: Node | null): void {
  if (unit.start.parentNode === parent && (unit.end ?? unit.start).nextSibling === ref) return
  if (!unit.kind) {
    moveNodeBefore(parent, unit.start, ref)
    return
  }

  let nodes = collectNodeRange(unit.start, unit.end, true)
  // Do not stage live ranges in a fragment: that would disconnect their contents
  // before moveBefore() can preserve their browser-managed state.
  if (nodes.every((node) => canMoveBefore(parent, node))) {
    for (let node of nodes) parent.moveBefore(node, ref)
    return
  }

  parent.insertBefore(createFragment(unit.start.ownerDocument, nodes), ref)
}

function createFragment(doc: Document, nodes: Node[]): DocumentFragment {
  let fragment = doc.createDocumentFragment()
  for (let node of nodes) fragment.appendChild(node)
  return fragment
}

function removeSiblingUnit(unit: SiblingUnit, parent: ParentNode, context: FrameContext): void {
  if (!unit.kind) {
    removeNode(unit.start, parent, context)
    return
  }

  for (let node of collectNodeRange(unit.start, unit.end, true)) {
    removeNode(node, parent, context)
  }
}

function isPreservedDomElement(node: Node): node is Element {
  return isElement(node) && node.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

function getFrameMarkerData(marker: Comment, context: FrameContext) {
  let id = getFrameId(marker)
  return context.data.f?.[id]
}

export function collectNodeRange(start: Node | null, end: Node, includeEnd = false): Node[] {
  let nodes: Node[] = []
  let node = start
  while (node && node !== end) {
    nodes.push(node)
    node = node.nextSibling
  }
  if (includeEnd && node) nodes.push(node)
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
