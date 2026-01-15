import { createContainer, type EventsContainer } from '@remix-run/interaction'
import type { Component, ComponentHandle, FrameHandle } from './component.ts'
import { createComponent, Catch, Fragment, Frame, createFrameHandle } from './component.ts'
import { invariant } from './invariant.ts'
import { createDocumentState } from './document-state.ts'
import { processStyle, createStyleManager, normalizeCssValue } from './style/index.ts'
import type { ElementProps, RemixElement, RemixNode } from './jsx.ts'

let fixmeIdCounter = 0

export type VirtualRoot = {
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
let styleCache = new Map<string, { className: string; css: string }>()
let styleManager =
  typeof window !== 'undefined'
    ? createStyleManager()
    : (null as unknown as ReturnType<typeof createStyleManager>)

type VNodeType =
  | typeof ROOT_VNODE
  | string // host element
  | Function // component
  | typeof TEXT_NODE
  | typeof Fragment
  | typeof Catch
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

  // Catch
  _fallback?: ((error: unknown) => RemixNode) | RemixNode
  _added?: VNode[]
  _tripped?: boolean
}

type FragmentNode = VNode & {
  type: typeof Fragment
  _children: VNode[]
}

type CatchNode = VNode & {
  type: typeof Catch
  _children: VNode[] // so we can diff normally in happy path
  _fallback: ((error: unknown) => RemixNode) | RemixNode
}

type CommittedCatchNode = CatchNode & {
  _added: VNode[] // so we can remove arbitrarily (outside render)
  _tripped: boolean // so we knew we should replace it on next render
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

export function createScheduler(doc: Document) {
  let documentState = createDocumentState(doc)
  let scheduled = new Map<CommittedComponentNode, [ParentNode, Node | undefined]>()
  let tasks: EmptyFn[] = []
  let flushScheduled = false
  let scheduler: {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode, anchor?: Node): void
    enqueueTasks(newTasks: EmptyFn[]): void
    dequeue(): void
  }

  function flush() {
    flushScheduled = false

    let batch = new Map(scheduled)
    scheduled.clear()

    let hasWork = batch.size > 0 || tasks.length > 0
    if (!hasWork) return

    documentState.capture()

    if (batch.size > 0) {
      let vnodes = Array.from(batch)
      let noScheduledAncestor = new Set<VNode>()

      for (let [vnode, [domParent, anchor]] of vnodes) {
        if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue
        let handle = vnode._handle
        let curr = vnode._content
        let vParent = vnode._parent
        renderComponent(handle, curr, vnode, domParent, handle.frame, scheduler, vParent, anchor)
      }
    }

    // restore before user tasks so users can move focus/selection etc.
    documentState.restore()

    if (tasks.length > 0) {
      for (let task of tasks) {
        task()
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
  let root: VNode | null = null
  let frameStub = options.frame ?? createFrameHandle()

  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(end.parentNode === container, 'Boundaries must share parent')

  let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document)

  let hydrationCursor = start.nextSibling

  return {
    render(element: RemixNode) {
      let vnode = toVNode(element)
      let vParent: VNode = { type: ROOT_VNODE, _svg: false }
      scheduler.enqueueTasks([
        () => {
          diffVNodes(root, vnode, container, frameStub, scheduler, vParent, end, hydrationCursor)
          root = vnode
          hydrationCursor = null
        },
      ])
      scheduler.dequeue()
    },

    remove() {
      root = null
    },

    flush() {
      scheduler.dequeue()
    },
  }
}

export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let root: VNode | null = null
  let frameStub = options.frame ?? createFrameHandle()
  let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document)
  let hydrationCursor = container.innerHTML.trim() !== '' ? container.firstChild : undefined

  return {
    render(element: RemixNode) {
      let vnode = toVNode(element)
      let vParent: VNode = { type: ROOT_VNODE, _svg: false }
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            root,
            vnode,
            container,
            frameStub,
            scheduler,
            vParent,
            undefined,
            hydrationCursor,
          )
          root = vnode
          hydrationCursor = undefined
        },
      ])
      scheduler.dequeue()
    },

    remove() {
      root = null
    },

    flush() {
      scheduler.dequeue()
    },
  }
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

  if (node.type === Catch) {
    return {
      type: Catch,
      key: node.key,
      _fallback: node.props.fallback,
      _children: flatMapChildrenToVNodes(node),
    }
  }

  if (isRemixElement(node)) {
    let children = flatMapChildrenToVNodes(node)
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
  anchor?: Node,
  rootCursor?: Node | null,
) {
  next._parent = vParent // set parent for initial render context lookups
  next._svg = getSvgContext(vParent, next.type)

  // new
  if (curr === null) {
    insert(next, domParent, frame, scheduler, vParent, anchor, rootCursor)
    return
  }

  if (curr.type !== next.type) {
    replace(curr, next, domParent, frame, scheduler, vParent, anchor)
    return
  }

  if (isCommittedTextNode(curr) && isTextNode(next)) {
    diffText(curr, next, scheduler, vParent)
    return
  }

  if (isCommittedHostNode(curr) && isHostNode(next)) {
    diffHost(curr, next, domParent, frame, scheduler, vParent)
    return
  }

  if (isCommittedComponentNode(curr) && isComponentNode(next)) {
    diffComponent(curr, next, frame, scheduler, domParent, vParent)
    return
  }

  if (isFragmentNode(curr) && isFragmentNode(next)) {
    diffChildren(
      curr._children,
      next._children,
      domParent,
      frame,
      scheduler,
      vParent,
      undefined,
      anchor,
    )
    return
  }

  if (isCatchNode(curr) && isCatchNode(next)) {
    diffCatch(curr, next, domParent, frame, scheduler, vParent)
    return
  }

  if (curr.type === Frame && next.type === Frame) {
    throw new Error('TODO: Frame diff not implemented')
  }

  invariant(false, 'Unexpected diff case')
}

