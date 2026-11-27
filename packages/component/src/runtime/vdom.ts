import type { PortalNodeRenderer, PortalRanges } from './portal.ts'
import type { NonceManager, ResourceNonces } from './nonce.ts'
import type {
  ComponentConfig,
  ComponentErrorEvent,
  ComponentHandle,
  FrameHandle,
  FrameHandleEventMap,
  FrameProps,
  FrameReloadStartEvent,
  FrameReloadStartEventInit,
  Handle,
  NoContext,
  PortalProps,
  RenderFn,
  Task,
  UpdateQueue,
} from './component.ts'
import type { ClientEntryBoundaryRuntime, FrameMountState, ResolveFrame } from './frame-runtime.ts'
import {
  componentStalenessCheck,
  defaultMixinDriver,
  DIRECT_EVENT,
  Fragment,
  FRAME_NODE,
  invariant,
  isEmptyChild,
  isMixinDescriptor,
  isPrimitiveChild,
  isRemixElement,
  isRemixNode,
  jsx,
  MIXIN_RUNTIME,
  normalizeChildren,
  normalizeUnsafeHTMLProps,
  Portal,
  PORTAL_NODE,
  roots,
  setActiveSchedulerUpdateParents,
  TypedEventTarget,
  type ElementFunction,
  type ElementProps,
  type ElementType,
  type Key,
  type RemixNode,
} from './vnode.ts'
import type { MixinDriver, MixinRuntime, MixinRuntimeValue } from './mixins/mixin.ts'
import type { DirectEventSync, OnBinding, OnMixinDescriptor } from './mixins/on-mixin.ts'
import type { StyleManager } from '../style/stylesheet.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

function registerRoot(root: VirtualRoot): void {
  roots.add(root)
}

function unregisterRoot(root: VirtualRoot): void {
  roots.delete(root)
}

// -- Component runtime & handle helpers --

export function createComponentErrorEvent(error: unknown): ComponentErrorEvent {
  return new ErrorEvent('error', { error }) as ComponentErrorEvent
}

export function getComponentError(event: Event): unknown {
  return (event as { error?: unknown }).error
}

export function createFrameReloadStartEvent(
  init: FrameReloadStartEventInit,
): FrameReloadStartEvent {
  return Object.assign(new Event('reloadStart'), {
    src: init.src,
    method: init.method,
    encType: init.encType,
    formData: init.formData ?? null,
    element: init.element ?? null,
    submitter: init.submitter ?? null,
    finished: init.finished,
  })
}

export function createComponent<C = NoContext>(config: ComponentConfig): ComponentHandle<C> {
  let connectedController: AbortController | undefined
  let contextValue: C | undefined
  let props: ElementProps = {}
  let renderController: AbortController | undefined
  let renderFn: RenderFn | undefined
  let removed = false
  let phase: 'idle' | 'setup' | 'render' = 'idle'
  let updateQueue: UpdateQueue | undefined
  let updateVNode: object | undefined
  let updateDomParent: ParentNode | undefined
  let tasks: Task[] = []

  let handle: Handle<ElementProps, C> = {
    id: config.id,
    props,
    update() {
      if (removed) return Promise.resolve(AbortSignal.abort())
      let name = config.type.name || 'Anonymous'
      if (phase === 'setup') {
        console.warn(
          `Ignored handle.update() while ${name} is running its setup function. The initial render includes setup changes.`,
        )
        return new Promise((resolve) => tasks.push(resolve))
      }
      if (phase !== 'idle' || !updateQueue || !updateVNode || !updateDomParent) {
        let when =
          phase !== 'idle'
            ? `while ${name} is running its ${phase} function`
            : `before ${name}'s initial render commits`
        throw new Error(
          `Cannot call handle.update() ${when}. Call it from an event handler or handle.queueTask() instead.`,
        )
      }
      let queue = updateQueue
      let vnode = updateVNode
      let domParent = updateDomParent
      return new Promise((resolve) => {
        tasks.push(resolve)
        queue.enqueue(vnode, domParent)
      })
    },
    queueTask(task: Task) {
      tasks.push(task)
    },
    frame: config.frame,
    frames: config.frames,
    context: {
      set(value) {
        contextValue = value
      },
      get: (type: ElementType | symbol) =>
        typeof type === 'function' ? config.getContext(type as ElementFunction) : undefined,
    },
    get signal() {
      return config.signal ?? (connectedController ??= new AbortController()).signal
    },
  }

  function dequeueTasks(signal?: AbortSignal): Array<() => void> {
    if (!tasks.length) return EMPTY_TASKS
    if (signal === undefined && tasks.some((task) => task.length >= 1)) {
      renderController ??= new AbortController()
    }
    let resolved =
      signal ?? renderController?.signal ?? (sharedAbortedSignal ??= AbortSignal.abort())
    return tasks.splice(0).map((task) => () => task(resolved))
  }

  return {
    frame: config.frame,
    render(nextProps) {
      if (removed) {
        console.warn('render called after component was removed, potential application memory leak')
        return [null, EMPTY_TASKS]
      }
      renderController?.abort()
      renderController = undefined
      syncProps(props, nextProps)

      let element: RemixNode
      try {
        if (!renderFn) {
          phase = 'setup'
          let result = (config.type as unknown as (h: Handle<ElementProps, C>) => unknown)(handle)
          if (typeof result !== 'function') {
            throw new Error(
              `${config.type.name || 'Anonymous'} must return a render function, received ${typeof result}`,
            )
          }
          renderFn = result as RenderFn
        }
        phase = 'render'
        element = renderFn()
      } finally {
        phase = 'idle'
      }
      return [element, dequeueTasks()]
    },
    remove() {
      if (removed) return EMPTY_TASKS
      removed = true
      connectedController?.abort()
      renderController?.abort()
      renderController = undefined
      return dequeueTasks((sharedAbortedSignal ??= AbortSignal.abort()))
    },
    setScheduleUpdate(queue, vnode, domParent) {
      updateQueue = queue
      updateVNode = vnode
      updateDomParent = domParent
    },
    getContextValue: () => contextValue,
    isRemoved: () => removed,
  }
}

// Shared empty result and aborted signal so the common no-task removal path
// (large subtree teardowns dispose many components at once) allocates nothing.
const EMPTY_TASKS: Array<() => void> = []
let sharedAbortedSignal: AbortSignal | undefined

function syncProps(target: ElementProps, next: ElementProps): void {
  for (let key in target) {
    if (!Object.hasOwn(next, key)) {
      delete target[key]
    }
  }

  for (let key in next) {
    if (key === '__proto__') {
      Object.defineProperty(target, key, {
        value: next[key],
        writable: true,
        enumerable: true,
        configurable: true,
      })
    } else {
      target[key] = next[key]
    }
  }
}

/**
 * Creates a frame handle with default no-op implementations for testing and internal wiring.
 *
 * @param def Partial frame-handle implementation to merge with the defaults.
 * @returns A frame handle object.
 */
export function createFrameHandle(
  def?: Partial<{
    src: string
    replace: FrameHandle['replace']
    reload: FrameHandle['reload']
    $runtime: FrameHandle['$runtime']
  }>,
): FrameHandle {
  return Object.assign(
    new TypedEventTarget<FrameHandleEventMap>(),
    {
      src: '/',
      replace: notImplemented('replace not implemented'),
      reload: notImplemented('reload not implemented'),
    },
    def,
  )
}

function notImplemented(msg: string) {
  return (): never => {
    throw new Error(msg)
  }
}

// -- Virtual roots & scheduler --

/**
 * Events emitted by virtual roots.
 */
export type VirtualRootEventMap = {
  /** A component render or queued task failed. */
  error: ComponentErrorEvent
}

/**
 * Root controller returned by {@link createRoot} and {@link createRangeRoot}.
 */
export type VirtualRoot = TypedEventTarget<VirtualRootEventMap> & {
  /**
   * Renders a tree, reusing existing DOM and component instances where possible.
   * The first render hydrates existing container or range content.
   *
   * @param element Tree to render, or `null` to remove the current tree.
   */
  render: (element: RemixNode) => void
  /** Renders the most recently supplied tree again, or does nothing before the first render. */
  reconcile: () => void
  /**
   * Removes the rendered tree and releases root listeners and component resources.
   * Host removal can remain pending while mixin teardown callbacks finish.
   */
  dispose: () => void
  /** Synchronously drains pending DOM work and tasks without waiting for asynchronous work. */
  flush: () => void
}

/**
 * Options for creating a virtual DOM root with {@link createRoot} or {@link createRangeRoot}.
 */
export type VirtualRootOptions = {
  /** Existing frame runtime to share with this root instead of creating one from `frameInit`. */
  frame?: FrameHandle
  /** Resolves context from outside this root when no matching provider exists inside it. */
  getContext?: (type: ElementFunction) => unknown
  /** Scheduler to share with related roots (defaults to a new scheduler). */
  scheduler?: Scheduler
  /** Style manager used to adopt server styles and manage generated CSS. */
  styleManager?: StyleManager
  /** Frame resolution for standalone roots that render `<Frame>` without calling `run()`. */
  frameInit?: {
    /** Source URL for the root's frame context (defaults to `'/'`). */
    src?: string
    /** Resolves content for frames rendered inside this root. */
    resolveFrame: ResolveFrame
    /** Loads client entries encountered in resolved frame content. */
    loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function
  }
}

