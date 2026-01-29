import { createContainer, TypedEventTarget, type EventsContainer } from '@remix-run/interaction'
import type { Component, ComponentHandle, FrameHandle } from './component.ts'
import { createComponent, Fragment, Frame, createFrameHandle } from './component.ts'
import { invariant } from './invariant.ts'
import { createDocumentState } from './document-state.ts'
import { processStyle, createStyleManager, normalizeCssValue } from './style/index.ts'
import type { ElementProps, RemixElement, RemixNode } from './jsx.ts'
import type {
  LayoutAnimationConfig,
  PresenceConfig,
  PresenceKeyframe,
  PresenceKeyframeConfig,
  AnimateProp,
} from './dom.ts'
import {
  captureLayoutSnapshots,
  applyLayoutAnimations,
  registerLayoutElement,
  updateLayoutElement,
  unregisterLayoutElement,
  markLayoutSubtreePending,
} from './layout-animation.ts'

let fixmeIdCounter = 0

export type VirtualRootEventMap = {
  error: ErrorEvent
}

export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
  render: (element: RemixNode) => void
  remove: () => void
  flush: () => void
}

export type VirtualRootOptions = {
  vParent?: VNode
  frame?: FrameHandle
  scheduler?: Scheduler
}

const TEXT_NODE = Symbol('TEXT_NODE')
const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

// Internal diffing flags (modeled after Preact)
const INSERT_VNODE = 1 << 0
const MATCHED = 1 << 1

// global so all roots share it
let styleCache = new Map<string, { selector: string; css: string }>()
let styleManager =
  typeof window !== 'undefined'
    ? createStyleManager()
    : (null as unknown as ReturnType<typeof createStyleManager>)

// Track nodes that are currently exiting (playing exit animation)
let exitingNodes = new Set<VNode>()

type VNodeType =
  | typeof ROOT_VNODE
  | string // host element
  | Function // component
  | typeof TEXT_NODE
  | typeof Fragment
  | typeof Frame

export type VNode<T extends VNodeType = VNodeType> = {
  type: T
  props?: ElementProps
  key?: string

  // _prefixes assigned during reconciliation
  _parent?: VNode
  _children?: VNode[]
  _dom?: unknown
  _events?: EventsContainer<EventTarget>
  _controller?: AbortController
  _svg?: boolean

  // Internal diffing fields
  _index?: number
  _flags?: number

  // TEXT_NODE
  _text?: string

  // Component
  _handle?: ComponentHandle
  _id?: string
  _content?: VNode

  // Presence animation
  _animation?: Animation
  _exiting?: boolean
  _exitingParent?: ParentNode
}

type FragmentNode = VNode & {
  type: typeof Fragment
  _children: VNode[]
}

type TextNode = VNode & {
  type: typeof TEXT_NODE
  _text: string
}

type CommittedTextNode = TextNode & {
  _dom: Text
}

type HostNode = VNode & {
  type: string
  props: ElementProps
  _children: VNode[]
}

type CommittedHostNode = HostNode & {
  _dom: Element
  _controller?: AbortController
  _events?: EventsContainer<EventTarget>
}

type ComponentNode = VNode & {
  type: Function
  props: ElementProps
  _handle: ComponentHandle
}

type CommittedComponentNode = VNode & {
  type: Function
  props: ElementProps
  _content: VNode
  _handle: ComponentHandle
}

type EmptyFn = () => void

export type Scheduler = ReturnType<typeof createScheduler>

export function createScheduler(doc: Document, rootTarget: EventTarget) {
  let documentState = createDocumentState(doc)
  let scheduled = new Map<CommittedComponentNode, [ParentNode, Node | undefined]>()
  let tasks: EmptyFn[] = []
  let flushScheduled = false
  let scheduler: {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode, anchor?: Node): void
    enqueueTasks(newTasks: EmptyFn[]): void
    dequeue(): void
  }

  function dispatchError(error: unknown) {
    rootTarget.dispatchEvent(new ErrorEvent('error', { error }))
  }

  function flush() {
    flushScheduled = false

    let batch = new Map(scheduled)
    scheduled.clear()

    let hasWork = batch.size > 0 || tasks.length > 0
    if (!hasWork) return

    // Mark layout elements within updating components as pending BEFORE capture
    // This ensures we only capture/apply for elements whose components are updating
    if (batch.size > 0) {
      for (let [, [domParent]] of batch) {
        markLayoutSubtreePending(domParent)
      }
    }

    // Capture layout snapshots BEFORE any DOM work (for FLIP animations)
    captureLayoutSnapshots()

    documentState.capture()

    if (batch.size > 0) {
      let vnodes = Array.from(batch)
      let noScheduledAncestor = new Set<VNode>()

      for (let [vnode, [domParent, anchor]] of vnodes) {
        if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue
        let handle = vnode._handle
        let curr = vnode._content
        let vParent = vnode._parent!
        try {
          renderComponent(
            handle,
            curr,
            vnode,
            domParent,
            handle.frame,
            scheduler,
            rootTarget,
            vParent,
            anchor,
          )
        } catch (error) {
          dispatchError(error)
        }
      }
    }

    // restore before user tasks so users can move focus/selection etc.
    documentState.restore()

    // Apply FLIP layout animations AFTER DOM work, BEFORE user tasks
    applyLayoutAnimations()

    if (tasks.length > 0) {
      for (let task of tasks) {
        try {
          task()
        } catch (error) {
          dispatchError(error)
        }
      }
      tasks = []
    }
  }

  function scheduleFlush() {
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(flush)
  }

  function ancestorIsScheduled(
    vnode: VNode,
    batch: Map<CommittedComponentNode, [ParentNode, Node | undefined]>,
    safe: Set<VNode>,
  ): boolean {
    let path: VNode[] = []
    let current = vnode._parent

    while (current) {
      // Already verified this node has no scheduled ancestor above it
      if (safe.has(current)) {
        for (let node of path) safe.add(node)
        return false
      }

      path.push(current)

      if (isCommittedComponentNode(current) && batch.has(current)) {
        return true
      }

      current = current._parent
    }

    // Reached root - mark entire path as safe for future lookups
    for (let node of path) safe.add(node)
    return false
  }

  scheduler = {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode, anchor?: Node): void {
      scheduled.set(vnode, [domParent, anchor])
      scheduleFlush()
    },

    enqueueTasks(newTasks: EmptyFn[]): void {
      tasks.push(...newTasks)
      scheduleFlush()
    },

    dequeue() {
      flush()
    },
  }

  return scheduler
}

