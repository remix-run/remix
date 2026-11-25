import type { Component, Context, FrameHandle } from '../component.ts'
import {
  activeSchedulerUpdateParents,
  invariant,
  isMixinDescriptor,
  isRemixElement,
  jsx,
  MIXIN_RUNTIME,
  setDefaultMixinDriver,
  type ElementProps,
  type RemixElement,
  type TypedEventTarget,
} from '../vnode.ts'
import type { Key } from '../vnode.ts'
import {
  findContextFromAncestry,
  patchHostProps,
  portalRanges,
  restoreAncestorSelect,
  syncHostControls,
  type CommittedHostNode,
  type HostNode,
  type ReconcileContext,
  type RuntimeHostProps,
  type Scheduler,
  type SchedulerPhaseEvent,
  type VNodeParent,
} from '../vdom.ts'

type RebindNode<value, baseNode, boundNode> = value extends (
  ...args: infer fnArgs
) => infer fnResult
  ? (...args: RebindTuple<fnArgs, baseNode, boundNode>) => RebindNode<fnResult, baseNode, boundNode>
  : [value] extends [baseNode]
    ? [baseNode] extends [value]
      ? boundNode
      : value
    : value

type RebindTuple<args extends unknown[], baseNode, boundNode> = {
  [index in keyof args]: RebindNode<args[index], baseNode, boundNode>
}

/**
 * Host props available to a mixin, excluding subtree content owned by the host.
 */
export type MixinProps<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = Omit<props, 'children' | 'innerHTML' | 'srcDoc' | 'srcdoc' | 'outerHTML' | 'mix'> & {
  mix?: MixValue<node, props>
}

/**
 * JSX element used by a mixin to forward or patch its existing host props.
 */
export type MixinElement<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = ((
  handle: { update(): Promise<AbortSignal> },
  setup: unknown,
) => (props: MixinProps<node, props>) => RemixElement) & {
  __rmxMixinElementType: string
}

/**
 * Event dispatched after a mixin is bound to its host node in the commit phase.
 */
export type MixinInsertEvent<node extends EventTarget = Element> = Event & {
  /** The bound host node. */
  node: node
  /** The host node's DOM parent. */
  parent: ParentNode
  /** The host's reconciliation key, when provided. */
  key?: Key
}

/**
 * Event dispatched when a persisted keyed host is reused before its removal finishes.
 */
export type MixinReclaimedEvent<node extends EventTarget = Element> = Event & {
  /** The bound host node. */
  node: node
  /** The host node's DOM parent. */
  parent: ParentNode
  /** The host's reconciliation key, when provided. */
  key?: Key
}

/**
 * Event dispatched before DOM updates or after they commit for the host's update scope.
 */
export type MixinUpdateEvent<node extends EventTarget = Element> = Event & {
  /** The host node being measured or updated. */
  node: node
}

/**
 * Event dispatched before host removal, while mixins can still defer that removal.
 */
export type MixinBeforeRemoveEvent = Event & {
  /**
   * Keeps the host in the DOM until all registered teardown callbacks settle.
   *
   * Call synchronously from the `beforeRemove` listener. Callbacks run asynchronously;
   * returning `void`, throwing, or rejecting completes that callback's hold on the node.
   * Callback errors do not prevent removal. The signal aborts when the pending removal
   * is canceled, including keyed-node reclamation, or the host is torn down. Check it
   * before starting work and use it to stop unfinished work. A reclaimed node emits
   * `reclaimed` instead of `remove` and is not removed when the old callbacks settle.
   *
   * @param teardown Work to finish before removing the host, with a cancellation signal.
   */
  persistNode(teardown: (signal: AbortSignal) => void | Promise<void>): void
}

type MixinContext = Pick<Context<Record<string, never>>, 'get'>