/**
 * Creates a virtual root bounded by two DOM nodes.
 *
 * @param boundaries Start and end nodes sharing a parent. Only the content between them is owned.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRangeRoot(
  boundaries: [Node, Node],
  options: VirtualRootOptions = {},
): VirtualRoot {
  let [start, end] = boundaries
  let container = end.parentNode
  invariant(container, 'Expected parent node')
  invariant(start.parentNode === container, 'Boundaries must share parent')
  let markerData = start.nodeType === 8 ? (start as Comment).data.trim() : ''
  let hydrationId = markerData.startsWith('rmx:h:') ? markerData.slice(6) : undefined
  return createVirtualRoot(container, start.nextSibling, options, start, end, hydrationId)
}

/**
 * Creates a virtual root for a host container element.
 *
 * @param container Host element to render into.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRoot(container: HTMLElement, options: VirtualRootOptions = {}): VirtualRoot {
  let start: ChildNode | null = null
  let styleRoot: HTMLElement | undefined
  if (hasServerContent(container)) {
    if (options.styleManager) {
      options.styleManager.adoptServerStyles(container)
      // Adoption can remove or replace the first node.
      if (hasServerContent(container)) start = container.firstChild
    } else {
      start = container.firstChild
      styleRoot = container
    }
  }
  return createVirtualRoot(container, start, options, undefined, undefined, undefined, styleRoot)
}

function hasServerContent(container: HTMLElement): boolean {
  // Templates serialize their content fragment. For ordinary elements, a child tag
  // proves there is markup without serializing the entire subtree.
  if (container.localName !== 'template' && container.firstElementChild) return true
  return container.innerHTML.trim() !== ''
}

function createVirtualRoot(
  parent: ParentNode,
  hydrationStart: Node | null,
  options: VirtualRootOptions,
  rangeStart?: Node,
  rangeEnd?: Node,
  pendingHydrationId?: string,
  styleRoot?: HTMLElement,
): VirtualRoot {
  let vroot: CommittedVNode | null = null
  let currentElement: RemixNode | undefined
  let styles = options.styleManager

  let eventTarget = new TypedEventTarget<VirtualRootEventMap>()
  let scheduler =
    options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget)
  let frameStub =
    options.frame ??
    createRootFrameHandle(options.frameInit, eventTarget, scheduler, styles, styleRoot)
  let context: ReconcileContext = {
    frame: frameStub,
    scheduler,
    styles,
    rootTarget: eventTarget,
  }

  function forwardDomError(event: Event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)))
  }
  parent.addEventListener('error', forwardDomError)

  let root = Object.assign(eventTarget, {
    render(element: RemixNode) {
      if (currentElement === undefined) parent.addEventListener('error', forwardDomError)
      currentElement = element

      let nonceManager = (frameStub.$runtime as { nonceManager?: NonceManager } | undefined)
        ?.nonceManager
      let vnode = toVNode(element)
      let vParent: RootVNode = {
        kind: 'root',
        type: ROOT_VNODE,
        _children: [],
        _svg: false,
        _nonces: nonceManager?.getRootResourceNonces(root),
        _getContext: options.getContext,
        _rangeStart: rangeStart,
        _rangeEnd: rangeEnd,
        _hid: pendingHydrationId,
      }
      scheduler.enqueueWork([
        () => {
          let cursor = hydrationStart === null ? undefined : { current: hydrationStart }
          let committed = diffVNodes(
            vroot,
            vnode,
            parent,
            vParent,
            context,
            rangeEnd ?? null,
            cursor,
          )
          vParent._children = [committed]
          vroot = committed
          hydrationStart = null
          restoreAncestorSelect(parent)
        },
      ])
      scheduler.dequeue()
    },

    reconcile() {
      if (currentElement === undefined) return
      root.render(currentElement)
    },

    dispose() {
      parent.removeEventListener('error', forwardDomError)
      unregisterRoot(root)
      currentElement = undefined

      if (!vroot) return
      let current = vroot
      vroot = null
      scheduler.enqueueWork([
        () => {
          remove(current, parent, context)
          restoreAncestorSelect(parent)
        },
      ])
      scheduler.dequeue()
    },

    flush() {
      scheduler.dequeue()
    },
  })

  registerRoot(root)
  return root
}

function createRootFrameHandle(
  init: VirtualRootOptions['frameInit'],
  errorTarget: EventTarget,
  scheduler: Scheduler,
  styleManager: StyleManager | undefined,
  styleRoot: HTMLElement | undefined,
): FrameHandle {
  let frame = createFrameHandle({ src: init?.src ?? '/' })
  frame.$runtime = {
    styleManager,
    styleRoot,
    frameInit: init,
    errorTarget,
    scheduler,
    resolveFrame: missingFrameRuntime,
  }
  return frame
}

export function missingFrameRuntime(): never {
  throw new Error(
    'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
  )
}

type EmptyFn = () => void
type SchedulerPhaseType = 'beforeUpdate' | 'commit'
type SchedulerPhaseListener = EventListenerOrEventListenerObject | null

/**
 * Scheduler API used by the reconciler and frame runtime.
 */
export interface Scheduler {
  enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void
  enqueueWork(newTasks: EmptyFn[]): void
  enqueueCommitPhase(newTasks: EmptyFn[]): void
  enqueueTasks(newTasks: EmptyFn[]): void
  addEventListener(
    type: SchedulerPhaseType,
    listener: SchedulerPhaseListener,
    options?: AddEventListenerOptions | boolean,
  ): void
  removeEventListener(
    type: SchedulerPhaseType,
    listener: SchedulerPhaseListener,
    options?: EventListenerOptions | boolean,
  ): void
  dequeue(): void
}

const CASCADING_UPDATE_LIMIT = 50

export type SchedulerPhaseEvent = Event & {
  parents: ParentNode[]
}

/**
 * Creates the DOM update scheduler used by the component runtime.
 *
 * @param doc Document associated with the rendered tree.
 * @param rootTarget Event target that receives runtime errors.
 * @returns A scheduler instance.
 */
export function createScheduler(doc: Document, rootTarget: EventTarget): Scheduler {
  void doc
  let scheduled = new Map<CommittedComponentNode, ParentNode>()
  let workTasks: EmptyFn[] = []
  let commitPhaseTasks: EmptyFn[] = []
  let postCommitTasks: EmptyFn[] = []
  let flushState = 0 // 0=idle, 1=scheduled, 2=flushing
  let cascading:
    | {
        total: number
        byNode: WeakMap<CommittedComponentNode, number>
        byName: Map<string, number>
      }
    | undefined
  let phaseEvents: EventTarget | undefined

  function dispatchError(error: unknown) {
    console.error(error)
    rootTarget.dispatchEvent(createComponentErrorEvent(error))
  }

  function formatCounts(counts: Map<string, number>) {
    return Array.from(counts, ([name, count]) => `${name} x${count}`).join(', ')
  }

  function trackCascadingUpdate(vnode: CommittedComponentNode): boolean {
    if (!cascading) {
      cascading = { total: 0, byNode: new WeakMap(), byName: new Map() }
      setTimeout(() => {
        cascading = undefined
      }, 0)
    }
    let name = vnode.type.name || 'Anonymous'
    let nodeCount = (cascading.byNode.get(vnode) ?? 0) + 1
    cascading.byNode.set(vnode, nodeCount)
    cascading.byName.set(name, (cascading.byName.get(name) ?? 0) + 1)

    if (++cascading.total === CASCADING_UPDATE_LIMIT) {
      console.warn(
        `${cascading.total} cascading component updates detected in one event loop turn. Consider reducing hydration regions. Components: ${formatCounts(cascading.byName)}`,
      )
    }
    if (nodeCount > CASCADING_UPDATE_LIMIT) {
      dispatchError(
        new Error(
          `handle.update() infinite loop detected in ${name} after ${nodeCount} cascading updates. Components: ${formatCounts(cascading.byName)}`,
        ),
      )
      return false
    }
    return true
  }

  function flushQueue(queue: EmptyFn[]) {
    while (queue.length) {
      try {
        queue.shift()!()
      } catch (error) {
        dispatchError(error)
      }
    }
  }

  function dispatchPhase(type: SchedulerPhaseType, parents: ParentNode[]) {
    phaseEvents?.dispatchEvent(Object.assign(new Event(type), { parents }))
  }

  function flush() {
    if (flushState === 2) return
    flushState = 2
    try {
      while (
        scheduled.size ||
        workTasks.length ||
        commitPhaseTasks.length ||
        postCommitTasks.length
      ) {
        let batch = scheduled
        scheduled = new Map()

        let updateParents = batch.size ? Array.from(new Set(batch.values())) : []
        setActiveSchedulerUpdateParents(updateParents)
        dispatchPhase('beforeUpdate', updateParents)

        for (let [vnode, domParent] of batch) {
          let skipped = false
          for (let p = vnode._parent; p.kind !== 'root'; p = p._parent) {
            if (p.kind === 'component' && batch.has(p as CommittedComponentNode)) {
              skipped = true
              break
            }
          }
          if (skipped) continue
          if (!trackCascadingUpdate(vnode)) return
          try {
            renderComponent(vnode._content, vnode, domParent, vnode._context)
          } catch (error) {
            dispatchError(error)
          }
        }

        flushQueue(workTasks)
        setActiveSchedulerUpdateParents(undefined)

        flushQueue(commitPhaseTasks)
        dispatchPhase('commit', updateParents)
        flushQueue(postCommitTasks)
      }
    } finally {
      setActiveSchedulerUpdateParents(undefined)
      flushState = 0
    }
  }

  function scheduleFlush() {
    if (flushState) return
    flushState = 1
    queueMicrotask(flush)
  }

  return {
    enqueue(vnode, domParent) {
      scheduled.set(vnode, domParent)
      scheduleFlush()
    },
    enqueueWork(tasks) {
      workTasks.push(...tasks)
      scheduleFlush()
    },
    enqueueCommitPhase(tasks) {
      commitPhaseTasks.push(...tasks)
      scheduleFlush()
    },
    enqueueTasks(tasks) {
      postCommitTasks.push(...tasks)
      scheduleFlush()
    },
    addEventListener(type, listener, options) {
      ;(phaseEvents ??= new EventTarget()).addEventListener(type, listener, options)
    },
    removeEventListener(type, listener, options) {
      phaseEvents?.removeEventListener(type, listener, options)
    },
    dequeue: flush,
  }
}

// -- Reconciler --

export const ROOT_VNODE = Symbol('ROOT_VNODE')

export type VNodeKind =
  | 'root'
  | 'empty'
  | 'text'
  | 'fragment'
  | 'host'
  | 'component'
  | 'client-entry'
  | 'frame'
  | 'portal'

export type RuntimeElementProps = { [name: string]: unknown }

export type RuntimeHostProps = RuntimeElementProps & {
  children?: RemixNode
  innerHTML?: string
  srcDoc?: string
  srcdoc?: string
  mix?: MixinRuntimeValue
}

type PortalComponent = ElementFunction & { readonly [PORTAL_NODE]: PortalNodeRenderer }

type InputNodeBase<kind extends VNodeKind, type> = {
  kind: kind
  type: type
  key?: Key
  _parent?: never
}

export type NonRenderNode = InputNodeBase<'empty', false>
export type TextNode = InputNodeBase<'text', null> & { _text: string }
export type FragmentNode = InputNodeBase<'fragment', typeof Fragment> & { _children: VNodeInput[] }