const ROOT_VNODE = Symbol('ROOT_VNODE')

export function createRangeRoot(
  [start, end]: [Node, Node],
  options: VirtualRootOptions = {},
): VirtualRoot {
  let vroot: VNode | null = null
  let frameStub = options.frame ?? createFrameHandle()

  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(end.parentNode === container, 'Boundaries must share parent')

  let hydrationCursor = start.nextSibling

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget)

  // Forward bubbling error events from DOM to root EventTarget
  container.addEventListener('error', (event) => {
    eventTarget.dispatchEvent(new ErrorEvent('error', { error: (event as ErrorEvent).error }))
  })

  return Object.assign(eventTarget, {
    render(element: RemixNode) {
      let vnode = toVNode(element)
      let vParent: VNode = { type: ROOT_VNODE, _svg: false }
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            vroot,
            vnode,
            container,
            frameStub,
            scheduler,
            vParent,
            eventTarget,
            end,
            hydrationCursor,
          )
          vroot = vnode
          hydrationCursor = null
        },
      ])
      scheduler.dequeue()
    },

    remove() {
      vroot = null
    },

    flush() {
      scheduler.dequeue()
    },
  })
}

export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let vroot: VNode | null = null
  let frameStub = options.frame ?? createFrameHandle()
  let hydrationCursor = container.innerHTML.trim() !== '' ? container.firstChild : undefined

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget)

  // Forward bubbling error events from DOM to root EventTarget
  container.addEventListener('error', (event) => {
    eventTarget.dispatchEvent(new ErrorEvent('error', { error: (event as ErrorEvent).error }))
  })

  return Object.assign(eventTarget, {
    render(element: RemixNode) {
      let vnode = toVNode(element)
      let vParent: VNode = { type: ROOT_VNODE, _svg: false }
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            vroot,
            vnode,
            container,
            frameStub,
            scheduler,
            vParent,
            eventTarget,
            undefined,
            hydrationCursor,
          )
          vroot = vnode
          hydrationCursor = undefined
        },
      ])
      scheduler.dequeue()
    },

    remove() {
      vroot = null
    },

    flush() {
      scheduler.dequeue()
    },
  })
}

function flatMapChildrenToVNodes(node: RemixElement): VNode[] {
  return 'children' in node.props
    ? Array.isArray(node.props.children)
      ? node.props.children.flat(Infinity).map(toVNode)
      : [toVNode(node.props.children)]
    : []
}

function flattenRemixNodeArray(nodes: RemixNode[], out: RemixNode[] = []): RemixNode[] {
  for (let child of nodes) {
    if (Array.isArray(child)) {
      flattenRemixNodeArray(child, out)
    } else {
      out.push(child)
    }
  }
  return out
}

export function toVNode(node: RemixNode): VNode {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return { type: TEXT_NODE, _text: '' }
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return { type: TEXT_NODE, _text: String(node) }
  }

  if (Array.isArray(node)) {
    let flatChildren = flattenRemixNodeArray(node)
    return { type: Fragment, _children: flatChildren.map(toVNode) }
  }

  if (node.type === Fragment) {
    return { type: Fragment, key: node.key, _children: flatMapChildrenToVNodes(node) }
  }

  if (isRemixElement(node)) {
    // When innerHTML is set, ignore children
    let children = node.props.innerHTML != null ? [] : flatMapChildrenToVNodes(node)
    return { type: node.type, key: node.key, props: node.props, _children: children }
  }

  invariant(false, 'Unexpected RemixNode')
}

export function diffVNodes(
  curr: VNode | null,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  rootCursor?: Node | null,
): Node | null | undefined {
  next._parent = vParent // set parent for initial render context lookups
  next._svg = getSvgContext(vParent, next.type)

  // new
  if (curr === null) {
    return insert(next, domParent, frame, scheduler, vParent, rootTarget, anchor, rootCursor)
  }

  if (curr.type !== next.type) {
    replace(curr, next, domParent, frame, scheduler, vParent, rootTarget, anchor)
    return rootCursor
  }

  if (isCommittedTextNode(curr) && isTextNode(next)) {
    diffText(curr, next, vParent)
    return rootCursor
  }

  if (isCommittedHostNode(curr) && isHostNode(next)) {
    diffHost(curr, next, domParent, frame, scheduler, vParent, rootTarget)
    return rootCursor
  }

  if (isCommittedComponentNode(curr) && isComponentNode(next)) {
    diffComponent(curr, next, frame, scheduler, domParent, vParent, rootTarget)
    return rootCursor
  }

  if (isFragmentNode(curr) && isFragmentNode(next)) {
    diffChildren(
      curr._children,
      next._children,
      domParent,
      frame,
      scheduler,
      vParent,
      rootTarget,
      undefined,
      anchor,
    )
    return rootCursor
  }

  if (curr.type === Frame && next.type === Frame) {
    throw new Error('TODO: Frame diff not implemented')
  }

  invariant(false, 'Unexpected diff case')
}

function replace(
  curr: VNode,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
) {
  anchor =
    anchor || findFirstDomAnchor(curr) || findNextSiblingDomAnchor(curr, curr._parent) || undefined
  insert(next, domParent, frame, scheduler, vParent, rootTarget, anchor)
  remove(curr, domParent, scheduler)
}

