import type { Context, FrameHandle } from '../component.ts'
import type { ElementProps, RemixElement } from '../core/vnode.ts'
import type { Key } from '../key.ts'
import type { Scheduler, SchedulerPhaseEvent } from '../vdom.ts'
import { isRemixElement, jsx } from '../core/vnode.ts'
import { TypedEventTarget } from '../component.ts'
import { invariant } from '../invariant.ts'

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

export type MixinRuntimeBinding<target = unknown> = {
  node: Element
  parent: ParentNode
  key?: Key
  target: target
  frame: FrameHandle
  scheduler: Scheduler
  enqueueUpdate(done: (signal: AbortSignal) => void): void
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
  // Keep browser-only metadata local to this factory when setup is shared.
  let mixinType =
    options.ssr === false || '__rmxMixinSsr' in type
      ? Object.assign(
          function mixinSetup(handle: MixinHandle<node, props>, hostType: string) {
            return type(handle, hostType)
          },
          { __rmxMixinSsr: options.ssr !== false },
        )
      : type

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

export class MixinRuntime
  extends TypedEventTarget<MixinHandleEventMap<Element>>
  implements AnyMixinHandle
{
  id = `m${++mixinHandleId}`
  context: MixinContext
  frame: FrameHandle
  element: MixinElement<Element, ElementProps>

  #scheduler: Scheduler
  #runners: MixinSlot[] = []
  // Replaced slots can still receive events until their queued removal has run.
  #slots = new Set<MixinSlot>()
  #active?: MixinSlot
  #binding?: MixinRuntimeBinding
  #controller?: AbortController
  // An object keeps the host alive until pending exit callbacks settle or the node is reclaimed.
  #removal: 'active' | 'removing' | 'removed' | PersistedMixinRemoval = 'active'
  #phases?: Set<SchedulerPhaseType>

  constructor(
    hostType: string,
    frame: FrameHandle,
    scheduler: Scheduler,
    getContext: MixinContext['get'],
  ) {
    super()
    this.context = { get: getContext }
    this.frame = frame
    this.#scheduler = scheduler
    let element = ((_: { update(): Promise<AbortSignal> }, __: unknown) => (props: ElementProps) =>
      jsx(hostType, props, null)) as unknown as MixinElement<Element, ElementProps>
    element.__rmxMixinElementType = hostType
    this.element = element
  }

  resolve(hostType: string, props: ElementProps): ElementProps {
    let count = 0
    let mixed = composeMixedProps(hostType, props, (descriptor, index, mixinProps) => {
      count = index + 1
      let slot = this.#runners[index]
      if (slot?.type !== descriptor.type) {
        let previous = slot
        if (previous) this.#scheduler.enqueueCommitPhase([() => this.#removeSlot(previous)])
        slot = { type: descriptor.type as AnyMixinType, runner: () => this.element }
        this.#active = slot
        this.#slots.add(slot)
        let setup = descriptor.type(this, hostType) as AnyMixinSetupResult
        slot.runner = normalizeMixinRunner(setup, this)
        this.#runners[index] = slot
        if (this.#binding) this.#queueBind(slot, 'insert', this.#binding)
      }
      this.#active = slot
      let result = slot.runner(...descriptor.args, mixinProps)
      this.#active = undefined
      return result
    })
    for (let i = count; i < this.#runners.length; i++) this.#removeSlot(this.#runners[i])
    this.#runners.length = count
    return mixed
  }

  bind(binding?: MixinRuntimeBinding, reclaimed = false): void {
    let previousNode = this.#binding?.node
    this.#binding = binding
    if (binding && binding.node !== previousNode) {
      for (let slot of this.#runners)
        this.#queueBind(slot, reclaimed ? 'reclaimed' : 'insert', binding)
    }
  }

  #queueBind(slot: MixinSlot, type: 'insert' | 'reclaimed', binding: MixinRuntimeBinding) {
    let { node, parent, key } = binding
    this.#scheduler.enqueueCommitPhase([() => this.#dispatch(slot, type, { node, parent, key })])
  }

  #dispatch(slot: MixinSlot, type: keyof MixinHandleEventMap<Element>, props?: object) {
    if (!this.#slots.has(slot)) return
    let previous = this.#active
    this.#active = slot
    slot.target?.dispatchEvent(Object.assign(new Event(type), props))
    this.#active = previous
  }

  #release(slot: MixinSlot) {
    slot.controller?.abort()
    this.#slots.delete(slot)
    if (slot === this.#active) this.#active = undefined
    if (!this.#slots.size && this.#phases) {
      for (let type of this.#phases)
        removeSchedulerPhaseListener(this.#scheduler, type, this.#onPhase)
      this.#phases = undefined
    }
  }

  #removeSlot(slot: MixinSlot) {
    this.#dispatch(slot, 'remove')
    this.#release(slot)
  }

  prepareRemoval(): Promise<void> | undefined {
    if (typeof this.#removal === 'object') return this.#removal.done
    if (this.#removal !== 'active') return
    this.#removal = 'removing'
    let teardowns: Array<(signal: AbortSignal) => void | Promise<void>> = []
    let persistNode = (teardown: (signal: AbortSignal) => void | Promise<void>) => {
      teardowns.push(teardown)
    }
    for (let slot of this.#runners) this.#dispatch(slot, 'beforeRemove', { persistNode })
    if (!teardowns.length) return
    let controller = new AbortController()
    let done = Promise.allSettled(
      teardowns.map((fn) => Promise.resolve().then(() => fn(controller.signal))),
    ).then(() => {})
    this.#removal = { controller, done }
    return done
  }

  cancelRemoval() {
    if (typeof this.#removal !== 'object') return
    this.#removal.controller.abort(new DOMException('', 'AbortError'))
    this.#removal = 'active'
  }

  teardown() {
    this.#binding = undefined
    this.prepareRemoval()
    if (typeof this.#removal === 'object') {
      this.#removal.controller.abort(new DOMException('', 'AbortError'))
      this.#removal = 'removing'
    }
    this.#scheduler.enqueueCommitPhase([
      () => {
        for (let slot of this.#runners) this.#dispatch(slot, 'remove')
        for (let slot of this.#runners) this.#release(slot)
        this.#runners.length = 0
        this.#removal = 'removed'
        this.#controller?.abort()
      },
    ])
  }

  get hasSlots() {
    return this.#runners.length !== 0
  }

  get removed() {
    return this.#removal === 'removed'
  }

  get lifetime() {
    this.#controller ??= new AbortController()
    if (this.removed) this.#controller.abort()
    return this.#controller.signal
  }

  get signal() {
    let slot = this.#active
    invariant(
      slot,
      'handle.signal is only available during mixin setup, render, or lifecycle callbacks',
    )
    slot.controller ??= new AbortController()
    return slot.controller.signal
  }

  update(): Promise<AbortSignal> {
    if (!this.#binding || this.removed) return Promise.resolve(this.lifetime)
    let binding = this.#binding
    return new Promise((resolve) => binding.enqueueUpdate(resolve))
  }

  queueTask(task: (node: Element, signal: AbortSignal) => void): void {
    this.#scheduler.enqueueTasks([
      () => {
        invariant(this.#binding)
        task(this.#binding.node, this.lifetime)
      },
    ])
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    invariant(this.#active)
    let target = (this.#active.target ??= new TypedEventTarget())
    target.addEventListener(type, listener, options)
    if (!listener || (type !== 'beforeUpdate' && type !== 'commit') || this.#phases?.has(type))
      return
    this.#phases ??= new Set()
    this.#phases.add(type)
    addSchedulerPhaseListener(this.#scheduler, type, this.#onPhase)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    invariant(this.#active)
    this.#active.target?.removeEventListener(type, listener, options)
  }

  #onPhase = (event: Event) => {
    let node = this.#binding?.node
    if (node && (event as SchedulerPhaseEvent).parents.some((parent) => parent.contains(node))) {
      for (let slot of this.#slots) this.#dispatch(slot, event.type as SchedulerPhaseType, { node })
    }
  }

  dispatchUpdate(type: SchedulerPhaseType) {
    let node = this.#binding?.node
    if (node && this.#phases?.has(type)) {
      for (let slot of this.#runners) this.#dispatch(slot, type, { node })
    }
  }
}

type SchedulerPhaseListeners = Record<SchedulerPhaseType, Set<EventListener>> & {
  dispatch: EventListener
}

// Browser EventTarget add/remove scan every registered listener, so handles share
// one scheduler listener per phase instead of each registering their own.
const schedulerPhaseListeners = new WeakMap<Scheduler, SchedulerPhaseListeners>()

function addSchedulerPhaseListener(
  scheduler: Scheduler,
  type: SchedulerPhaseType,
  listener: EventListener,
) {
  let record = schedulerPhaseListeners.get(scheduler)
  if (!record) {
    let created: SchedulerPhaseListeners = {
      beforeUpdate: new Set(),
      commit: new Set(),
      dispatch(event) {
        let listeners = created[event.type as SchedulerPhaseType]
        for (let listener of Array.from(listeners)) {
          if (!listeners.has(listener)) continue
          try {
            listener(event)
          } catch (error) {
            reportError(error)
          }
        }
      },
    }
    record = created
    schedulerPhaseListeners.set(scheduler, record)
  }
  record[type].add(listener)
  if (record[type].size === 1) scheduler.addEventListener(type, record.dispatch)
}

function removeSchedulerPhaseListener(
  scheduler: Scheduler,
  type: SchedulerPhaseType,
  listener: EventListener,
) {
  let record = schedulerPhaseListeners.get(scheduler)
  if (!record?.[type].delete(listener)) return
  if (record[type].size === 0) scheduler.removeEventListener(type, record.dispatch)
}

function normalizeMixinRunner(result: AnyMixinSetupResult, handle: AnyMixinHandle): AnyMixinRunner {
  if (typeof result === 'function' && !isMixinElementFunction(result)) {
    return result as AnyMixinRunner
  }
  if (result === undefined) {
    return () => handle.element
  }
  return () => result as AnyMixinRunnerResult
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

    let resultType =
      typeof result.type === 'string'
        ? result.type
        : isMixinElementFunction(result.type)
          ? result.type.__rmxMixinElementType
          : null
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

export function isMixinDescriptor(value: unknown): value is MixDescriptor {
  if (!value || typeof value !== 'object' || isRemixElement(value)) {
    return false
  }

  let descriptor = value as { type?: unknown; args?: unknown }
  return typeof descriptor.type === 'function' && Array.isArray(descriptor.args)
}

export function isMixinElementFunction(
  value: unknown,
): value is ((...args: unknown[]) => unknown) & { __rmxMixinElementType: string } {
  if (typeof value !== 'function') return false
  return '__rmxMixinElementType' in value
}

function appendMixDescriptors(value: unknown, output: MixDescriptor[]): boolean {
  if (!value) {
    return true
  }

  if (Array.isArray(value)) {
    for (let item of value) {
      if (!appendMixDescriptors(item, output)) {
        return false
      }
    }
    return true
  }

  if (!isMixinDescriptor(value)) {
    return false
  }

  output.push(value)
  return true
}