type DirectEventSlot = {
  sync?: DirectEventSync
  state?: OnBinding[]
  list?: OnMixinDescriptor[]
}

type HostMixState = {
  _mp: RuntimeHostProps
  _mix?: MixinRuntime
  _ev?: DirectEventSlot
}

export type HostNode = InputNodeBase<'host', string> &
  Partial<HostMixState> & {
    props: RuntimeHostProps
    _children: VNodeInput[]
  }

export type ComponentNode = InputNodeBase<'component', ElementFunction> & {
  props: RuntimeElementProps
}

export type FrameNode = InputNodeBase<'frame', FrameComponent> & {
  props: RuntimeElementProps & FrameProps
}

export type PortalNode = InputNodeBase<'portal', PortalComponent> & {
  props: RuntimeElementProps & PortalProps
}

export type VNodeInput =
  | NonRenderNode
  | TextNode
  | FragmentNode
  | HostNode
  | ComponentNode
  | FrameNode
  | PortalNode

type MountedNodeBase = { _parent: VNodeParent; _svg: boolean }
type CommittedNodeBase<kind extends VNodeKind, type> = {
  kind: kind
  type: type
  key?: Key
} & MountedNodeBase

export type CommittedNonRenderNode = CommittedNodeBase<'empty', false>
export type CommittedTextNode = CommittedNodeBase<'text', null> & { _text: string; _dom: Text }
export type HostPersistenceState = { parent: ParentNode; token: number }

type ControlledState = {
  update(type: string, props: RuntimeHostProps): void
  dispose(detach: boolean): void
}

export type CommittedHostNode = CommittedNodeBase<'host', string> &
  HostMixState & {
    props: RuntimeHostProps
    _children: CommittedVNode[]
    _dom: Element
    _ctrl?: ControlledState
    _persisted?: HostPersistenceState
  }

export type CommittedFragmentNode = CommittedNodeBase<'fragment', typeof Fragment> & {
  _children: CommittedVNode[]
}

export type MountingComponentNode = CommittedNodeBase<'component', ElementFunction> & {
  props: RuntimeElementProps
  _handle: ComponentHandle
  _context: ReconcileContext
}

export type CommittedComponentNode = MountingComponentNode & { _content: CommittedVNode }

export type CommittedClientEntryNode = CommittedNodeBase<'client-entry', ElementFunction> & {
  props: RuntimeElementProps
  _rangeStart: Comment
  _rangeEnd: Comment
}

export type CommittedFrameNode = CommittedNodeBase<'frame', FrameComponent> & {
  props: RuntimeElementProps & FrameProps
  _rangeStart: Comment
  _rangeEnd: Comment
  _state: FrameMountState
}

export type CommittedPortalNode = CommittedNodeBase<'portal', PortalComponent> & {
  props: RuntimeElementProps & PortalProps
  _container: HTMLElement
  _rangeStart: Comment
  _rangeEnd: Comment
  _children: CommittedVNode[]
  _removed?: boolean
}

export type CommittedVNode =
  | CommittedNonRenderNode
  | CommittedTextNode
  | CommittedFragmentNode
  | CommittedHostNode
  | CommittedComponentNode
  | CommittedClientEntryNode
  | CommittedFrameNode
  | CommittedPortalNode

export type RootVNode = {
  kind: 'root'
  type: typeof ROOT_VNODE
  _children: CommittedVNode[]
  _svg: boolean
  _getContext?: (type: ElementFunction) => unknown
  _rangeStart?: Node
  _rangeEnd?: Node
  _hid?: string
  _nonces?: ResourceNonces
}

export interface ReconcileContext {
  frame: FrameHandle
  scheduler: Scheduler
  styles?: StyleManager
  rootTarget: EventTarget
  _portals?: Set<CommittedPortalNode> | null
}

export type VNodeParent =
  | RootVNode
  | CommittedFragmentNode
  | CommittedHostNode
  | CommittedPortalNode
  | MountingComponentNode
  | CommittedComponentNode

export type VNode = VNodeInput | CommittedVNode | RootVNode | MountingComponentNode
export type HydrationCursor = { current: Node | null | undefined }

/**
 * Renders `<Frame>` nodes. The frame runtime attaches it to the built-in `Frame` component so the
 * reconciler can render frames without importing the frame runtime.
 */
export interface FrameNodeRenderer {
  insert(
    node: FrameNode,
    domParent: ParentNode,
    vParent: VNodeParent,
    context: ReconcileContext,
    svg: boolean,
    anchor?: Node,
    cursor?: HydrationCursor,
  ): CommittedFrameNode
  diff(
    curr: CommittedFrameNode,
    next: FrameNode,
    domParent: ParentNode,
    vParent: VNodeParent,
    context: ReconcileContext,
    svg: boolean,
    anchor?: Node,
  ): CommittedFrameNode
  dispose(node: CommittedFrameNode): void
}

export type FrameComponent = ElementFunction & { readonly [FRAME_NODE]: FrameNodeRenderer }

type OptionalFrameRuntime = {
  topFrame?: FrameHandle
  registry?: { get(name: string): FrameHandle | undefined }
  nonceManager?: NonceManager
  clientEntries?: ClientEntryBoundaryRuntime
}

const EMPTY_DIRECT_EVENTS: OnMixinDescriptor[] = []
const EMPTY_CHILDREN: CommittedVNode[] = []
const EMPTY_VNODE_INPUTS: VNodeInput[] = []
const EMPTY_PROPS: RuntimeHostProps = {}
const controlledSelectValues = new WeakMap<HTMLSelectElement, unknown>()
let controlledSelectCount = 0
const frameFramesCache = new WeakMap<FrameHandle, Handle['frames']>()

function getFrameFrames(frame: FrameHandle): Handle['frames'] {
  let cached = frameFramesCache.get(frame)
  if (cached) return cached
  cached = {
    get top() {
      return (frame.$runtime as OptionalFrameRuntime | undefined)?.topFrame ?? frame
    },
    get(name) {
      return (frame.$runtime as OptionalFrameRuntime | undefined)?.registry?.get(name)
    },
  }
  frameFramesCache.set(frame, cached)
  return cached
}

let idCounter = 0
export let portalRanges: PortalRanges | undefined

export function setPortalRanges(ranges: PortalRanges): PortalRanges {
  return (portalRanges = ranges)
}

export function excludePortalRanges(nodes: Node[], parent?: Node): Node[] {
  return portalRanges?.exclude(nodes, parent) ?? nodes
}

export function insertDomNode(dom: Node, domParent: ParentNode, anchor?: Node): void {
  domParent.insertBefore(dom, anchor ?? null)
}

export function findContextFromAncestry(node: VNodeParent, type: ElementFunction): unknown {
  let cur = node
  while (cur.kind !== 'root') {
    if (cur.kind === 'component' && cur.type === type) return cur._handle.getContextValue()
    cur = cur._parent
  }
  return cur._getContext?.(type)
}

export function childrenToVNodes(children: RemixNode, hostChild = true): VNodeInput[] {
  if (children === undefined) return EMPTY_VNODE_INPUTS
  if (!Array.isArray(children)) return [toVNode(children, hostChild)]
  let list = normalizeChildren(children)
  let len = list.length
  if (len === 0) return EMPTY_VNODE_INPUTS
  // When every child is a primitive (e.g. `$${amount}`), merge into one text node so hydration
  // matches the single server text node without calling splitText().
  if (len > 1 && isPrimitiveChild(list[0])) {
    let allPrimitives = true
    for (let i = 1; i < len; i++) {
      if (!isPrimitiveChild(list[i])) {
        allPrimitives = false
        break
      }
    }
    if (allPrimitives) {
      let text = String(list[0])
      for (let i = 1; i < len; i++) text += String(list[i])
      return [{ kind: 'text', type: null, _text: text }]
    }
  }
  let out: VNodeInput[] = new Array(len)
  for (let i = 0; i < len; i++) out[i] = toVNode(list[i], hostChild)
  return out
}

export function toVNode(node: unknown, hostChild = false): VNodeInput {
  if (isEmptyChild(node)) return { kind: 'empty', type: false }
  if (isPrimitiveChild(node)) return { kind: 'text', type: null, _text: String(node) }
  if (Array.isArray(node)) {
    return { kind: 'fragment', type: Fragment, _children: childrenToVNodes(node, hostChild) }
  }
  if (isRemixElement(node)) {
    let { type, props, key } = node
    if (type === Fragment || typeof type === 'string') {
      let hostProps = parseHostProps(props)
      if (type === Fragment) {
        return {
          kind: 'fragment',
          type: Fragment,
          key,
          _children: childrenToVNodes(hostProps.children),
        }
      }
      let children: VNodeInput[]
      if (hostProps.innerHTML != null) {
        invariant(isRemixNode(hostProps.children), 'Invalid host children')
        children = []
      } else {
        children = childrenToVNodes(hostProps.children)
      }
      return { kind: 'host', type: type as string, key, props: hostProps, _children: children }
    }
    invariant(typeof type === 'function', 'Expected component element type')
    let fn = type as ElementFunction
    if (fn === Portal && Object.hasOwn(fn, PORTAL_NODE)) {
      let p = fn as PortalComponent
      return { kind: 'portal', type: p, key, props: p[PORTAL_NODE].parseProps(props) }
    }
    if (Object.hasOwn(fn, FRAME_NODE)) {
      invariant(
        typeof props.src === 'string' && props.src.length > 0,
        '<Frame /> requires a src prop',
      )
      return {
        kind: 'frame',
        type: fn as FrameComponent,
        key,
        props: props as RuntimeElementProps & FrameProps,
      }
    }
    return { kind: 'component', type: fn, key, props }
  }
  invariant(false, hostChild ? 'Invalid host children' : 'Unexpected RemixNode')
}

export function parseHostProps(props: RuntimeElementProps): RuntimeHostProps {
  let normalized = normalizeUnsafeHTMLProps(props)
  let mix = normalized.mix
  if (mix !== undefined) {
    if (Array.isArray(mix)) {
      for (let i = 0; i < mix.length; i++) {
        invariant(isMixinDescriptor(mix[i]), 'Invalid mix prop')
      }
    } else {
      invariant(isMixinDescriptor(mix), 'Invalid mix prop')
    }
  }
  return normalized
}