type MixinHandleEventMap<node extends EventTarget = Element> = {
  /** Host removal has begun. Register deferred teardown with `event.persistNode()`. */
  beforeRemove: MixinBeforeRemoveEvent
  /** A persisted keyed host was reused without another `insert` event. */
  reclaimed: MixinReclaimedEvent<node>
  /** The mixin is being disposed, including when its slot changes on a retained host. */
  remove: Event
  /** The mixin has been bound to a host, including an already-mounted host. */
  insert: MixinInsertEvent<node>
  /** The host's update scope is about to change the DOM. */
  beforeUpdate: MixinUpdateEvent<node>
  /** DOM changes in the host's update scope have committed. */
  commit: MixinUpdateEvent<node>
}

/**
 * Runtime handle passed to mixin setup functions.
 *
 * The node type is covariant so a handle for a subtype host can be used by a mixin authored for
 * its base type. Mixin render callbacks receive host props with children and raw HTML props
 * removed.
 * Returned mixin elements may patch host attributes and nested `mix`, but cannot replace
 * the host subtree.
 */
export interface MixinHandle<
  out node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> extends TypedEventTarget<MixinHandleEventMap<node>> {
  /** Identifier shared by the mixins bound to this host. */
  id: string
  /** Reads context provided by an ancestor component. */
  context: MixinContext
  /** The frame containing this host. */
  frame: FrameHandle
  /** JSX element for forwarding host props, patching attributes, and composing nested mixins. */
  element: MixinElement<node, props>
  /**
   * Signal aborted when this mixin slot is disposed, even if its host remains mounted.
   * Read it during setup or render and capture it for use in asynchronous callbacks.
   */
  signal: AbortSignal
  /**
   * Schedules an update of the host's mixins without rerendering its owner component.
   *
   * @returns A promise that resolves after the update with the host runtime's lifetime signal.
   */
  update(): Promise<AbortSignal>
  /**
   * Queues work after pending DOM updates and commit-phase callbacks.
   *
   * @param task Callback receiving the bound host and its runtime lifetime signal.
   */
  queueTask(task: (node: node, signal: AbortSignal) => void): void
}

export function renderMixinElement<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
>(element: MixinElement<node, props>, props?: MixinProps<node, props>): RemixElement {
  let { key, ...rest } = (props ?? {}) as MixinProps<node, props> & { key?: Key }
  return jsx(element, rest, key)
}

type MixinRuntimeType<
  args extends unknown[] = [],
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => ((...args: [...args, currentProps: props]) => MixinReturn<node, props>) | void

type MixinDescriptorType<
  args extends unknown[] = [],
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = <boundNode extends node>(
  handle: MixinHandle<boundNode, props>,
  type: string,
) => ((...args: [...args, currentProps: props]) => MixinReturn<boundNode, props>) | void

/**
 * Setup function called once per mixin slot with its handle and host tag name.
 *
 * The returned render function receives the factory arguments followed by current host props.
 * Return `handle.element` to preserve props, JSX using `handle.element` to patch them, or mixin
 * descriptors to compose more behavior. Returning nothing from setup preserves the host props.
 */
export type MixinType<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => ((...args: [...args, currentProps: props]) => MixinReturn<node, props>) | void

/**
 * Descriptor pairing a mixin setup function with the arguments captured by its factory.
 */
export type MixinDescriptor<
  in node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = {
  /** Setup function identifying this mixin. */
  type: MixinDescriptorType<args, node, props>
  /** Arguments supplied to the mixin factory for this render. */
  args: args
  /** Type-only marker constraining which hosts can accept this descriptor. */
  readonly __node?: (node: node) => void
}

/**
 * Callable factory that captures arguments for a mixin used in a host's `mix` prop.
 */
export type MixinFactory<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = <boundNode extends node = node>(
  ...args: RebindTuple<args, node, boundNode>
) => MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props>