function diffCatch(
  curr: CatchNode,
  next: CatchNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
) {
  if (curr._tripped) {
    replace(curr, next, domParent, frame, scheduler, vParent)
    return
  }

  let added = []
  try {
    for (let i = 0; i < curr._children.length; i++) {
      let child = curr._children[i]
      diffVNodes(child, next._children[i], domParent, frame, scheduler, vParent)
      added.unshift(child)
    }
    curr._parent = vParent
    curr._tripped = false
    curr._added = added
  } catch (e: unknown) {
    for (let child of added) {
      remove(child, domParent, scheduler)
    }
    let fallbackNode = getCatchFallback(next, e)
    let anchor = findFirstDomAnchor(curr) || findNextSiblingDomAnchor(curr, vParent) || undefined
    insert(fallbackNode, domParent, frame, scheduler, vParent, anchor)
    curr._parent = vParent
    curr._tripped = true
    curr._added = [fallbackNode]
    dispatchError(e)
  }
}

function replace(
  curr: VNode,
  next: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  anchor?: Node,
) {
  anchor =
    anchor || findFirstDomAnchor(curr) || findNextSiblingDomAnchor(curr, curr._parent) || undefined
  insert(next, domParent, frame, scheduler, vParent, anchor)
  remove(curr, domParent, scheduler)
}

function diffHost(
  curr: CommittedHostNode,
  next: HostNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
) {
  diffChildren(curr._children, next._children, curr._dom, frame, scheduler, next)
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
      let eventsContainer = createContainer(curr._dom, {
        onError: (error) => raise(error, next, domParent, frame, scheduler),
      })
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)])
      next._events = eventsContainer
    }
  } else if (curr._events) {
    // Dispose old container since next has no on prop
    let eventsContainer = curr._events
    scheduler.enqueueTasks([() => eventsContainer.dispose()])
  }
  // If neither has on, do nothing - no _events to set

  return
}

function setupHostNode(
  node: HostNode,
  dom: Element,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
): void {
  node._dom = dom

  let on = node.props.on
  if (on) {
    let eventsContainer = createContainer(dom, {
      onError: (error) => raise(error, node, domParent, frame, scheduler),
    })
    scheduler.enqueueTasks([() => eventsContainer.set(on)])
    node._events = eventsContainer
  }

  let connect = node.props.connect
  if (connect) {
    // Only create controller if connect callback expects a signal (length >= 2)
    if (connect.length >= 2) {
      let controller = new AbortController()
      node._controller = controller
      scheduler.enqueueTasks([() => connect(dom, controller.signal)])
    } else {
      scheduler.enqueueTasks([() => connect(dom)])
    }
  }
}