function createControlledState(node: CommittedHostNode, scheduler: Scheduler): ControlledState {
  let element = node._dom
  let select = element instanceof HTMLSelectElement ? element : null
  let version: number | null = 0
  let value: unknown
  let checked: unknown

  let listener = {
    handleEvent(event: Event) {
      if (version === null || (event.type === 'input' && (checked !== undefined || select))) return
      let v = ++version
      queueMicrotask(() => {
        if (v !== version) return
        let el = element as Element & Record<string, unknown>
        if (value !== undefined && 'value' in el && el.value !== value) {
          if (select) setSelectValue(select, value)
          else el.value = value ?? ''
        }
        if (checked !== undefined && 'checked' in el && el.checked !== checked) {
          el.checked = checked === '' ? true : (checked ?? '')
        }
      })
    },
  }

  scheduler.enqueueTasks([
    () => {
      if (version === null) return
      element.addEventListener('input', listener)
      element.addEventListener('change', listener)
    },
  ])

  return {
    update(type, props) {
      if (version === null) return
      value = type !== 'progress' && 'value' in element ? props.value : undefined
      checked = 'checked' in element ? props.checked : undefined
      version++
      if (select) {
        if (value === undefined) {
          if (controlledSelectValues.delete(select)) controlledSelectCount--
        } else {
          if (!controlledSelectValues.has(select)) controlledSelectCount++
          controlledSelectValues.set(select, value)
          setSelectValue(select, value)
        }
      }
    },
    dispose(detach) {
      if (detach) {
        element.removeEventListener('input', listener)
        element.removeEventListener('change', listener)
      }
      version = null
      if (select && controlledSelectValues.delete(select)) controlledSelectCount--
    },
  }
}

function isElementNode(node: Node | null | undefined): node is Element {
  return node != null && node.nodeType === 1
}

export function restoreAncestorSelect(parent: ParentNode): void {
  if (controlledSelectCount === 0) return
  let select = isElementNode(parent) ? parent.closest('select') : null
  if (select instanceof HTMLSelectElement) {
    let value = controlledSelectValues.get(select)
    if (value !== undefined) setSelectValue(select, value)
  }
}

function isAllDirectEvents(mix: Array<{ type: object }>): mix is OnMixinDescriptor[] {
  for (let i = 0; i < mix.length; i++) {
    if (!(DIRECT_EVENT in mix[i].type)) return false
  }
  return true
}

function resolveNodeMixProps(
  node: HostNode | CommittedHostNode,
  parent: VNodeParent,
  frame: FrameHandle,
  scheduler: Scheduler,
  prevState?: MixinRuntime,
  prevEv?: DirectEventSlot,
): RuntimeHostProps {
  let mix = node.props.mix
  let props = node.props
  if (mix || prevState || prevEv) {
    let direct: OnMixinDescriptor[] | null = !mix
      ? EMPTY_DIRECT_EVENTS
      : Array.isArray(mix)
        ? isAllDirectEvents(mix)
          ? mix
          : null
        : DIRECT_EVENT in (mix as { type: object }).type
          ? [mix as unknown as OnMixinDescriptor]
          : null

    if (direct) {
      prevState?.teardown()
      node._mix = undefined
      if (direct.length || prevEv) {
        node._ev = {
          sync: direct.length
            ? (direct[0].type as unknown as Record<PropertyKey, DirectEventSync>)[DIRECT_EVENT]
            : prevEv?.sync,
          state: prevEv?.state,
          list: direct,
        }
      }
    } else {
      let list = Array.isArray(mix) ? mix : [mix]
      let driver: MixinDriver | undefined
      for (let d of list) {
        driver = (d.type as Record<PropertyKey, MixinDriver | undefined>)[MIXIN_RUNTIME]
        if (driver) break
      }
      driver ??= defaultMixinDriver as MixinDriver | undefined
      invariant(driver, 'Invalid mix prop')
      props = driver.resolve(node, parent, frame, scheduler, prevState)
      if (prevEv) node._ev = { sync: prevEv.sync, state: prevEv.state }
    }
  }
  let nm = (frame.$runtime as OptionalFrameRuntime | undefined)?.nonceManager
  return (node._mp = nm ? nm.resolveResourceNonce(node.type, props, parent) : props)
}

export function syncHostControls(node: CommittedHostNode, scheduler: Scheduler): void {
  let ev = node._ev
  if (ev?.sync) {
    ev.state = ev.sync(node._dom, ev.state, ev.list, true)
    if (!ev.state) node._ev = undefined
  }
  let props = node._mp
  if (node._ctrl || props.value !== undefined || props.checked !== undefined) {
    ;(node._ctrl ??= createControlledState(node, scheduler)).update(node.type, props)
  }
}

export function diffVNodes(
  curr: CommittedVNode | null,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node | null,
  cursor?: HydrationCursor,
): CommittedVNode {
  if (context._portals !== undefined) {
    return reconcileVNodes(curr, next, domParent, vParent, context, anchor, cursor)
  }
  context._portals = null
  try {
    return reconcileVNodes(curr, next, domParent, vParent, context, anchor, cursor)
  } catch (error) {
    for (let portal of context._portals ?? []) remove(portal, null, context)
    throw error
  } finally {
    context._portals = undefined
  }
}

export function replace(
  curr: CommittedVNode,
  next: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  anchor?: Node | null,
): CommittedVNode {
  let first = findEdgeDomNode(curr, false)
  let marker: Comment | undefined
  if (first?.parentNode === domParent) {
    domParent.insertBefore((marker = document.createComment('rmx:replace')), first)
    anchor = marker
  } else {
    anchor = findNextSiblingDomAnchor(curr, anchor)
  }
  try {
    remove(curr, domParent, context)
    return reconcileVNodes(null, next, domParent, vParent, context, anchor)
  } finally {
    marker?.remove()
  }
}

function isEntryType(type: unknown): boolean {
  return typeof type === 'function' && (type as { $entry?: boolean }).$entry === true
}

export function reconcileVNodes(
  curr: CommittedVNode | null,
  node: VNodeInput,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  fragmentEnd?: Node | null,
  cursor?: HydrationCursor,
): CommittedVNode {
  let anchor = fragmentEnd ?? undefined
  if (curr) {
    if (curr.kind === 'client-entry' && node.kind === 'component' && isEntryType(node.type)) {
      return renderClientEntryBoundary(
        node,
        vParent,
        curr._svg,
        curr._rangeStart,
        curr._rangeEnd,
        context,
      )
    }
    if (
      (componentStalenessCheck &&
        curr.kind === 'component' &&
        node.kind === 'component' &&
        componentStalenessCheck(curr.type) === true) ||
      curr.kind !== node.kind ||
      curr.type !== node.type
    ) {
      return replace(curr, node, domParent, vParent, context, fragmentEnd)
    }
  }

  let { frame } = context
  let svg =
    node.kind === 'host'
      ? node.type === 'svg'
        ? true
        : node.type === 'foreignObject'
          ? false
          : vParent._svg
      : vParent._svg
  let linked = node as unknown as MountedNodeBase
  linked._parent = vParent
  linked._svg = svg

  if (!curr && cursor) {
    let cur = cursor.current ?? null
    if (
      cur !== null &&
      cur !== anchor &&
      (cur.nodeType === 3 || (isElementNode(cur) && cur.localName !== 'style'))
    ) {
      // Fast path: cursor already points at an ordinary element or text node.
    } else {
      let hydrationNode = nextHydrationNode(
        cur,
        node.kind !== 'host' &&
          node.kind !== 'frame' &&
          (node.kind !== 'text' || node._text === ''),
        anchor,
      )
      cursor.current = hydrationNode
      if (
        vParent.kind !== 'root' &&
        node.kind === 'component' &&
        isEntryType(node.type) &&
        hydrationNode?.nodeType === 8
      ) {
        let end = (frame.$runtime as OptionalFrameRuntime | undefined)?.clientEntries?.getEnd(
          hydrationNode as Comment,
        )
        if (end) {
          let committed = renderClientEntryBoundary(
            node,
            vParent,
            svg,
            hydrationNode as Comment,
            end,
            context,
          )
          cursor.current = end.nextSibling
          return committed
        }
      }
    }
  }

  switch (node.kind) {
    case 'empty':
      return node as unknown as CommittedNonRenderNode
    case 'text':
      return reconcileText(curr?.kind === 'text' ? curr : null, node, domParent, anchor, cursor)
    case 'host':
      return reconcileHost(
        curr?.kind === 'host' ? curr : null,
        node,
        domParent,
        vParent,
        context,
        svg,
        anchor,
        cursor,
      )
    case 'fragment': {
      let childAnchor = anchor
      if (curr) {
        let last = findEdgeDomNode(curr, true)
        childAnchor =
          last?.parentNode === domParent
            ? (last.nextSibling ?? undefined)
            : (findNextSiblingDomAnchor(curr, fragmentEnd) ?? undefined)
      }
      let committed = node as unknown as CommittedFragmentNode
      let childInputs = node._children
      committed._children = EMPTY_CHILDREN
      committed._children = diffChildren(
        curr?.kind === 'fragment' ? curr._children : null,
        childInputs,
        domParent,
        committed,
        context,
        curr ? undefined : cursor,
        childAnchor,
      )
      return committed
    }
    case 'component': {
      let handle: ComponentHandle
      if (!curr) {
        let id = vParent.kind === 'root' ? vParent._hid : undefined
        if (id && vParent.kind === 'root') vParent._hid = undefined
        else id = `c${++idCounter}`
        handle = createComponent({
          id,
          frame,
          type: node.type,
          getContext: (type: ElementFunction) => findContextFromAncestry(vParent, type),
          frames: getFrameFrames(frame),
        })
      } else {
        handle = (curr as CommittedComponentNode)._handle
      }
      let mounting = node as unknown as MountingComponentNode
      mounting._handle = handle
      mounting._context = context
      return renderComponent(
        curr ? (curr as CommittedComponentNode)._content : null,
        mounting,
        domParent,
        context,
        fragmentEnd,
        cursor,
      )
    }
    case 'portal':
      return node.type[PORTAL_NODE].reconcile(
        curr?.kind === 'portal' ? curr : null,
        node,
        domParent,
        vParent,
        context,
        fragmentEnd,
      )
    case 'frame':
      if (curr?.kind === 'frame') {
        if (fragmentEnd === undefined) anchor = findNextSiblingDomAnchor(curr) ?? undefined
        return node.type[FRAME_NODE].diff(curr, node, domParent, vParent, context, svg, anchor)
      }
      return node.type[FRAME_NODE].insert(node, domParent, vParent, context, svg, anchor, cursor)
  }
}