function diffHost(
  curr: CommittedHostNode,
  next: HostNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
) {
  // Handle innerHTML prop BEFORE diffChildren to avoid clearing children
  if (next.props.innerHTML != null) {
    // innerHTML is set, update it if changed
    if (curr.props.innerHTML !== next.props.innerHTML) {
      curr._dom.innerHTML = next.props.innerHTML
    }
  } else if (curr.props.innerHTML != null) {
    // innerHTML was removed, clear it before adding children
    curr._dom.innerHTML = ''
  }

  diffChildren(curr._children, next._children, curr._dom, frame, scheduler, next, rootTarget)
  diffHostProps(curr.props, next.props, curr._dom)

  next._dom = curr._dom
  next._parent = vParent
  next._controller = curr._controller

  let nextOn = next.props.on
  if (nextOn) {
    if (curr._events) {
      // Update existing container
      next._events = curr._events
      let eventsContainer = curr._events
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
    } else {
      // Create new container
      let eventsContainer = createContainer(curr._dom)
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
      next._events = eventsContainer
    }
  } else if (curr._events) {
    // Dispose old container since next has no on prop
    let eventsContainer = curr._events
    scheduler.enqueueTasks([() => eventsContainer.dispose()])
  }
  // If neither has on, do nothing - no _events to set

  // Update layout animation registration
  let nextPresenceConfig = getPresenceConfig(next)
  let currPresenceConfig = getPresenceConfig(curr)
  if (nextPresenceConfig?.layout) {
    updateLayoutElement(curr._dom, nextPresenceConfig.layout)
  } else if (currPresenceConfig?.layout) {
    unregisterLayoutElement(curr._dom)
  }

  return
}

function setupHostNode(node: HostNode, dom: Element, scheduler: Scheduler): void {
  node._dom = dom

  let on = node.props.on
  if (on) {
    let eventsContainer = createContainer(dom)
    scheduler.enqueueTasks([() => eventsContainer.set(on)])
    node._events = eventsContainer
  }

  let connect = node.props.connect
  let presenceConfig = getPresenceConfig(node)
  let playEnter = shouldPlayEnterAnimation(presenceConfig?.enter)

  // Register for layout animations if configured
  if (presenceConfig?.layout) {
    registerLayoutElement(dom, presenceConfig.layout)
  }

  // Schedule connect callback first, then enter animation plays after
  if (connect) {
    // Only create controller if connect callback expects a signal (length >= 2)
    if (connect.length >= 2) {
      let controller = new AbortController()
      node._controller = controller
      scheduler.enqueueTasks([
        () => {
          connect(dom, controller.signal)
          // Play enter animation after connect
          if (playEnter) {
            playEnterAnimation(node as CommittedHostNode, presenceConfig!.enter!)
          }
        },
      ])
    } else {
      scheduler.enqueueTasks([
        () => {
          connect(dom)
          // Play enter animation after connect
          if (playEnter) {
            playEnterAnimation(node as CommittedHostNode, presenceConfig!.enter!)
          }
        },
      ])
    }
  } else if (playEnter) {
    // No connect, but has animate - play enter animation
    scheduler.enqueueTasks([
      () => {
        playEnterAnimation(node as CommittedHostNode, presenceConfig!.enter!)
      },
    ])
  }
}

function diffCssProp(curr: ElementProps, next: ElementProps, dom: Element) {
  let prevSelector = curr.css ? processStyle(curr.css, styleCache).selector : ''
  let { selector: nextSelector, css } = next.css
    ? processStyle(next.css, styleCache)
    : { selector: '', css: '' }

  if (prevSelector === nextSelector) return

  // Remove old CSS
  if (prevSelector) {
    dom.removeAttribute('data-css')
    styleManager.remove(prevSelector)
  }

  // Add new CSS
  if (css && nextSelector) {
    dom.setAttribute('data-css', nextSelector)
    styleManager.insert(nextSelector, css)
  }
}

function diffHostProps(curr: ElementProps, next: ElementProps, dom: Element) {
  let isSvg = dom.namespaceURI === SVG_NS

  if (next.css || curr.css) {
    diffCssProp(curr, next, dom)
  }

  // Removals
  for (let name in curr) {
    if (isFrameworkProp(name)) continue
    if (!(name in next) || next[name] == null) {
      // Prefer property clearing when applicable (align with Preact)
      if (canUseProperty(dom, name, isSvg)) {
        try {
          dom[name] = ''
          continue
        } catch {}
      }

      let { ns, attr } = normalizePropName(name, isSvg)
      if (ns) dom.removeAttributeNS(ns, attr)
      else dom.removeAttribute(attr)
    }
  }

  // Additions/updates
  for (let name in next) {
    if (isFrameworkProp(name)) continue
    let nextValue = next[name]
    if (nextValue == null) continue
    let prevValue = curr[name]
    if (prevValue !== nextValue) {
      let { ns, attr } = normalizePropName(name, isSvg)

      // Object style: serialize to attribute for now
      if (
        attr === 'style' &&
        typeof nextValue === 'object' &&
        nextValue &&
        !Array.isArray(nextValue)
      ) {
        dom.setAttribute('style', serializeStyleObject(nextValue))
        continue
      }

      // Prefer property assignment when possible (HTML only, not SVG)
      if (canUseProperty(dom, name, isSvg)) {
        try {
          dom[name] = nextValue == null ? '' : nextValue
          continue
        } catch {}
      }

      // Attribute path
      if (typeof nextValue === 'function') {
        // Never serialize functions as attribute values
        continue
      }

      let isAriaOrData = name.startsWith('aria-') || name.startsWith('data-')
      if (nextValue != null && (nextValue !== false || isAriaOrData)) {
        // Special-case popover: true => presence only
        let attrValue = name === 'popover' && nextValue === true ? '' : String(nextValue)
        if (ns) dom.setAttributeNS(ns, attr, attrValue)
        else dom.setAttribute(attr, attrValue)
      } else {
        if (ns) dom.removeAttributeNS(ns, attr)
        else dom.removeAttribute(attr)
      }
    }
  }
}