type PreviousMixDepth = [0, 0, 1, 2, 3, 4]
type FalsyMixValue = false | 0 | 0n | '' | null | undefined
type NullableMixValue<descriptor> = descriptor | FalsyMixValue
type NestedMixValue<descriptor, depth extends number = 4> = depth extends 0
  ? NullableMixValue<descriptor> | ReadonlyArray<NullableMixValue<descriptor>>
  :
      | NullableMixValue<descriptor>
      | ReadonlyArray<NestedMixValue<descriptor, PreviousMixDepth[depth]>>

type MixinInputDescriptor<
  in node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = {
  type: (handle: MixinHandle<node, props>, type: string) => unknown
  args: readonly unknown[]
  readonly __node?: (node: node) => void
}

/**
 * Accepted authoring shape for the `mix` prop on host elements.
 * Nested arrays are flattened and falsy entries are ignored, allowing conditional mixins.
 */
export type MixInput<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = NestedMixValue<MixinInputDescriptor<node, props>>

/**
 * Descriptor or flat descriptor array after nested and conditional mixin inputs are normalized.
 */
export type MixValue<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = MixinInputDescriptor<node, props> | ReadonlyArray<MixinInputDescriptor<node, props>>

type MixinReturn<node extends EventTarget = Element, props extends ElementProps = ElementProps> =
  | void
  | null
  | RemixElement
  | MixinElement<node, props>
  | MixInput<node, props>

type AnyMixinType = MixinRuntimeType<unknown[], Element, ElementProps>
type AnyMixinDescriptor = MixinDescriptor<Element, unknown[], ElementProps>
export type MixinRuntimeValue = AnyMixinDescriptor | ReadonlyArray<AnyMixinDescriptor>
type AnyMixinRunner = (
  ...args: [...unknown[], currentProps: ElementProps]
) => MixinReturn<Element, ElementProps>
type AnyMixinRunnerResult = ReturnType<AnyMixinRunner>
type AnyMixinSetupResult = ReturnType<AnyMixinType> | AnyMixinRunnerResult
type AnyMixinHandle = MixinHandle<Element, ElementProps>
type MixinSlot = {
  type: AnyMixinType
  runner: AnyMixinRunner
  target?: EventTarget
  controller?: AbortController
}

type PersistedMixinRemoval = {
  controller: AbortController
  done: Promise<void>
}

let mixinHandleId = 0

/**
 * Options for creating a mixin factory.
 */
export interface MixinOptions {
  /**
   * Whether setup and render run during server rendering (true by default).
   * Set to `false` for behavior that does not contribute to the server HTML.
   */
  ssr?: boolean
}

export interface MixinRuntime {
  readonly driver: MixinDriver
  readonly hasSlots: boolean
  readonly removed: boolean
  resolve(hostType: string, props: ElementProps): ElementProps
  bind(
    node: CommittedHostNode,
    context: ReconcileContext,
    reclaimed?: boolean,
    parent?: ParentNode,
  ): void
  cancelRemoval(): void
  teardown(): void
  deferRemoval(
    node: CommittedHostNode,
    domParent: ParentNode,
    context: ReconcileContext,
    performRemoval: (
      node: CommittedHostNode,
      domParent: ParentNode | null,
      context: ReconcileContext,
    ) => void,
  ): boolean
  dispatchUpdate(type: SchedulerPhaseType): void
}

export interface MixinDriver {
  persistedNodes: Set<CommittedHostNode>
  reclaim(
    type: string,
    key: Key | undefined,
    domParent: ParentNode,
    vParent: VNodeParent,
  ): CommittedHostNode | null
  resolve(
    node: HostNode | CommittedHostNode,
    parent: VNodeParent,
    frame: FrameHandle,
    scheduler: Scheduler,
    prevState?: MixinRuntime,
  ): RuntimeHostProps
  shouldDispatchInline(node: Node): boolean
}

let persistedRemovalToken = 0
const persistedMixinNodes = new Set<CommittedHostNode>()