function isHeadTag(type: string): boolean {
  return type === 'head' || (type.length === 4 && type.toLowerCase() === 'head')
}

function reconcileHost(
  curr: CommittedHostNode | null,
  node: HostNode,
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  svg: boolean,
  anchor: Node | undefined,
  cursor: HydrationCursor | undefined,
): CommittedHostNode {
  let { frame, scheduler } = context
  let targetHead = isHeadTag(node.type)
    ? domParent instanceof Document
      ? domParent.head
      : domParent instanceof Node
        ? (domParent.ownerDocument?.head ?? null)
        : null
    : null
  let reclaimed = false

  if (!curr && !targetHead && node.key != null) {
    curr =
      (defaultMixinDriver as MixinDriver | undefined)?.reclaim(
        node.type,
        node.key,
        domParent,
        vParent,
      ) ?? null
    reclaimed = !!curr
  }

  let resolved = resolveNodeMixProps(node, vParent, frame, scheduler, curr?._mix, curr?._ev)
  let childInputs = node._children
  let dom: Element | undefined
  let childCursor: HydrationCursor | undefined
  let hydratedMatch = false
  let shouldInsertDom = false
  let bindParent: ParentNode | undefined
  let editedBeforeHydration: 'value' | 'checked' | undefined
  let prevProps: RuntimeHostProps = curr ? curr._mp : EMPTY_PROPS
  let patchTargetProps = resolved
  let dispatchInline = false
  let tag = node.type

  if (curr) {
    dom = curr._dom
    dispatchInline = !!(
      (reclaimed || node._mix?.hasSlots) &&
      node._mix?.driver.shouldDispatchInline(dom)
    )
    if (dispatchInline) node._mix?.dispatchUpdate('beforeUpdate')
  } else if (targetHead) {
    dom = targetHead
    let h = cursor?.current
    childCursor = cursor ? { current: h } : undefined
    if (isElementNode(h) && h.localName === 'head') {
      if (childCursor) childCursor.current = h.firstChild
      let next = h.nextSibling
      if (h !== targetHead) {
        while (h.firstChild) targetHead.appendChild(h.firstChild)
        h.remove()
      }
      if (cursor) cursor.current = next
    }
  } else {
    let h = cursor?.current
    if (isElementNode(h)) {
      let cursorTag = svg ? h.tagName : h.localName
      let match: Element | null = cursorTag === tag ? h : null
      if (!match) {
        let sib = nextHydrationNode(h.nextSibling, false, anchor)
        if (isElementNode(sib) && (svg ? sib.tagName : sib.localName) === tag) {
          match = sib
        }
      }
      if (match) {
        dom = match
        hydratedMatch = true
        if (childInputs.length > 0 && resolved.innerHTML == null) {
          childCursor = { current: match.firstChild }
        }
        if (cursor) cursor.current = match.nextSibling
      } else {
        console.error('Hydration mismatch:', 'tag', cursorTag, tag)
        if (cursor) cursor.current = undefined
      }
    }
    if (!dom) {
      dom = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag)
      shouldInsertDom = true
      bindParent = domParent
    }
    if (hydratedMatch && (tag === 'option' || tag === 'input' || tag === 'textarea')) {
      if (tag === 'option' && dom instanceof HTMLOptionElement) {
        patchTargetProps = { ...resolved, selected: undefined }
      }
      if (
        tag === 'input' &&
        dom instanceof HTMLInputElement &&
        (dom.type === 'checkbox' || dom.type === 'radio')
      ) {
        if (dom.checked !== dom.defaultChecked) editedBeforeHydration = 'checked'
      } else if (
        (dom instanceof HTMLInputElement || dom instanceof HTMLTextAreaElement) &&
        dom.value !== dom.defaultValue
      ) {
        let pristine = dom.cloneNode() as HTMLInputElement | HTMLTextAreaElement
        pristine.value = dom.defaultValue
        if (pristine.value !== dom.value) editedBeforeHydration = 'value'
      }
      if (editedBeforeHydration) {
        patchTargetProps = { ...patchTargetProps, [editedBeforeHydration]: undefined }
      }
    }
  }

  let committed = node as unknown as CommittedHostNode
  committed._dom = dom
  committed._children = EMPTY_CHILDREN
  if (curr) committed._ctrl = curr._ctrl

  let hydrating = hydratedMatch
  let patchBeforeChildren = (!curr && !targetHead) || reclaimed
  if (patchBeforeChildren) {
    patchHostProps(prevProps, patchTargetProps, dom, svg, hydrating)
    if (reclaimed) syncHostControls(committed, scheduler)
  }

  if (curr) {
    if (prevProps.innerHTML != resolved.innerHTML) {
      let html = resolved.innerHTML ?? ''
      if (portalRanges?.has(dom)) portalRanges.setInnerHTML(dom, html)
      else dom.innerHTML = html
    }
    committed._children = diffChildren(curr._children, childInputs, dom, committed, context)
  } else if (resolved.innerHTML != null) {
    dom.innerHTML = resolved.innerHTML
  } else {
    committed._children = diffChildren(null, childInputs, dom, committed, context, childCursor)
  }

  if (!curr && !targetHead && !hydratedMatch && (tag === 'select' || tag === 'option')) {
    if (dom instanceof HTMLSelectElement) {
      let value = resolved.value ?? resolved.defaultValue
      if (value != null) {
        setSelectDefaultValue(
          dom,
          value,
          !dom.multiple || (resolved.value != null && !Array.isArray(value)),
        )
      }
    } else if (dom instanceof HTMLOptionElement) {
      dom.defaultSelected = resolved.selected === '' || Boolean(resolved.selected)
    }
  }

  if (!patchBeforeChildren) patchHostProps(prevProps, patchTargetProps, dom, svg, false)
  if (!reclaimed) syncHostControls(committed, scheduler)
  committed._mix?.bind(committed, context, reclaimed, bindParent)

  if (curr && (reclaimed ? committed._mix?.driver.shouldDispatchInline(dom) : dispatchInline)) {
    scheduler.enqueueCommitPhase([() => committed._mix?.dispatchUpdate('commit')])
  }

  if (editedBeforeHydration) {
    let el = dom
    scheduler.enqueueTasks([
      () => {
        if (
          !el.isConnected ||
          (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked)
        )
          return
        el.dispatchEvent(new Event('input', { bubbles: true }))
        if (
          el.ownerDocument.activeElement !== el ||
          (el instanceof HTMLInputElement && /^(?:checkbox|radio|range|color|file)$/.test(el.type))
        ) {
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      },
    ])
  }

  if (shouldInsertDom) insertDomNode(dom, domParent, anchor)
  return committed
}

function reconcileText(
  curr: CommittedTextNode | null,
  node: TextNode,
  domParent: ParentNode,
  anchor: Node | undefined,
  cursor: HydrationCursor | undefined,
): CommittedTextNode {
  let h = cursor?.current
  let text = node._text
  let dom: Text
  if (curr) {
    dom = curr._dom
    if (curr._text !== text) dom.data = text
  } else if (h && h.nodeType === 3) {
    dom = h as Text
    if (dom.data !== text) {
      if (dom.data.startsWith(text)) {
        dom.splitText(text.length)
      } else {
        if (text.startsWith(dom.data)) {
          let rem = text.slice(dom.length)
          let sib = dom.nextSibling
          while (rem && sib && sib !== anchor && sib.nodeType === 3) {
            let sibText = sib as Text
            if (!rem.startsWith(sibText.data)) {
              if (sibText.data.startsWith(rem)) sibText.deleteData(0, rem.length)
              break
            }
            rem = rem.slice(sibText.length)
            sibText.remove()
            sib = dom.nextSibling
          }
        } else {
          console.error('Hydration mismatch:', 'text mismatch', dom.data, text)
        }
        dom.data = text
      }
    }
    if (cursor) cursor.current = dom.nextSibling
  } else {
    dom = document.createTextNode(text)
    insertDomNode(dom, domParent, h?.parentNode === domParent ? h : anchor)
  }
  let committed = node as unknown as CommittedTextNode
  committed._dom = dom
  return committed
}

function removeDomRange(start: Node, end: Node, domParent: ParentNode): void {
  for (let cur: Node | null = start; cur; ) {
    let next: Node | null = cur.nextSibling
    if (cur.parentNode === domParent) domParent.removeChild(cur)
    if (cur === end) break
    cur = next
  }
}

function nextHydrationNode(
  cursor: Node | null,
  preserveClientEntry: boolean,
  anchor?: Node,
): Node | null {
  while (cursor && cursor !== anchor) {
    if (cursor.nodeType === 8) {
      let portalEnd = portalRanges?.ends.get(cursor)
      if (portalEnd) {
        cursor = portalEnd.nextSibling
        continue
      }
      let data = (cursor as Comment).data.trim()
      if (data.startsWith('rmx:f:') || (preserveClientEntry && data.startsWith('rmx:h:'))) {
        return cursor
      }
      cursor = cursor.nextSibling
      continue
    }
    if (
      cursor.nodeType === 1 &&
      (cursor as Element).localName === 'style' &&
      (cursor as Element).hasAttribute('data-rmx-style')
    ) {
      cursor = cursor.nextSibling
      continue
    }
    break
  }
  return cursor === anchor ? null : cursor
}

export function renderComponent(
  currContent: CommittedVNode | null,
  next: MountingComponentNode | CommittedComponentNode,
  domParent: ParentNode,
  context: ReconcileContext,
  anchor?: Node | null,
  cursor?: HydrationCursor,
): CommittedComponentNode {
  let { scheduler } = context
  let handle = next._handle
  if (handle.isRemoved()) {
    invariant('_content' in next, 'Expected removed component to be committed')
    return next
  }
  let [element, tasks] = handle.render(next.props)
  let committed = next as CommittedComponentNode
  committed._content = diffVNodes(
    currContent,
    toVNode(element),
    domParent,
    next,
    context,
    anchor,
    cursor,
  )
  handle.setScheduleUpdate(scheduler, committed, domParent)
  restoreAncestorSelect(domParent)
  scheduler.enqueueTasks(tasks)
  return committed
}