// Preact excludes certain attributes from the property path due to browser quirks
const ATTRIBUTE_FALLBACK_NAMES = new Set([
  'width',
  'height',
  'href',
  'list',
  'form',
  'tabIndex',
  'download',
  'rowSpan',
  'colSpan',
  'role',
  'popover',
])

// Determine if we should use the property path for a given name.
// Also acts as a type guard to allow bracket assignment without casts.
function canUseProperty(
  dom: Element,
  name: string,
  isSvg: boolean,
): dom is Element & Record<string, unknown> {
  if (isSvg) return false
  if (ATTRIBUTE_FALLBACK_NAMES.has(name)) return false
  return name in dom
}

function isComponentNode(node: VNode): node is ComponentNode {
  return typeof node.type === 'function' && node.type !== Frame
}

function isCommittedComponentNode(node: VNode): node is CommittedComponentNode {
  return isComponentNode(node) && node._content !== undefined
}

function isFrameworkProp(name: string): boolean {
  return (
    name === 'children' ||
    name === 'key' ||
    name === 'on' ||
    name === 'css' ||
    name === 'setup' ||
    name === 'connect' ||
    name === 'animate' ||
    name === 'innerHTML'
  )
}

// TODO: would rather actually diff el.style object directly instead of writing
// to the style attribute
function serializeStyleObject(style: Record<string, unknown>): string {
  let parts: string[] = []
  for (let [key, value] of Object.entries(style)) {
    if (value == null) continue
    if (typeof value === 'boolean') continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue

    let cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

    let cssValue = Array.isArray(value)
      ? (value as unknown[]).join(', ')
      : normalizeCssValue(key, value)

    parts.push(`${cssKey}: ${cssValue};`)
  }
  return parts.join(' ')
}

// Compute SVG context for a node based on its parent and type.
// Returns true if the node is within an SVG subtree, false otherwise.
function getSvgContext(vParent: VNode, nodeType: VNodeType): boolean {
  // Only host elements (strings) can affect SVG context
  if (typeof nodeType === 'string') {
    // svg element creates SVG context
    if (nodeType === 'svg') return true
    // foreignObject switches back to HTML context
    if (nodeType === 'foreignObject') return false
  }
  // Otherwise inherit from parent
  return vParent._svg ?? false
}

function normalizePropName(name: string, isSvg: boolean): { ns?: string; attr: string } {
  // aria-/data- pass through
  if (name.startsWith('aria-') || name.startsWith('data-')) return { attr: name }

  // DOM property -> HTML mappings
  if (!isSvg) {
    if (name === 'className') return { attr: 'class' }
    if (name === 'htmlFor') return { attr: 'for' }
    if (name === 'tabIndex') return { attr: 'tabindex' }
    if (name === 'acceptCharset') return { attr: 'accept-charset' }
    if (name === 'httpEquiv') return { attr: 'http-equiv' }
    return { attr: name.toLowerCase() }
  }

  // SVG namespaced specials
  if (name === 'xlinkHref') return { ns: XLINK_NS, attr: 'xlink:href' }
  if (name === 'xmlLang') return { ns: XML_NS, attr: 'xml:lang' }
  if (name === 'xmlSpace') return { ns: XML_NS, attr: 'xml:space' }

  // SVG preserved-case exceptions
  if (
    name === 'viewBox' ||
    name === 'preserveAspectRatio' ||
    name === 'gradientUnits' ||
    name === 'gradientTransform' ||
    name === 'patternUnits' ||
    name === 'patternTransform' ||
    name === 'clipPathUnits' ||
    name === 'maskUnits' ||
    name === 'maskContentUnits'
  ) {
    return { attr: name }
  }

  // General SVG: kebab-case
  return { attr: camelToKebab(name) }
}

function camelToKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

function diffText(curr: CommittedTextNode, next: TextNode, vParent: VNode) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text
  }
  next._dom = curr._dom
  next._parent = vParent
}

function logHydrationMismatch(...msg: any[]) {
  console.error('Hydration mismatch:', ...msg)
}