const mixinDriver: MixinDriver = {
  persistedNodes: persistedMixinNodes,
  reclaim(type, key, domParent, vParent) {
    if (key == null) return null
    for (let p of persistedMixinNodes) {
      if (
        p._persisted?.parent === domParent &&
        p.type === type &&
        p.key === key &&
        portalRanges?.ownerOf(p._parent) === portalRanges?.ownerOf(vParent)
      ) {
        p._mix?.cancelRemoval()
        p._persisted = undefined
        persistedMixinNodes.delete(p)
        return p
      }
    }
    return null
  },
  resolve(node, parent, frame, scheduler, state) {
    state ??= createMixinRuntime(node.type, frame, scheduler, (type: Component | string | symbol) =>
      typeof type === 'function' ? findContextFromAncestry(parent, type) : undefined,
    )
    node._mix = state
    return state.resolve(node.type, node.props)
  },
  shouldDispatchInline(node) {
    return (
      !activeSchedulerUpdateParents?.length ||
      !activeSchedulerUpdateParents.some((p) => p instanceof Node && p.contains(node))
    )
  },
}

/**
 * Creates a typed mixin factory that can be passed through the `mix` prop.
 *
 * @param type Mixin setup function.
 * @param options Server rendering options.
 * @returns A function that captures mixin arguments and returns a descriptor.
 */
export function createMixin<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
>(type: MixinType<node, args, props>, options: MixinOptions = {}): MixinFactory<node, args, props> {
  setDefaultMixinDriver(mixinDriver)
  let mixinType =
    options.ssr === false || '__rmxMixinSsr' in type || !Object.isExtensible(type)
      ? Object.assign(
          function mixinSetup(handle: MixinHandle<node, props>, hostType: string) {
            return type(handle, hostType)
          },
          { __rmxMixinSsr: options.ssr !== false },
        )
      : type
  if (!(MIXIN_RUNTIME in mixinType)) {
    Object.defineProperty(mixinType, MIXIN_RUNTIME, { value: mixinDriver })
  }

  return <boundNode extends node = node>(
    ...args: RebindTuple<args, node, boundNode>
  ): MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props> => ({
    type: mixinType as unknown as MixinDescriptorType<
      RebindTuple<args, node, boundNode>,
      boundNode,
      props
    >,
    args: args as RebindTuple<args, node, boundNode>,
  })
}

type SchedulerPhaseType = 'beforeUpdate' | 'commit'