function renderClientEntryBoundary(
  node: ComponentNode,
  parent: VNodeParent,
  svg: boolean,
  start: Comment,
  end: Comment,
  context: ReconcileContext,
): CommittedClientEntryNode {
  let committed: CommittedClientEntryNode = {
    kind: 'client-entry',
    type: node.type,
    key: node.key,
    props: node.props,
    _parent: parent,
    _svg: svg,
    _rangeStart: start,
    _rangeEnd: end,
  }
  ;(context.frame.$runtime as OptionalFrameRuntime | undefined)?.clientEntries?.render(
    start,
    end,
    jsx(node.type, node.props, node.key),
    parent,
  )
  return committed
}

export function remove(
  node: CommittedVNode,
  domParent: ParentNode | null,
  context: ReconcileContext,
): void {
  switch (node.kind) {
    case 'text':
      if (domParent) node._dom.remove()
      return
    case 'host':
      if (domParent && node._mix?.deferRemoval(node, domParent, context, performHostNodeRemoval)) {
        return
      }
      performHostNodeRemoval(node, domParent, context)
      return
    case 'fragment':
      for (let child of node._children) remove(child, domParent, context)
      return
    case 'component':
      remove(node._content, domParent, context)
      context.scheduler.enqueueTasks(node._handle.remove())
      return
    case 'client-entry': {
      let disposed =
        (context.frame.$runtime as OptionalFrameRuntime | undefined)?.clientEntries?.dispose(
          node._rangeStart,
        ) ?? false
      if (!domParent) return
      if (disposed) {
        node._rangeStart.remove()
        node._rangeEnd.remove()
      } else {
        removeDomRange(node._rangeStart, node._rangeEnd, domParent)
      }
      return
    }
    case 'portal':
      node.type[PORTAL_NODE].dispose(node, context)
      return
    case 'frame':
      node.type[FRAME_NODE].dispose(node)
      if (domParent) removeDomRange(node._rangeStart, node._rangeEnd, domParent)
      return
  }
}

function performHostNodeRemoval(
  node: CommittedHostNode,
  domParent: ParentNode | null,
  context: ReconcileContext,
): void {
  let isHead = domParent !== null && isHeadTag(node.type)
  for (let child of node._children) remove(child, isHead ? node._dom : null, context)
  node._mix?.teardown()
  if (node._ev?.sync) {
    node._ev.state = node._ev.sync(node._dom, node._ev.state, undefined, isHead)
  }
  node._ctrl?.dispose(isHead)
  if (domParent && !isHead) node._dom.remove()
}

export function diffChildren(
  curr: CommittedVNode[] | null,
  next: VNodeInput[],
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  cursor?: HydrationCursor,
  anchor?: Node,
): CommittedVNode[] {
  if (
    !next.length &&
    curr?.length &&
    anchor === undefined &&
    vParent.kind !== 'fragment' &&
    !portalRanges?.has(domParent) &&
    !(vParent.kind === 'host' && vParent._mp.innerHTML != null) &&
    curr.every(canBulkClearNode)
  ) {
    for (let child of curr) remove(child, null, context)
    domParent.textContent = ''
    return EMPTY_CHILDREN
  }

  let hasKeys = false
  for (let i = 0; i < next.length; i++) {
    if (next[i].key != null) {
      hasKeys = true
      break
    }
  }
  if (hasKeys) {
    if (curr) {
      let inOrder = curr.length === next.length
      for (let i = 0; inOrder && i < next.length; i++) {
        if (next[i].key == null || curr[i].key !== next[i].key || curr[i].type !== next[i].type) {
          inOrder = false
        }
      }
      if (!inOrder)
        return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor)
    } else if (vParent.kind !== 'fragment') {
      warnDuplicateKeys(next)
    }
  }

  curr ??= EMPTY_CHILDREN
  let committed: Array<VNodeInput | CommittedVNode> = next
  for (let i = 0; i < next.length; i++) {
    committed[i] = reconcileVNodes(
      curr[i] ?? null,
      next[i],
      domParent,
      vParent,
      context,
      anchor ?? null,
      cursor,
    )
  }
  for (let i = next.length; i < curr.length; i++) remove(curr[i], domParent, context)
  return committed as CommittedVNode[]
}

function canBulkClearNode(node: CommittedVNode): boolean {
  if (node.kind === 'component') return canBulkClearNode(node._content)
  if (node.kind === 'host' || node.kind === 'fragment') {
    return (node.kind !== 'host' || !node._mix) && node._children.every(canBulkClearNode)
  }
  return node.kind === 'text'
}

function warnDuplicateKeys(children: Array<{ key?: Key }>): void {
  let seen = new Set<Key>()
  let dups: Set<Key> | undefined
  for (let node of children) {
    if (node.key == null) continue
    if (seen.has(node.key)) (dups ??= new Set()).add(node.key)
    else seen.add(node.key)
  }
  if (dups?.size) {
    console.warn(
      `Duplicate keys detected in siblings: ${Array.from(dups, (k) => `"${String(k)}"`).join(', ')}. Keys should be unique.`,
    )
  }
}

function patchKeyedChildren(
  curr: CommittedVNode[],
  next: VNodeInput[],
  domParent: ParentNode,
  vParent: VNodeParent,
  context: ReconcileContext,
  cursor?: HydrationCursor,
  anchor?: Node,
): CommittedVNode[] {
  warnDuplicateKeys(next)

  let oldKeys = new Map<Key, number>()
  let lastUnkeyed = new Map<CommittedVNode['type'], number>()
  for (let i = 0; i < curr.length; i++) {
    let key = curr[i].key
    if (key != null) oldKeys.set(key, i)
    else lastUnkeyed.set(curr[i].type, i)
  }

  let nextUnkeyed = 0
  let inserted = 0
  let lastOldIndex = -1
  let needsPlacement = false
  let usedOld = new Uint8Array(curr.length)
  let matches: number[] = []

  for (let i = 0; i < next.length; i++) {
    let { key, type } = next[i]
    let oldIndex = -1
    if (key != null) {
      let candidate = oldKeys.get(key)
      if (candidate !== undefined && curr[candidate].type === type) {
        oldKeys.delete(key)
        oldIndex = candidate
      }
    } else if ((lastUnkeyed.get(type) ?? -1) >= nextUnkeyed) {
      for (let j = nextUnkeyed; j < curr.length; j++) {
        if (curr[j].key == null && curr[j].type === type) {
          nextUnkeyed = j + 1
          oldIndex = j
          break
        }
      }
    }
    matches[i] = oldIndex
    if (oldIndex < 0) inserted++
    else {
      usedOld[oldIndex] = 1
      if (inserted > 0 || oldIndex < lastOldIndex) needsPlacement = true
      lastOldIndex = oldIndex
    }
  }

  if (matches.length - inserted < curr.length) {
    for (let i = 0; i < curr.length; i++) {
      if (!usedOld[i]) remove(curr[i], domParent, context)
    }
  }

  let stableIndexes = needsPlacement
    ? getStableIndexes(matches, (oldIndex) => !!findEdgeDomNode(curr[oldIndex], false))
    : null
  let stableCursor = 0
  let cachedStableIndex = -1
  let stableAnchor: Node | undefined
  let committed: Array<VNodeInput | CommittedVNode> = next

  for (let i = 0; i < next.length; i++) {
    let oldIndex = matches[i]
    let oldNode = oldIndex < 0 ? null : curr[oldIndex]
    let insertAnchor = anchor
    if (stableIndexes) {
      let nextStable = stableIndexes[stableCursor]
      if (i === nextStable) {
        stableCursor++
      } else if (!oldNode && !cursor && nextStable !== undefined) {
        if (cachedStableIndex !== nextStable) {
          cachedStableIndex = nextStable
          stableAnchor = findEdgeDomNode(curr[matches[nextStable]], false) ?? anchor
        }
        insertAnchor = stableAnchor
      }
    }
    committed[i] = reconcileVNodes(
      oldNode,
      next[i],
      domParent,
      vParent,
      context,
      insertAnchor ?? null,
      cursor,
    )
  }

  let result = committed as CommittedVNode[]
  if (!stableIndexes) return result

  stableCursor = stableIndexes.length - 1
  let placementAnchor: Node | null = anchor ?? null
  for (let i = next.length - 1; i >= 0; i--) {
    let nextNode = result[i]
    if (stableIndexes[stableCursor] === i) stableCursor--
    else placeVNode(nextNode, domParent, placementAnchor)
    placementAnchor = findEdgeDomNode(nextNode, false) ?? placementAnchor
  }
  return result
}

// Return positions of the longest increasing subsequence of reusable old indexes.
export function getStableIndexes(
  matches: readonly number[],
  hasAnchor?: (oldIndex: number) => boolean,
): number[] {
  let predecessors: number[] = []
  let tails: number[] = []
  for (let i = 0; i < matches.length; i++) {
    let value = matches[i]
    if (value < 0 || (hasAnchor && !hasAnchor(value))) continue
    let high = tails.length
    let low = high > 1 && matches[tails[high - 1]] < value ? high : 0
    while (low < high) {
      let mid = (low + high) >> 1
      if (matches[tails[mid]] < value) low = mid + 1
      else high = mid
    }
    if (low) predecessors[i] = tails[low - 1]
    tails[low] = i
  }
  let cursor = tails[tails.length - 1]
  for (let i = tails.length - 1; i >= 0; i--) {
    tails[i] = cursor
    cursor = predecessors[cursor]
  }
  return tails
}

function placeVNode(node: CommittedVNode, domParent: ParentNode, anchor: Node | null): void {
  let first = findEdgeDomNode(node, false)
  let last = first && first.parentNode === domParent ? findEdgeDomNode(node, true) : null
  if (!first || !last || last.nextSibling === anchor) return
  if (anchor) {
    for (let cur: Node | null = first; cur; cur = cur.nextSibling) {
      if (cur === anchor) return
      if (cur === last) break
    }
  }
  if (first === last) {
    placeNodeBefore(domParent, first, anchor)
    return
  }
  let ends = portalRanges?.has(domParent) ? portalRanges.ends : undefined
  for (let cur: Node | null = first; cur; ) {
    let portalEnd: Comment | undefined = ends?.get(cur)
    if (portalEnd) {
      if (cur === last || portalEnd === last) break
      cur = portalEnd.nextSibling
      continue
    }
    let next: Node | null = cur === last ? null : cur.nextSibling
    if (cur.parentNode === domParent) placeNodeBefore(domParent, cur, anchor)
    if (cur === last) break
    cur = next
  }
}