function insert(
  node: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  node._parent = vParent // set parent for initial render context lookups
  node._svg = getSvgContext(vParent, node.type)

  // Stop hydration if cursor has reached the anchor (end boundary)
  // Check BEFORE skipComments to prevent escaping range root markers
  if (cursor && anchor && cursor === anchor) {
    cursor = null
  }

  cursor = skipComments(cursor ?? null)

  // Also check after skipComments in case we skipped past the anchor
  if (cursor && anchor && cursor === anchor) {
    cursor = null
  }

  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

  if (isTextNode(node)) {
    if (cursor instanceof Text) {
      node._parent = vParent
      // Handle text node consolidation: server renders adjacent text as single node
      // e.g., <span>Hello {world}</span> → server: "Hello world", client: ["Hello ", "world"]
      if (cursor.data !== node._text) {
        if (cursor.data.startsWith(node._text) && node._text.length < cursor.data.length) {
          // Consolidation case: split the text node at the boundary
          // cursor becomes the first part (node._text), remainder is returned for next vnode
          let remainder = cursor.splitText(node._text.length)
          node._dom = cursor
          return remainder
        }
        // Genuine mismatch - correct it
        logHydrationMismatch('text mismatch', cursor.data, node._text)
        cursor.data = node._text
      }
      node._dom = cursor
      return cursor.nextSibling
    }
    let dom = document.createTextNode(node._text)
    node._dom = dom
    node._parent = vParent
    doInsert(dom)
    return cursor
  }

  if (isHostNode(node)) {
    // Check for matching exiting node that can be reclaimed
    let exitingNode = findMatchingExitingNode(node.type, node.key, domParent)
    if (exitingNode) {
      reclaimExitingNode(exitingNode, node, domParent, frame, scheduler, vParent, rootTarget)
      return cursor
    }

    if (cursor instanceof Element) {
      // SVG elements have case-sensitive tag names (e.g. linearGradient, clipPath)
      // HTML elements are case-insensitive, so we lowercase for comparison
      let cursorTag = node._svg ? cursor.tagName : cursor.tagName.toLowerCase()
      if (cursorTag === node.type) {
        // FIXME: hydrate css prop
        // correct hydration mismatches
        diffHostProps({}, node.props, cursor)

        // Handle innerHTML prop
        if (node.props.innerHTML != null) {
          cursor.innerHTML = node.props.innerHTML
        } else {
          let childCursor = cursor.firstChild
          // FIXME: this breaks other tests
          // if (node._children.length > 1 && node._children.every(isTextNode)) {
          //   // special case <span>Text {text}</span> comes as single node from server
          //   return cursor.nextSibling
          // }
          // Ignore excess nodes - browser extensions may inject content
          diffChildren(
            null,
            node._children,
            cursor,
            frame,
            scheduler,
            node,
            rootTarget,
            childCursor,
          )
        }

        setupHostNode(node, cursor, scheduler)
        return cursor.nextSibling
      } else {
        // Type mismatch - try single-advance retry to handle browser extension injections
        // at the start of containers. Skip this node and try the next sibling once.
        let nextSibling = skipComments(cursor.nextSibling)
        if (nextSibling instanceof Element) {
          let nextTag = node._svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase()
          if (nextTag === node.type) {
            // Found a match after skipping - adopt it and leave skipped node in place
            diffHostProps({}, node.props, nextSibling)

            if (node.props.innerHTML != null) {
              nextSibling.innerHTML = node.props.innerHTML
            } else {
              let childCursor = nextSibling.firstChild
              diffChildren(
                null,
                node._children,
                nextSibling,
                frame,
                scheduler,
                node,
                rootTarget,
                childCursor,
              )
            }

            setupHostNode(node, nextSibling, scheduler)
            return nextSibling.nextSibling
          }
        }
        // Retry failed - log mismatch and create new element (don't remove mismatched nodes)
        logHydrationMismatch('tag', cursorTag, node.type)
        cursor = undefined // stop hydration for this tree
      }
    }
    let dom = node._svg
      ? document.createElementNS(SVG_NS, node.type)
      : document.createElement(node.type)
    diffHostProps({}, node.props, dom)

    // Handle innerHTML prop
    if (node.props.innerHTML != null) {
      dom.innerHTML = node.props.innerHTML
    } else {
      diffChildren(null, node._children, dom, frame, scheduler, node, rootTarget)
    }

    setupHostNode(node, dom, scheduler)
    doInsert(dom)
    return cursor
  }

  if (isFragmentNode(node)) {
    // Insert fragment children in order before the same anchor
    for (let child of node._children) {
      cursor = insert(child, domParent, frame, scheduler, vParent, rootTarget, anchor, cursor)
    }
    return cursor
  }

  if (isComponentNode(node)) {
    return diffComponent(
      null,
      node,
      frame,
      scheduler,
      domParent,
      vParent,
      rootTarget,
      anchor,
      cursor,
    )
  }

  if (node.type === Frame) {
    throw new Error('TODO: Frame insert not implemented')
  }

  invariant(false, 'Unexpected node type')
}

function renderComponent(
  handle: ComponentHandle,
  currContent: VNode | null,
  next: ComponentNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  rootTarget: EventTarget,
  vParent?: VNode,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  let [element, tasks] = handle.render(next.props)
  let content = toVNode(element)

  let newCursor = diffVNodes(
    currContent,
    content,
    domParent,
    frame,
    scheduler,
    next,
    rootTarget,
    anchor,
    cursor,
  )
  next._content = content
  next._handle = handle
  next._parent = vParent

  let committed = next as CommittedComponentNode

  handle.setScheduleUpdate(() => {
    scheduler.enqueue(committed, domParent, anchor)
  })

  scheduler.enqueueTasks(tasks)

  return newCursor
}

function diffComponent(
  curr: CommittedComponentNode | null,
  next: ComponentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  domParent: ParentNode,
  vParent: VNode,
  rootTarget: EventTarget,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  if (curr === null) {
    next._handle = createComponent({
      id: `e${++fixmeIdCounter}`,
      frame,
      type: next.type,
      getContext: (type) => {
        return findContextFromAncestry(vParent, type)
      },
    })

    return renderComponent(
      next._handle,
      null,
      next,
      domParent,
      frame,
      scheduler,
      rootTarget,
      vParent,
      anchor,
      cursor,
    )
  }
  next._handle = curr._handle
  let { _content, _handle } = curr
  return renderComponent(
    _handle,
    _content,
    next,
    domParent,
    frame,
    scheduler,
    rootTarget,
    vParent,
    anchor,
    cursor,
  )
}

function findContextFromAncestry(node: VNode, type: Component): unknown {
  let current: VNode | undefined = node
  while (current) {
    if (current.type === type && isComponentNode(current)) {
      return current._handle.getContextValue()
    }
    current = current._parent
  }
  return undefined
}

// Cleanup without DOM removal - used for descendants when parent DOM node is removed
function cleanupDescendants(node: VNode, scheduler: Scheduler): void {
  if (isCommittedTextNode(node)) {
    return
  }

  if (isCommittedHostNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler)
    }
    if (node.props.css) {
      let { selector } = processStyle(node.props.css, styleCache)
      if (selector) {
        styleManager.remove(selector)
      }
    }
    // Unregister from layout animations
    let presenceConfig = getPresenceConfig(node)
    if (presenceConfig?.layout) {
      unregisterLayoutElement(node._dom)
    }
    if (node._controller) node._controller.abort()
    let _events = node._events
    if (_events) {
      scheduler.enqueueTasks([() => _events.dispose()])
    }
    return
  }

  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    cleanupDescendants(node._content, scheduler)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }
}