function createMixinRuntime(
  hostType: string,
  frame: FrameHandle,
  scheduler: Scheduler,
  getContext: MixinContext['get'],
): MixinRuntime {
  let runners: MixinSlot[] = []
  let slots = new Set<MixinSlot>()
  let active: MixinSlot | undefined
  let boundNode: Element | undefined
  let boundParent: ParentNode | undefined
  let boundTarget: CommittedHostNode | undefined
  let controller: AbortController | undefined
  let removal: 'active' | 'removing' | 'removed' | PersistedMixinRemoval = 'active'
  let phases: Set<SchedulerPhaseType> | undefined

  let element = ((_: { update(): Promise<AbortSignal> }, __: unknown) => (props: ElementProps) =>
    jsx(hostType, props, null)) as unknown as MixinElement<Element, ElementProps>
  element.__rmxMixinElementType = hostType

  function dispatch(slot: MixinSlot, type: keyof MixinHandleEventMap<Element>, props?: object) {
    if (!slots.has(slot)) return
    let prev = active
    active = slot
    slot.target?.dispatchEvent(Object.assign(new Event(type), props))
    active = prev
  }

  function onPhase(event: Event) {
    if (boundNode && (event as SchedulerPhaseEvent).parents.some((p) => p.contains(boundNode!))) {
      for (let slot of slots) dispatch(slot, event.type as SchedulerPhaseType, { node: boundNode })
    }
  }

  function release(slot: MixinSlot) {
    slot.controller?.abort()
    slots.delete(slot)
    if (slot === active) active = undefined
    if (!slots.size && phases) {
      for (let type of phases) {
        let phase = getPhaseListeners(scheduler)[type]
        phase.delete(onPhase)
        if (!phase.size) scheduler.removeEventListener(type, phase)
      }
      phases = undefined
    }
  }

  function removeSlot(slot: MixinSlot) {
    dispatch(slot, 'remove')
    release(slot)
  }

  function queueBind(slot: MixinSlot, type: 'insert' | 'reclaimed') {
    let node = boundNode!
    let parent = boundParent!
    let key = boundTarget?.key
    scheduler.enqueueCommitPhase([() => dispatch(slot, type, { node, parent, key })])
  }

  function getLifetime() {
    controller ??= new AbortController()
    if (removal === 'removed') controller.abort()
    return controller.signal
  }

  function prepareRemoval(): Promise<void> | undefined {
    if (typeof removal === 'object') return removal.done
    if (removal !== 'active') return
    removal = 'removing'
    let teardowns: Array<(signal: AbortSignal) => void | Promise<void>> = []
    let persistNode = (fn: (signal: AbortSignal) => void | Promise<void>) => teardowns.push(fn)
    for (let slot of runners) dispatch(slot, 'beforeRemove', { persistNode })
    if (!teardowns.length) return
    let ac = new AbortController()
    let done = Promise.allSettled(
      teardowns.map((fn) => Promise.resolve().then(() => fn(ac.signal))),
    ).then(() => {})
    removal = { controller: ac, done }
    return done
  }

  let handle = {
    id: `m${++mixinHandleId}`,
    context: { get: getContext },
    frame,
    element,
    get signal() {
      invariant(
        active,
        'handle.signal is only available during mixin setup, render, or lifecycle callbacks',
      )
      return (active.controller ??= new AbortController()).signal
    },
    update() {
      if (!boundNode || !boundTarget || removal === 'removed') return Promise.resolve(getLifetime())
      let node = boundNode
      let target = boundTarget
      return new Promise<AbortSignal>((resolve) => {
        scheduler.enqueueWork([
          () => {
            if (removal === 'removed') return resolve(getLifetime())
            runtime.dispatchUpdate('beforeUpdate')
            let prev = target._mp
            let next = mixinDriver.resolve(target, target._parent, frame, scheduler, runtime)
            let nm = (
              frame.$runtime as
                | {
                    nonceManager?: {
                      resolveResourceNonce(
                        type: string,
                        props: RuntimeHostProps,
                        parent: VNodeParent,
                      ): RuntimeHostProps
                    }
                  }
                | undefined
            )?.nonceManager
            next = target._mp = nm
              ? nm.resolveResourceNonce(target.type, next, target._parent)
              : next
            patchHostProps(prev, next, node)
            syncHostControls(target, scheduler)
            if (node.parentNode) restoreAncestorSelect(node.parentNode)
            runtime.dispatchUpdate('commit')
            resolve(getLifetime())
          },
        ])
      })
    },
    queueTask(task: (node: Element, signal: AbortSignal) => void) {
      scheduler.enqueueTasks([
        () => {
          invariant(boundNode)
          task(boundNode, getLifetime())
        },
      ])
    },
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean,
    ) {
      invariant(active)
      ;(active.target ??= new EventTarget()).addEventListener(type, listener, options)
      if (!listener || (type !== 'beforeUpdate' && type !== 'commit') || phases?.has(type)) return
      ;(phases ??= new Set()).add(type)
      let phase = getPhaseListeners(scheduler)[type]
      phase.add(onPhase)
      if (phase.size === 1) scheduler.addEventListener(type, phase)
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean,
    ) {
      invariant(active)
      active.target?.removeEventListener(type, listener, options)
    },
    dispatchEvent(event: Event) {
      invariant(active)
      return active.target?.dispatchEvent(event) ?? false
    },
  } as unknown as AnyMixinHandle

  let runtime: MixinRuntime = {
    driver: mixinDriver,
    get hasSlots() {
      return runners.length !== 0
    },
    get removed() {
      return removal === 'removed'
    },
    resolve(type, props) {
      let count = 0
      let mixed = composeMixedProps(type, props, (descriptor, index, mixinProps) => {
        count = index + 1
        let slot = runners[index]
        if (slot?.type !== descriptor.type) {
          let prev = slot
          if (prev) scheduler.enqueueCommitPhase([() => removeSlot(prev)])
          slot = { type: descriptor.type as AnyMixinType, runner: () => element }
          active = slot
          slots.add(slot)
          let setup = descriptor.type(handle, type) as AnyMixinSetupResult
          slot.runner =
            typeof setup === 'function' && !isMixinElementFunction(setup)
              ? (setup as AnyMixinRunner)
              : setup === undefined
                ? () => element
                : () => setup as AnyMixinRunnerResult
          runners[index] = slot
          if (boundNode) queueBind(slot, 'insert')
        }
        active = slot
        let result = slot.runner(...descriptor.args, mixinProps)
        active = undefined
        return result
      })
      for (let i = count; i < runners.length; i++) removeSlot(runners[i])
      runners.length = count
      return mixed
    },
    bind(target, _context, reclaimed = false, parent) {
      let domParent = parent ?? target._dom.parentNode
      invariant(domParent, 'Expected mounted host node to have a DOM parent')
      let prevNode = boundNode
      boundNode = target._dom
      boundParent = domParent
      boundTarget = target
      if (boundNode !== prevNode) {
        for (let slot of runners) queueBind(slot, reclaimed ? 'reclaimed' : 'insert')
      }
    },
    cancelRemoval() {
      if (typeof removal !== 'object') return
      removal.controller.abort(new DOMException('', 'AbortError'))
      removal = 'active'
    },
    teardown() {
      boundNode = boundParent = boundTarget = undefined
      prepareRemoval()
      if (typeof removal === 'object') {
        removal.controller.abort(new DOMException('', 'AbortError'))
        removal = 'removing'
      }
      scheduler.enqueueCommitPhase([
        () => {
          for (let slot of runners) dispatch(slot, 'remove')
          for (let slot of runners) release(slot)
          runners.length = 0
          removal = 'removed'
          controller?.abort()
        },
      ])
    },
    deferRemoval(node, domParent, context, performRemoval) {
      if (node._persisted) return true
      let persisted = prepareRemoval()
      if (!persisted) return false
      let token = ++persistedRemovalToken
      node._persisted = { parent: domParent, token }
      persistedMixinNodes.add(node)
      boundNode = boundParent = boundTarget = undefined
      void persisted
        .catch(() => {})
        .finally(() => {
          if (node._persisted?.token !== token) return
          node._persisted = undefined
          persistedMixinNodes.delete(node)
          performRemoval(node, domParent, context)
          portalRanges?.finishRemovals(domParent)
        })
      return true
    },
    dispatchUpdate(type) {
      if (boundNode && phases?.has(type)) {
        for (let slot of runners) dispatch(slot, type, { node: boundNode })
      }
    },
  }

  return runtime
}