function getDeepActiveElement(root: Node): Element | null {
  let active = 'activeElement' in root ? (root as Document | ShadowRoot).activeElement : null
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

export function placeNodeBefore(parent: ParentNode, node: Node, before: Node | null): void {
  if (node.parentNode !== parent) {
    parent.insertBefore(node, before)
    return
  }

  let useMoveBefore =
    node.nodeType === Node.ELEMENT_NODE &&
    parent.nodeType !== Node.DOCUMENT_NODE &&
    typeof parent.moveBefore === 'function'

  // Only snapshot focus, selection, and scroll when the moved node contains the active element.
  // Even when moveBefore() is used, some engines (e.g. Firefox on <textarea>) can still drop focus,
  // so verify activeElement after the move and restore only if focus was actually lost.
  let root = parent.getRootNode()
  let focused = getDeepActiveElement(root)
  let body = parent.ownerDocument?.body
  if (!focused || focused === body || !node.contains(focused)) {
    if (useMoveBefore) parent.moveBefore(node, before)
    else parent.insertBefore(node, before)
    return
  }

  // Duck-type selection and focus so iframe documents and focusable SVG elements work cross-realm.
  let control =
    'selectionStart' in focused && 'selectionEnd' in focused
      ? (focused as HTMLInputElement | HTMLTextAreaElement)
      : null
  let start: number | null | undefined
  let end: number | null | undefined
  let direction: 'forward' | 'backward' | 'none' | null | undefined
  if (control) {
    try {
      start = control.selectionStart
      end = control.selectionEnd
      direction = control.selectionDirection
    } catch {}
  }

  let positions: [Element, number, number][] = []
  for (let p: Element | null = focused; p; p = p.parentElement) {
    positions.push([p, p.scrollLeft, p.scrollTop])
  }

  if (useMoveBefore) parent.moveBefore(node, before)
  else parent.insertBefore(node, before)

  if (getDeepActiveElement(root) !== focused && focused.isConnected) {
    if (control && start != null && end != null) {
      try {
        if (typeof control.setSelectionRange === 'function') {
          control.setSelectionRange(start, end, direction ?? undefined)
        } else {
          control.selectionStart = start
          control.selectionEnd = end
        }
      } catch {
        // The input type can change during this render.
      }
    }
    if ('focus' in focused && typeof (focused as HTMLElement).focus === 'function') {
      ;(focused as HTMLElement).focus()
    }
    for (let [ancestor, left, top] of positions) {
      ancestor.scrollLeft = left
      ancestor.scrollTop = top
    }
  }
}

function findEdgeDomNode(node: CommittedVNode | null | undefined, last: boolean): Node | null {
  if (!node) return null
  if (node.kind === 'text' || node.kind === 'host') return node._dom
  if (node.kind === 'component' && '_content' in node) return findEdgeDomNode(node._content, last)
  if (node.kind === 'client-entry' || node.kind === 'frame') {
    return last ? node._rangeEnd : node._rangeStart
  }
  if (node.kind === 'fragment') {
    let children = node._children
    for (let i = 0; i < children.length; i++) {
      let dom = findEdgeDomNode(children[last ? children.length - 1 - i : i], last)
      if (dom) return dom
    }
  }
  return null
}

function findNextSiblingDomAnchor(
  curr: CommittedVNode | MountingComponentNode,
  fragmentEnd?: Node | null,
): Node | null {
  let vParent = curr._parent
  if (vParent.kind === 'component') return findNextSiblingDomAnchor(vParent, fragmentEnd)
  let children = vParent._children
  let idx = children.indexOf(curr as CommittedVNode)
  if (idx === -1 && children.length > 0) return fragmentEnd ?? null
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findEdgeDomNode(children[i], false)
    if (dom?.parentNode) return dom
  }
  if (vParent.kind === 'fragment') {
    return fragmentEnd === undefined ? findNextSiblingDomAnchor(vParent) : fragmentEnd
  }
  if (vParent.kind === 'root' || vParent.kind === 'portal') {
    return vParent._rangeEnd ?? fragmentEnd ?? null
  }
  return fragmentEnd ?? null
}

// -- Host props & styles --

const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const RESERVED_PROPS = new Set([
  'children',
  'mix',
  'key',
  'animate',
  'innerHTML',
  'class',
  'className',
])
const ATTR_FALLBACK = new Set([
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
  'translate',
])
const BOOLEANISH_ATTR = new Set([
  'accent',
  'accentunder',
  'autoReverse',
  'contenteditable',
  'displaystyle',
  'draggable',
  'externalResourcesRequired',
  'fence',
  'focusable',
  'largeop',
  'movablelimits',
  'preserveAlpha',
  'separator',
  'spellcheck',
  'stretchy',
  'symmetric',
])
const UNSAFE_PROP = /^on|[\0\t\n\f\r "'/>=]/i
export const EXEC_URL_ATTR = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
const BLOCKED_JS_URL =
  "javascript:throw new Error('Remix has blocked a javascript: URL as a security precaution.')"
const VENDOR_STYLE_PREFIX = /^(?:-?(?:webkit|moz|ms|o)-|(?:[Ww]ebkit|[Mm]oz|[Mm]s|[Oo])(?=[A-Z]))/
// Properties whose grammar accepts a standalone number, including shorthands and number/length unions.
const NUMERIC_CSS_PROP =
  /^(?:animation(?:iterationcount)?|aspectratio|bookmarklevel|(?:borderimage|mask(?:border|boximage))(?:outset|slice|width)?|box(?:flex(?:group)?|ordinalgroup)|column(?:s|count|span)|flex(?:grow|linecount|negative|order|positive|shrink)?|floatdefer|font(?:sizeadjust|weight)|forcebrokenimageicon|grid(?:area|(?:column|row)(?:end|span|start)?)|hyphenatelimit(?:chars|lines)|initialletter|line(?:clamp|height)|mathdepth|maxlines|(?:fill|flood|stop|stroke)?opacity|order|orphans|readingorder|scale|shapeimagethreshold|tabsize|voicebalance|widows|zindex|zoom|stroke(?:dash(?:array|offset)|miterlimit|width))$/i

function skipHostProp(name: string, select: HTMLSelectElement | null): boolean {
  if (
    name === 'children' ||
    name === 'class' ||
    name === 'className' ||
    name === 'key' ||
    name === 'mix'
  ) {
    return true
  }
  return (
    RESERVED_PROPS.has(name) ||
    !isAllowedHostPropName(name) ||
    (select !== null && name === 'defaultValue')
  )
}

/**
 * Patches DOM attributes and selected properties from old props to new props.
 *
 * @param curr Previous host props.
 * @param next Next host props.
 * @param dom Element to patch.
 * @param isSvg Whether the element is in the SVG namespace.
 * @param hydrating Whether the element is adopting existing server-rendered DOM.
 */
export function patchHostProps(
  curr: ElementProps,
  next: ElementProps,
  dom: Element,
  isSvg = dom.namespaceURI === SVG_NS,
  hydrating = false,
): void {
  let select = !isSvg && dom.localName === 'select' && dom instanceof HTMLSelectElement ? dom : null
  let wasMultiple = select?.multiple
  let currClass = curr === EMPTY_PROPS ? undefined : getMergedClassName(curr)
  let nextClass = getMergedClassName(next)

  if (currClass !== nextClass) {
    if (nextClass) {
      if (!hydrating || dom.getAttribute('class') !== nextClass) {
        dom.setAttribute('class', nextClass)
      }
    } else if (!hydrating) {
      dom.removeAttribute('class')
    }
  }

  if (curr !== EMPTY_PROPS) {
    for (let name in curr) {
      if (skipHostProp(name, select)) continue
      let value = next[name]
      if (value == null) patchHostProp(dom, name, value, curr[name], isSvg, select, false)
    }
  }
  for (let name in next) {
    if (skipHostProp(name, select)) continue
    let value = next[name]
    if (value == null) continue
    let prev = curr === EMPTY_PROPS ? undefined : curr[name]
    if (value !== prev) patchHostProp(dom, name, value, prev, isSvg, select, hydrating)
  }

  if (select && wasMultiple !== select.multiple && next.value == null) {
    setSelectDefaultValue(select, next.defaultValue)
  }
}

function canUseProperty(
  dom: Element,
  name: string,
  isSvg: boolean,
  attr: string,
): dom is Element & Record<string, unknown> {
  return !isSvg && name in dom && !ATTR_FALLBACK.has(name) && !BOOLEANISH_ATTR.has(attr)
}

// The HTML parser places `xml:*` and `xlink:*` attributes in their namespaces. Match it for
// elements created in the browser.
function getSvgAttributeNamespace(attr: string, isSvg: boolean): string | null {
  if (!isSvg) return null
  if (attr.startsWith('xml:')) return XML_NS
  return attr.startsWith('xlink:') ? XLINK_NS : null
}

function removeHostAttribute(dom: Element, attr: string, isSvg: boolean): void {
  let ns = getSvgAttributeNamespace(attr, isSvg)
  if (ns) dom.removeAttributeNS(ns, attr.slice(attr.indexOf(':') + 1))
  else dom.removeAttribute(attr)
}

function isHydrationPropertyProp(localName: string, name: string): boolean {
  if (localName.includes('-') || name === 'textContent' || name === 'innerText') return true
  if (
    localName === 'input' ||
    localName === 'textarea' ||
    localName === 'select' ||
    localName === 'option'
  ) {
    return (
      name === 'value' ||
      name === 'checked' ||
      name === 'indeterminate' ||
      name === 'defaultValue' ||
      name === 'defaultChecked' ||
      name === 'selected' ||
      name === 'selectedIndex' ||
      name === 'multiple'
    )
  }
  return false
}

function patchHostProp(
  dom: Element,
  name: string,
  value: unknown,
  prev: unknown,
  isSvg: boolean,
  select: HTMLSelectElement | null,
  hydrating: boolean,
): void {
  let attr = name === 'style' ? 'style' : normalizeAttributeName(name, isSvg)

  if (value == null) {
    if (
      (name === 'value' || name === 'checked') &&
      prev === undefined &&
      (value === undefined || (name === 'value' && select !== null))
    ) {
      return
    }
    if (canUseProperty(dom, name, isSvg, attr)) {
      try {
        if (name === 'value' || name === 'defaultValue') dom[name] = ''
        else if (name === 'checked' || name === 'defaultChecked' || name === 'selected') {
          dom[name] = false
        } else if (name === 'selectedIndex') {
          dom[name] = -1
        }
      } catch {}
    }
    removeHostAttribute(dom, attr, isSvg)
    return
  }

  if (attr === 'style') {
    if (typeof value === 'string') {
      if (!hydrating || dom.getAttribute('style') !== value) {
        dom.setAttribute('style', value)
      }
      return
    }
    if (isStyleObject(value)) {
      if (hydrating && dom.getAttribute('style') === serializeStyleObject(value)) {
        return
      }
      let prevStyle = name === 'style' && isStyleObject(prev) ? prev : undefined
      if (!prevStyle && name === 'style') dom.removeAttribute('style')
      patchStyleObject(dom, prevStyle, value)
      return
    }
  }

  let localName = dom.localName
  value = sanitizeUrlAttribute(localName, attr, value)

  if (select && name === 'value') {
    setSelectValue(select, value)
    return
  }

  if (hydrating && typeof value !== 'function' && !isHydrationPropertyProp(localName, name)) {
    let stringify = typeof value !== 'boolean' || shouldStringifyBooleanAttribute(attr)
    let ns = getSvgAttributeNamespace(attr, isSvg)
    let localAttr = ns ? attr.slice(attr.indexOf(':') + 1) : attr
    if (stringify) {
      let current = ns ? dom.getAttributeNS(ns, localAttr) : dom.getAttribute(localAttr)
      if (current === String(value)) return
    } else {
      let present = ns ? dom.hasAttributeNS(ns, localAttr) : dom.hasAttribute(localAttr)
      if (present === value) return
    }
  }

  if (canUseProperty(dom, name, isSvg, attr)) {
    // An empty attribute means present, and the server renders `""` as one. As a boolean property,
    // `""` would mean false. `hidden` can currently hold the string "until-found".
    if (value === '') {
      try {
        if (
          name === 'hidden' ||
          ((!dom.localName.includes('-') || name in HTMLElement.prototype) &&
            typeof dom[name] === 'boolean')
        ) {
          value = true
        }
      } catch {}
    }
    try {
      dom[name] = value
      return
    } catch {}
  }

  if (typeof value === 'function') return

  // Match server rendering: booleans render as "true"/"false" only for attributes that read them as
  // strings; otherwise `true` renders an empty attribute and `false` omits it.
  let stringify = typeof value !== 'boolean' || shouldStringifyBooleanAttribute(attr)
  if (stringify || value) {
    let str = stringify ? String(value) : ''
    let ns = getSvgAttributeNamespace(attr, isSvg)
    if (ns) dom.setAttributeNS(ns, attr, str)
    else dom.setAttribute(attr, str)
  } else {
    removeHostAttribute(dom, attr, isSvg)
  }
}

export function isStyleObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeCssValue(key: string, value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    if (
      value !== 0 &&
      !key.startsWith('--') &&
      !NUMERIC_CSS_PROP.test(key.replace(VENDOR_STYLE_PREFIX, '').replace(/-/g, ''))
    ) {
      return `${value}px`
    }
  }
  return String(value)
}