function remove(node: VNode, domParent: ParentNode, scheduler: Scheduler) {
  if (isCommittedTextNode(node)) {
    domParent.removeChild(node._dom)
    return
  }

  if (isCommittedHostNode(node)) {
    // Check if already exiting - do nothing
    if (node._exiting) {
      return
    }

    let presenceConfig = getPresenceConfig(node)

    // Only animate exit if there's an exit config defined
    if (presenceConfig?.exit) {
      let animation = node._animation

      // Check if enter animation is still running - reverse it instead of playing exit
      if (animation && animation.playState === 'running') {
        // Reverse the enter animation
        animation.reverse()
        node._exiting = true
        node._exitingParent = domParent
        exitingNodes.add(node)

        // Use finished promise for more reliable completion handling
        animation.finished.then(() => {
          // Check if node was reclaimed while animating
          if (!node._exiting) return
          exitingNodes.delete(node)
          node._exiting = false
          node._animation = undefined
          performHostNodeRemoval(node, domParent, scheduler)
        })
        return
      }

      // Enter animation finished or doesn't exist - play exit animation
      playExitAnimation(node, presenceConfig.exit, domParent, () => {
        performHostNodeRemoval(node, domParent, scheduler)
      })
      return
    }

    // No exit animation config - remove immediately (cancel any running enter animation)
    if (node._animation) {
      node._animation.cancel()
      node._animation = undefined
    }
    performHostNodeRemoval(node, domParent, scheduler)
    return
  }

  if (isFragmentNode(node)) {
    for (let child of node._children) {
      remove(child, domParent, scheduler)
    }
    return
  }

  if (isCommittedComponentNode(node)) {
    remove(node._content, domParent, scheduler)
    let tasks = node._handle.remove()
    scheduler.enqueueTasks(tasks)
    return
  }
}

// Actually remove a host node from DOM and clean up
function performHostNodeRemoval(
  node: CommittedHostNode,
  domParent: ParentNode,
  scheduler: Scheduler,
) {
  // Clean up all descendants first (before removing DOM subtree)
  for (let child of node._children) {
    cleanupDescendants(child, scheduler)
  }
  // Clean up CSS before removing DOM element
  if (node.props.css) {
    let { selector } = processStyle(node.props.css, styleCache)
    if (selector) {
      styleManager.remove(selector)
    }
  }
  // Unregister from layout animations
  let presenceConfig = getPresenceConfig(node)
  if (presenceConfig?.layout) {
    unregisterLayoutElement(node._dom)
  }
  // Only remove if still in DOM (might have been removed by parent)
  if (node._dom.parentNode === domParent) {
    domParent.removeChild(node._dom)
  }
  if (node._controller) node._controller.abort()
  let _events = node._events
  if (_events) {
    scheduler.enqueueTasks([() => _events.dispose()])
  }
}

function diffChildren(
  curr: VNode[] | null,
  next: VNode[],
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
  cursor?: Node | null,
  anchor?: Node,
) {
  // Initial mount / hydration: delegate to insert() for each child so that
  // hydration cursors and creation logic remain centralized there.
  if (curr === null) {
    for (let node of next) {
      cursor = insert(node, domParent, frame, scheduler, vParent, rootTarget, anchor, cursor)
    }
    vParent._children = next
    return cursor
  }

  let currLength = curr.length
  let nextLength = next.length

  // Detect if any keys are present in the new children. If not, we can fall
  // back to the simpler index-based diff which is cheaper and matches
  // pre-existing behavior.
  let hasKeys = false
  for (let i = 0; i < nextLength; i++) {
    let node = next[i]
    if (node && node.key != null) {
      hasKeys = true
      break
    }
  }

  if (!hasKeys) {
    for (let i = 0; i < nextLength; i++) {
      let currentNode = i < currLength ? curr[i] : null
      diffVNodes(
        currentNode,
        next[i],
        domParent,
        frame,
        scheduler,
        vParent,
        rootTarget,
        anchor,
        cursor,
      )
    }

    if (currLength > nextLength) {
      for (let i = nextLength; i < currLength; i++) {
        let node = curr[i]
        if (node) remove(node, domParent, scheduler)
      }
    }

    vParent._children = next
    return
  }

  // --- O(n + m) keyed diff with Map-based lookup ------------------------------

  let oldChildren = curr
  let oldChildrenLength = currLength
  let remainingOldChildren = oldChildrenLength

  // Build key → index map for O(1) lookup: O(m)
  let oldKeyMap = new Map<string, number>()
  for (let i = 0; i < oldChildrenLength; i++) {
    let c = oldChildren[i]
    if (c) {
      c._flags = 0
      if (c.key != null) {
        oldKeyMap.set(c.key, i)
      }
    }
  }

  let skew = 0
  let newChildren: VNode[] = new Array(nextLength)

  // First pass: match new children to old ones using Map lookup: O(n)
  for (let i = 0; i < nextLength; i++) {
    let childVNode = next[i]
    if (!childVNode) {
      newChildren[i] = childVNode
      continue
    }

    newChildren[i] = childVNode
    childVNode._parent = vParent

    let skewedIndex = i + skew
    let matchingIndex = -1

    let key = childVNode.key
    let type = childVNode.type

    if (key != null) {
      // O(1) Map lookup for keyed children
      let mapIndex = oldKeyMap.get(key)
      if (mapIndex !== undefined) {
        let candidate = oldChildren[mapIndex]
        let candidateFlags = candidate?._flags ?? 0
        if (candidate && (candidateFlags & MATCHED) === 0 && candidate.type === type) {
          matchingIndex = mapIndex
        }
      }
    } else {
      // Non-keyed children use positional identity only - no searching
      let searchVNode = oldChildren[skewedIndex]
      let searchFlags = searchVNode?._flags ?? 0
      let available = searchVNode != null && (searchFlags & MATCHED) === 0
      if (available && searchVNode.key == null && type === searchVNode.type) {
        matchingIndex = skewedIndex
      }
    }

    childVNode._index = matchingIndex

    let matchedOldVNode: VNode | null = null
    if (matchingIndex !== -1) {
      matchedOldVNode = oldChildren[matchingIndex]
      remainingOldChildren--
      if (matchedOldVNode) {
        matchedOldVNode._flags = (matchedOldVNode._flags ?? 0) | MATCHED
      }
    }

    // Determine whether this is a mount vs move and mark INSERT_VNODE
    let oldDom = matchedOldVNode && findFirstDomAnchor(matchedOldVNode)
    let isMounting = !matchedOldVNode || !oldDom
    if (isMounting) {
      if (matchingIndex === -1) {
        // Adjust skew similar to Preact when lengths differ
        if (nextLength > oldChildrenLength) {
          skew--
        } else if (nextLength < oldChildrenLength) {
          skew++
        }
      }

      childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE
    } else if (matchingIndex !== i + skew) {
      if (matchingIndex === i + skew - 1) {
        skew--
      } else if (matchingIndex === i + skew + 1) {
        skew++
      } else {
        if (matchingIndex! > i + skew) skew--
        else skew++
        childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE
      }
    }
  }

  // Unmount any old children that weren't matched
  if (remainingOldChildren) {
    for (let i = 0; i < oldChildrenLength; i++) {
      let oldVNode = oldChildren[i]
      if (oldVNode && ((oldVNode._flags ?? 0) & MATCHED) === 0) {
        remove(oldVNode, domParent, scheduler)
      }
    }
  }

  // Second pass: diff matched pairs and place/move DOM nodes in the correct
  // order, similar to Preact's diffChildren + insert.
  vParent._children = newChildren

  let lastPlaced: Node | null = null

  for (let i = 0; i < nextLength; i++) {
    let childVNode = newChildren[i]
    if (!childVNode) continue

    let idx = childVNode._index ?? -1
    let oldVNode = idx >= 0 ? oldChildren[idx] : null

    diffVNodes(
      oldVNode,
      childVNode,
      domParent,
      frame,
      scheduler,
      vParent,
      rootTarget,
      anchor,
      cursor,
    )

    let shouldPlace = (childVNode._flags ?? 0) & INSERT_VNODE
    let firstDom = findFirstDomAnchor(childVNode)
    if (shouldPlace && firstDom && firstDom.parentNode === domParent) {
      if (lastPlaced === null) {
        if (firstDom !== domParent.firstChild) {
          domParent.insertBefore(firstDom, domParent.firstChild)
        }
      } else {
        let target: Node | null = lastPlaced.nextSibling
        if (firstDom !== target) {
          domParent.insertBefore(firstDom, target)
        }
      }
    }

    if (firstDom) lastPlaced = firstDom

    // Clear internal flags for next diff
    childVNode._flags = 0
    childVNode._index = undefined
  }

  return
}