// EventTarget scans its listeners on add/remove. Share one listener per scheduler phase.
class PhaseListeners extends Set<EventListener> {
  handleEvent(event: Event) {
    for (let listener of Array.from(this)) {
      if (!this.has(listener)) continue
      try {
        listener(event)
      } catch (error) {
        reportError(error)
      }
    }
  }
}

const schedulerPhases = new WeakMap<Scheduler, Record<SchedulerPhaseType, PhaseListeners>>()

function getPhaseListeners(scheduler: Scheduler) {
  let phases = schedulerPhases.get(scheduler)
  if (!phases) {
    phases = { beforeUpdate: new PhaseListeners(), commit: new PhaseListeners() }
    schedulerPhases.set(scheduler, phases)
  }
  return phases
}

// Stop mixins that return themselves from expanding forever.
const MAX_MIX_DESCRIPTORS = 1024

interface MixDescriptor {
  type: (...args: any[]) => unknown
  args: readonly unknown[]
}

type MixDescriptorRunner = (
  descriptor: MixDescriptor,
  index: number,
  mixinProps: ElementProps,
) => unknown

/**
 * Composes an element's `mix` descriptors into its final props.
 *
 * @param hostType Host element tag name the mixins are composed for.
 * @param props Original element props, including `mix`.
 * @param runDescriptor Runs each mixin using the caller's state and error handling.
 * @returns The composed props.
 */