function toInlineStyleValue(name: string, value: unknown): string | undefined {
  if (typeof value === 'boolean') return undefined
  if (Array.isArray(value)) return value.join(', ')
  return normalizeCssValue(name, value)
}

function setInlineStyle(style: CSSStyleDeclaration, name: string, value: string): void {
  if (name.includes('-')) {
    if (value) style.setProperty(name, value)
    else style.removeProperty(name)
  } else {
    let record = style as unknown as Record<string, unknown>
    if (
      name === 'cssText' ||
      name === 'length' ||
      name === 'parentRule' ||
      typeof record[name] === 'function'
    ) {
      return
    }
    try {
      record[name] = value
    } catch {}
  }
}

const camelToKebabCache = new Map<string, string>()

export function camelToKebab(str: string): string {
  if (str.startsWith('--')) return str
  let cached = camelToKebabCache.get(str)
  if (cached === undefined) {
    cached = str
      .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      .replace(/^(webkit|moz|ms|o)-/, '-$1-')
    if (camelToKebabCache.size >= 256) {
      let oldest = camelToKebabCache.keys().next()
      if (!oldest.done) camelToKebabCache.delete(oldest.value)
    }
    camelToKebabCache.set(str, cached)
  }
  return cached
}

export function serializeStyleObject(style: Record<string, unknown>): string {
  let out = ''
  for (let key in style) {
    if (!Object.hasOwn(style, key)) continue
    let value = style[key]
    if (value == null || typeof value === 'boolean') continue
    let cssValue =
      typeof value === 'string'
        ? value
        : Array.isArray(value)
          ? value.join(', ')
          : normalizeCssValue(key, value)
    if (cssValue !== undefined) {
      out += (out ? ' ' : '') + camelToKebab(key) + ': ' + cssValue + ';'
    }
  }
  return out
}

function patchStyleObject(
  dom: Element,
  curr: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): void {
  let style = 'style' in dom ? (dom as HTMLElement).style : undefined
  if (!(style instanceof CSSStyleDeclaration)) {
    dom.setAttribute('style', serializeStyleObject(next))
    return
  }

  for (let name in curr) {
    if (
      next[name] !== curr[name] &&
      toInlineStyleValue(name, next[name]) === undefined &&
      toInlineStyleValue(name, curr[name]) !== undefined
    ) {
      setInlineStyle(style, name, '')
    }
  }

  for (let name in next) {
    if (curr && next[name] === curr[name]) continue
    let value = toInlineStyleValue(name, next[name])
    if (value !== undefined && value !== toInlineStyleValue(name, curr?.[name])) {
      setInlineStyle(style, name, value)
    }
  }
}

export function getSelectValues(value: unknown): Set<string> | undefined {
  return value == null
    ? undefined
    : new Set(Array.isArray(value) ? value.map(String) : [String(value)])
}

export function setSelectDefaultValue(
  select: HTMLSelectElement,
  value: unknown,
  scalar = !select.multiple,
): void {
  let values = getSelectValues(value)
  let matched = false
  let firstEnabled: HTMLOptionElement | undefined
  for (let option of select.options) {
    if (!firstEnabled && !option.disabled) firstEnabled = option
    let selected = (values?.has(option.value) ?? false) && !(scalar && matched)
    if (selected) matched = true
    option.defaultSelected = selected
    option.selected = selected
  }
  if (!select.multiple && !matched && firstEnabled) firstEnabled.selected = true
}

export function setSelectValue(select: HTMLSelectElement, value: unknown): void {
  if (!select.multiple || !Array.isArray(value)) {
    select.value = value == null ? '' : String(value)
    return
  }
  let values = getSelectValues(value)
  for (let option of select.options) option.selected = values?.has(option.value) ?? false
}

export function isAllowedHostPropName(name: string): boolean {
  return !!name && name !== '__proto__' && name !== 'outerHTML' && !UNSAFE_PROP.test(name)
}

export function sanitizeUrlAttribute(tagName: string, attrName: string, value: unknown): unknown {
  let lower = attrName.toLowerCase()
  if (!EXEC_URL_ATTR.has(lower) && !(lower === 'data' && tagName.toLowerCase() === 'object')) {
    return value
  }
  let str = String(value)
  if (str.length > 0) {
    let c = str.charCodeAt(0)
    // Leading non-whitespace ASCII other than 'j'/'J' cannot start with "javascript:".
    if (c > 32 && c !== 106 && c !== 74) return value
  }
  // Browsers ignore leading C0 controls and spaces, plus tabs and newlines within URL schemes.
  return /^javascript:/i.test(str.replace(/^[\0- ]+|[\r\n\t]/g, '')) ? BLOCKED_JS_URL : value
}

const HTML_RENAMES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  acceptCharset: 'accept-charset',
  httpEquiv: 'http-equiv',
}

// React-style camelCase SVG props (e.g. strokeWidth, fillOpacity, stopColor) that correspond to
// kebab-case SVG attributes. Canonical camelCase SVG attributes (viewBox, clipPathUnits,
// stdDeviation, etc.) and standard kebab-case attributes do not match and pass through verbatim.
const SVG_KEBAB_PROP =
  /^(?:(?:stroke|fill|font|color|horiz|vert|overline|strikethrough|underline|unicode|v)[A-Z]|glyph[NO]|(?:marker(?:Start|Mid|End)|clip(?:Path|Rule)|whiteSpace)$)|(?:Baseline|Color|Opacity|Rendering|Spacing|Origin|Shift|Form|Rule|Background|Order|Events|Intent|Anchor|Decoration|Em|Effect|writingMode|capHeight|xHeight)$/

// camelCase props for prefixed `xml:`, `xmlns:`, and `xlink:` SVG attributes, such as xlinkTitle.
const PREFIXED_SVG_PROP =
  /^(?:xml(?:Lang|Space|Base|nsXlink)|xlink(?:Actuate|Arcrole|Role|Show|Title|Type))$/

export function normalizeAttributeName(name: string, isSvg: boolean): string {
  if (isSvg) {
    if (name === 'className') return 'class'
    if (/^xlink(?:Href|:href)$/i.test(name)) return 'href'
    if (PREFIXED_SVG_PROP.test(name)) {
      return name.replace(/([A-Z])/, (_, c: string) => `:${c.toLowerCase()}`)
    }
    return SVG_KEBAB_PROP.test(name)
      ? name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
      : name
  }
  if (name.startsWith('data-') || name.startsWith('aria-')) return name
  return Object.hasOwn(HTML_RENAMES, name) ? HTML_RENAMES[name] : name.toLowerCase()
}

export function shouldStringifyBooleanAttribute(name: string): boolean {
  return (
    name.startsWith('aria-') ||
    (name.startsWith('data-') &&
      name !== 'data-rmx-document' &&
      name !== 'data-rmx-preserve-dom') ||
    BOOLEANISH_ATTR.has(name) ||
    name === 'value'
  )
}

function getMergedClassName(props: ElementProps): string | undefined {
  let classAttr = typeof props.class === 'string' ? props.class : ''
  let className = typeof props.className === 'string' ? props.className : ''
  return classAttr && className ? `${classAttr} ${className}` : classAttr || className || undefined
}