function isFragmentNode(node: VNode): node is FragmentNode {
  return node.type === Fragment
}

function isTextNode(node: VNode): node is TextNode {
  return node.type === TEXT_NODE
}

function isCommittedTextNode(node: VNode): node is CommittedTextNode {
  return isTextNode(node) && node._dom instanceof Text
}

function isHostNode(node: VNode): node is HostNode {
  return typeof node.type === 'string'
}

function isCommittedHostNode(node: VNode): node is CommittedHostNode {
  return isHostNode(node) && node._dom instanceof Element
}

function isRemixElement(node: RemixNode): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

function findFirstDomAnchor(node: VNode | null | undefined): Node | null {
  if (!node) return null
  if (isCommittedTextNode(node)) return node._dom
  if (isCommittedHostNode(node)) return node._dom
  if (isCommittedComponentNode(node)) return findFirstDomAnchor(node._content)
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      let dom = findFirstDomAnchor(child)
      if (dom) return dom
    }
  }
  return null
}

function findNextSiblingDomAnchor(curr: VNode, vParent?: VNode): Node | null {
  if (!vParent || !Array.isArray(vParent._children)) return null
  let children = vParent._children
  let idx = children.indexOf(curr)
  if (idx === -1) return null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i])
    if (dom) return dom
  }
  return null
}

function skipComments(cursor: Node | null): Node | null {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling
  }
  return cursor
}

// --- Presence Animation Helpers ---

// Debug multiplier for presence animations (set window.DEBUG_PRESENCE = true to slow down animations)
function getDebugDurationMultiplier(): number {
  return typeof window !== 'undefined' && (window as any).DEBUG_PRESENCE ? 10 : 1
}

// Default configs for each animation type
const DEFAULT_ENTER: PresenceKeyframeConfig = {
  opacity: 0,
  duration: 150,
  easing: 'ease-out',
}

const DEFAULT_EXIT: PresenceKeyframeConfig = {
  opacity: 0,
  duration: 150,
  easing: 'ease-in',
}

const DEFAULT_LAYOUT: LayoutAnimationConfig = {
  duration: 200,
  easing: 'ease-in-out',
}

// Normalized presence config with resolved defaults
interface NormalizedPresenceProp {
  enter?: PresenceConfig | PresenceKeyframeConfig
  exit?: PresenceConfig | PresenceKeyframeConfig
  layout?: LayoutAnimationConfig
}

// Normalize presence prop to full config, resolving `true` values to defaults
function normalizePresence(presence: AnimateProp): NormalizedPresenceProp {
  let result: NormalizedPresenceProp = {}

  // Normalize enter
  if (presence.enter === true) {
    result.enter = DEFAULT_ENTER
  } else if (presence.enter) {
    result.enter = presence.enter
  }

  // Normalize exit
  if (presence.exit === true) {
    result.exit = DEFAULT_EXIT
  } else if (presence.exit) {
    result.exit = presence.exit
  }

  // Normalize layout - merge with defaults for partial configs
  if (presence.layout === true) {
    result.layout = DEFAULT_LAYOUT
  } else if (presence.layout) {
    result.layout = {
      duration: presence.layout.duration ?? DEFAULT_LAYOUT.duration,
      easing: presence.layout.easing ?? DEFAULT_LAYOUT.easing,
    }
  }

  return result
}

// Check if config has keyframes array
function hasKeyframes(config: PresenceConfig | PresenceKeyframeConfig): config is PresenceConfig {
  return 'keyframes' in config && Array.isArray(config.keyframes)
}