export function composeMixedProps(
  hostType: string,
  props: ElementProps,
  runDescriptor: MixDescriptorRunner,
): ElementProps {
  let descriptors = resolveMixDescriptors(props)
  let composedProps = withoutMix(props)
  let mixinProps: ElementProps | undefined

  for (let index = 0; index < descriptors.length && index < MAX_MIX_DESCRIPTORS; index++) {
    mixinProps ??= withoutMixinContentProps(composedProps)
    let result = runDescriptor(descriptors[index], index, mixinProps)
    if (!result || isMixinElementFunction(result)) continue

    if (Array.isArray(result) || !isRemixElement(result)) {
      let previousLength = descriptors.length
      if (!appendMixDescriptors(result, descriptors)) {
        descriptors.length = previousLength
        console.error(new Error('mixins must return a remix element'))
      }
      continue
    }

    let resultType = isMixinElementFunction(result.type)
      ? result.type.__rmxMixinElementType
      : result.type
    if (resultType !== hostType) {
      console.error(new Error('mixins must return an element with the same host type'))
      continue
    }

    let nextProps = withoutMixinContentProps(result.props, true)
    for (let nested of resolveMixDescriptors(nextProps)) descriptors.push(nested)
    composedProps = { ...composedProps, ...withoutMix(nextProps) }
    mixinProps = undefined
  }

  let nextMix = props.mix
  // A mixin can retain its input props. Do not add `mix` to that same object.
  if (nextMix !== undefined && composedProps === mixinProps) {
    return { ...composedProps, mix: nextMix }
  }
  if (nextMix !== undefined) composedProps.mix = nextMix
  return composedProps
}

// JSX creation flattens nested mix arrays before composition.
function resolveMixDescriptors(props: ElementProps): MixDescriptor[] {
  let mix = props.mix
  if (!mix) return []
  if (Array.isArray(mix)) return mix.filter(Boolean) as MixDescriptor[]
  return [mix] as MixDescriptor[]
}

function withoutMix(props: ElementProps): ElementProps {
  if (!('mix' in props)) return props
  let { mix: _mix, ...output } = props
  return output
}

function withoutMixinContentProps(props: ElementProps, returned = false): ElementProps {
  if (
    !(
      'children' in props ||
      'innerHTML' in props ||
      'srcDoc' in props ||
      'srcdoc' in props ||
      'outerHTML' in props
    )
  )
    return props
  if (returned) console.error(new Error('mixins must not return children or raw HTML props'))
  let {
    children: _children,
    innerHTML: _innerHTML,
    srcDoc: _srcDoc,
    srcdoc: _srcdoc,
    outerHTML: _outerHTML,
    ...output
  } = props
  return output
}

function isMixinElementFunction(
  value: unknown,
): value is ((...args: unknown[]) => unknown) & { __rmxMixinElementType: string } {
  return typeof value === 'function' && '__rmxMixinElementType' in value
}

function appendMixDescriptors(value: unknown, output: MixDescriptor[]): boolean {
  if (!value) return true
  if (Array.isArray(value)) {
    for (let item of value) {
      if (!appendMixDescriptors(item, output)) return false
    }
    return true
  }
  if (!isMixinDescriptor(value)) return false
  output.push(value)
  return true
}