function diffCssProp(curr: ElementProps, next: ElementProps, dom: Element) {
  let prevClassName = curr.css ? processStyle(curr.css, styleCache).className : ''
  let { className, css } = next.css
    ? processStyle(next.css, styleCache)
    : { className: '', css: '' }
  if (prevClassName === className) return
  if (prevClassName) {
    dom.classList.remove(prevClassName)
    styleManager.remove(prevClassName)
  }
  if (css && className) {
    dom.classList.add(className)
    styleManager.insert(className, css)
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

function isCommittedCatchNode(node: VNode): node is CommittedCatchNode {
  return isCatchNode(node) && node._added != undefined && node._tripped != null
}

function isComponentNode(node: VNode): node is ComponentNode {
  return typeof node.type === 'function' && node.type !== Frame
}

function isCommittedComponentNode(node: VNode): node is CommittedComponentNode {
  return isComponentNode(node) && node._content !== undefined
}

function isFrameworkProp(name: string): boolean {
  return (
    name === 'children' || name === 'key' || name === 'on' || name === 'css' || name === 'setup'
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

function diffText(curr: CommittedTextNode, next: TextNode, scheduler: Scheduler, vParent: VNode) {
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
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  node._parent = vParent // set parent for initial render context lookups
  node._svg = getSvgContext(vParent, node.type)

  cursor = skipComments(cursor ?? null)

  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

  if (isTextNode(node)) {
    if (cursor instanceof Text) {
      node._dom = cursor
      node._parent = vParent
      // correct hydration mismatch
      if (cursor.data !== node._text) {
        logHydrationMismatch('text mismatch', cursor.data, node._text)
        cursor.data = node._text
      }
      return cursor.nextSibling
    }
    let dom = document.createTextNode(node._text)
    node._dom = dom
    node._parent = vParent
    doInsert(dom)
    return cursor
  }

  if (isHostNode(node)) {
    if (cursor instanceof Element) {
      if (cursor.tagName.toLowerCase() === node.type) {
        // FIXME: hydrate css prop
        // correct hydration mismatches
        diffHostProps({}, node.props, cursor)
        setupHostNode(node, cursor, domParent, frame, scheduler)

        let childCursor = cursor.firstChild
        // FIXME: this breaks other tests
        // if (node._children.length > 1 && node._children.every(isTextNode)) {
        //   // special case <span>Text {text}</span> comes as single node from server
        //   return cursor.nextSibling
        // }
        let excess = diffChildren(null, node._children, cursor, frame, scheduler, node, childCursor)
        if (excess) {
          logHydrationMismatch('excess', excess)
        }
        return cursor.nextSibling
      } else {
        logHydrationMismatch('tag', cursor.tagName.toLowerCase(), node.type)
        cursor.remove()
        cursor = undefined // stop hydration for this tree
      }
    }
    let dom = node._svg
      ? document.createElementNS(SVG_NS, node.type)
      : document.createElement(node.type)
    diffHostProps({}, node.props, dom)
    diffChildren(null, node._children, dom, frame, scheduler, node)
    setupHostNode(node, dom, domParent, frame, scheduler)
    doInsert(dom)
    return cursor
  }

  if (isFragmentNode(node)) {
    // Insert fragment children in order before the same anchor
    for (let child of node._children) {
      cursor = insert(child, domParent, frame, scheduler, vParent, anchor, cursor)
    }
    return cursor
  }

  if (isCatchNode(node)) {
    let added = []
    try {
      // insert like a fragment
      for (let child of node._children) {
        insert(child, domParent, frame, scheduler, node, anchor)
        added.unshift(child)
      }
      node._parent = vParent
      node._tripped = false
      node._added = added
    } catch (e: unknown) {
      let fallback = getCatchFallback(node, e)
      for (let child of added) {
        remove(child, domParent, scheduler)
      }
      insert(fallback, domParent, frame, scheduler, node, anchor)
      node._parent = vParent
      node._tripped = true
      node._added = [fallback]
      dispatchError(e)
    }

    return
  }

  if (isComponentNode(node)) {
    diffComponent(null, node, frame, scheduler, domParent, vParent, anchor, cursor)
    return cursor
  }

  if (node.type === Frame) {
    throw new Error('TODO: Frame insert not implemented')
  }

  if (node.type === Catch) {
    throw new Error('TODO: Catch insert not implemented')
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
  vParent?: VNode,
  anchor?: Node,
  cursor?: Node | null,
) {
  let [element, tasks] = handle.render(next.props)
  let content = toVNode(element)

  diffVNodes(currContent, content, domParent, frame, scheduler, next, anchor, cursor)
  next._content = content
  next._handle = handle
  next._parent = vParent

  let committed = next as CommittedComponentNode

  handle.setScheduleUpdate(() => {
    scheduler.enqueue(committed, domParent, anchor)
  })

  scheduler.enqueueTasks(tasks)
}

function diffComponent(
  curr: CommittedComponentNode | null,
  next: ComponentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  domParent: ParentNode,
  vParent: VNode,
  anchor?: Node,
  cursor?: Node | null,
) {
  if (curr === null) {
    next._handle = createComponent({
      id: `e${++fixmeIdCounter}`,
      frame,
      type: next.type,
      raise: (error) => {
        raise(error, next, domParent, frame, scheduler)
      },
      getContext: (type) => {
        return findContextFromAncestry(vParent, type)
      },
    })

    renderComponent(next._handle, null, next, domParent, frame, scheduler, vParent, anchor, cursor)
    return
  }
  next._handle = curr._handle
  let { _content, _handle } = curr
  renderComponent(_handle, _content, next, domParent, frame, scheduler, vParent, anchor, cursor)
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
      let { className } = processStyle(node.props.css, styleCache)
      if (className) {
        styleManager.remove(className)
      }
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

  if (isCommittedCatchNode(node)) {
    for (let child of node._added) {
      cleanupDescendants(child, scheduler)
    }
    return
  }
}

function remove(node: VNode, domParent: ParentNode, scheduler: Scheduler) {
  if (isCommittedTextNode(node)) {
    domParent.removeChild(node._dom)
    return
  }

  if (isCommittedHostNode(node)) {
    // Clean up all descendants first (before removing DOM subtree)
    for (let child of node._children) {
      cleanupDescendants(child, scheduler)
    }
    // Clean up CSS before removing DOM element
    if (node.props.css) {
      // TODO: can probably avoid calling processStyle by storing className
      // somewhere or maybe don't use className and a special data-attribute on
      // the element
      let { className } = processStyle(node.props.css, styleCache)
      if (className) {
        styleManager.remove(className)
      }
    }
    domParent.removeChild(node._dom)
    if (node._controller) node._controller.abort()
    let _events = node._events
    if (_events) {
      scheduler.enqueueTasks([() => _events.dispose()])
    }
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

  if (isCommittedCatchNode(node)) {
    for (let child of node._added) {
      remove(child, domParent, scheduler)
    }
    return
  }
}

function diffChildren(
  curr: VNode[] | null,
  next: VNode[],
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  vParent: VNode,
  cursor?: Node | null,
  anchor?: Node,
) {
  // Initial mount / hydration: delegate to insert() for each child so that
  // hydration cursors and creation logic remain centralized there.
  if (curr === null) {
    for (let node of next) {
      cursor = insert(node, domParent, frame, scheduler, vParent, anchor, cursor)
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
      diffVNodes(currentNode, next[i], domParent, frame, scheduler, vParent, anchor, cursor)
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

    diffVNodes(oldVNode, childVNode, domParent, frame, scheduler, vParent, anchor, cursor)

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

function dispatchError(error: unknown) {
  // TODO: dispatch on root target
  // console.error(error)
}

function getCatchFallback(vnode: CatchNode, error: unknown): VNode {
  let content = typeof vnode._fallback === 'function' ? vnode._fallback(error) : vnode._fallback
  return toVNode(content)
}

function raise(
  error: unknown,
  descendant: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
) {
  let catchBoundary = findCatchBoundary(descendant)
  if (catchBoundary) {
    let content = getCatchFallback(catchBoundary, error)
    let anchor =
      findFirstDomAnchor(catchBoundary) ||
      findNextSiblingDomAnchor(catchBoundary, catchBoundary._parent) ||
      undefined
    insert(content, domParent, frame, scheduler, catchBoundary, anchor)
    for (let child of catchBoundary._added) {
      remove(child, domParent, scheduler)
    }
    catchBoundary._tripped = true
    catchBoundary._added = [content]
  } else {
    dispatchError(error)
  }
}

function findCatchBoundary(vnode: VNode): CommittedCatchNode | null {
  let current: VNode | undefined = vnode
  while (current) {
    if (isCommittedCatchNode(current)) return current
    current = current._parent
  }
  return null
}

function isFragmentNode(node: VNode): node is FragmentNode {
  return node.type === Fragment
}

function isCatchNode(node: VNode): node is CatchNode {
  return node.type === Catch
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
  if (isCommittedCatchNode(node)) {
    for (let child of node._added) {
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