// Extract style properties from a keyframe config (excluding timing properties)
function extractStyleProps(config: PresenceKeyframe): Keyframe {
  let result: Keyframe = {}
  for (let key in config) {
    if (
      key !== 'offset' &&
      key !== 'easing' &&
      key !== 'composite' &&
      key !== 'duration' &&
      key !== 'delay'
    ) {
      result[key as keyof Keyframe] = config[key as keyof PresenceKeyframe] as string | number
    }
  }
  // Include per-keyframe timing if present
  if (config.offset !== undefined) result.offset = config.offset
  if (config.easing !== undefined) result.easing = config.easing
  if (config.composite !== undefined) result.composite = config.composite
  return result
}

// Build keyframes array for enter animation
function buildEnterKeyframes(config: PresenceConfig | PresenceKeyframeConfig): Keyframe[] {
  if (hasKeyframes(config)) {
    return config.keyframes.map(extractStyleProps)
  }
  // Shorthand: animate FROM enter state TO natural state (empty = browser default)
  // Don't include easing on keyframe - it's specified in animation options.
  // Including it on both causes double-easing (WAAPI applies both effect and keyframe easing).
  let keyframe = extractStyleProps(config)
  delete keyframe.easing
  return [keyframe, {}]
}

// Build keyframes array for exit animation
function buildExitKeyframes(config: PresenceConfig | PresenceKeyframeConfig): Keyframe[] {
  if (hasKeyframes(config)) {
    return config.keyframes.map(extractStyleProps)
  }
  // Shorthand: animate FROM natural state TO exit state
  // Don't include easing on keyframe - it's specified in animation options.
  let keyframe = extractStyleProps(config)
  delete keyframe.easing
  return [{}, keyframe]
}

// Play enter animation on an element
function playEnterAnimation(
  node: CommittedHostNode,
  config: PresenceConfig | PresenceKeyframeConfig,
): void {
  let dom = node._dom as HTMLElement
  let keyframes = buildEnterKeyframes(config)
  let multiplier = getDebugDurationMultiplier()
  let options: KeyframeAnimationOptions = {
    duration: config.duration * multiplier,
    delay: config.delay != null ? config.delay * multiplier : undefined,
    easing: config.easing,
    composite: config.composite as CompositeOperation | undefined,
    fill: 'backwards',
  }
  let animation = dom.animate(keyframes, options)
  node._animation = animation
}

// Play exit animation on an element
function playExitAnimation(
  node: CommittedHostNode,
  config: PresenceConfig | PresenceKeyframeConfig,
  domParent: ParentNode,
  onComplete: () => void,
): void {
  let dom = node._dom as HTMLElement
  let keyframes = buildExitKeyframes(config)
  let multiplier = getDebugDurationMultiplier()
  let options: KeyframeAnimationOptions = {
    duration: config.duration * multiplier,
    delay: config.delay != null ? config.delay * multiplier : undefined,
    easing: config.easing,
    composite: config.composite as CompositeOperation | undefined,
    fill: 'forwards',
  }
  let animation = dom.animate(keyframes, options)
  node._animation = animation
  node._exiting = true
  node._exitingParent = domParent
  exitingNodes.add(node)

  // Use finished promise for more reliable completion handling
  // Check if still exiting - might have been reclaimed
  animation.finished.then(() => {
    if (!node._exiting) return // Node was reclaimed, don't remove
    exitingNodes.delete(node)
    node._exiting = false
    node._animation = undefined
    onComplete()
  })
}

// Get animate config from node props
function getPresenceConfig(node: HostNode): NormalizedPresenceProp | null {
  let animate = node.props.animate
  if (!animate) return null
  return normalizePresence(animate)
}

// Check if enter animation should play (just checks if config exists)
function shouldPlayEnterAnimation(
  config: PresenceConfig | PresenceKeyframeConfig | undefined,
): boolean {
  return !!config
}

// Find a matching exiting node that can be reclaimed
function findMatchingExitingNode(
  type: string,
  key: string | undefined,
  domParent: ParentNode,
): CommittedHostNode | null {
  // Only reclaim nodes with explicit keys - non-keyed nodes should animate
  // independently. This prevents `cond ? <A /> : <B />` from incorrectly
  // reclaiming when A and B's inner elements happen to have the same type.
  if (key == null) return null

  for (let node of exitingNodes) {
    if (!isCommittedHostNode(node)) continue
    if (node._exitingParent !== domParent) continue
    if (node.type !== type) continue
    if (node.key !== key) continue
    return node
  }
  return null
}

// Reclaim an exiting node by reversing its exit animation
function reclaimExitingNode(
  exitingNode: CommittedHostNode,
  newNode: HostNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  rootTarget: EventTarget,
): void {
  // Reverse the exit animation if it's still running
  let animation = exitingNode._animation
  if (animation && animation.playState === 'running') {
    animation.reverse()
    animation.finished.then(() => {
      exitingNode._animation = undefined
    })
  }

  // Clear exiting state
  exitingNodes.delete(exitingNode)
  exitingNode._exiting = false
  exitingNode._exitingParent = undefined

  // Transfer exiting node's DOM and state to new node
  newNode._dom = exitingNode._dom
  newNode._parent = vParent
  newNode._controller = exitingNode._controller
  newNode._events = exitingNode._events
  newNode._animation = exitingNode._animation

  // Diff props on the existing DOM element
  diffHostProps(exitingNode.props, newNode.props, exitingNode._dom)

  // Diff children
  diffChildren(
    exitingNode._children,
    newNode._children,
    exitingNode._dom,
    frame,
    scheduler,
    newNode,
    rootTarget,
  )

  // Update event listeners if needed
  let nextOn = newNode.props.on
  if (nextOn) {
    if (newNode._events) {
      let eventsContainer = newNode._events
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
    } else {
      let eventsContainer = createContainer(exitingNode._dom)
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
      newNode._events = eventsContainer
    }
  } else if (newNode._events) {
    let eventsContainer = newNode._events
    scheduler.enqueueTasks([() => eventsContainer.dispose()])
    newNode._events = undefined
  }
}

/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export function resetStyleState() {
  styleCache.clear()
  styleManager.dispose()
  styleManager = createStyleManager()
}
