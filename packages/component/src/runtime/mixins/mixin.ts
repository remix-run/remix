import type { Context, FrameHandle } from '../component.ts'
import type { ElementProps, RemixElement } from '../jsx.ts'
import type { Key } from '../key.ts'
import type { Scheduler } from '../scheduler.ts'
import type { SchedulerPhaseEvent } from '../scheduler.ts'
import { jsx } from '../jsx.ts'
import { TypedEventTarget } from '../typed-event-target.ts'
import { invariant } from '../invariant.ts'
import { composeMixedProps, isMixinElementFunction } from '../core/mix.ts'

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
type ScopedAnyMixinHandle = AnyMixinHandle & {
  queueCommitTask(task: () => void): void
  setActiveScope(scope?: symbol): void
  dispatchScopedEvent(scope: symbol, event: Event): void
  releaseScope(scope: symbol): void
}

type RunnerEntry = {
  type: AnyMixinType
  runner: AnyMixinRunner
  scope: symbol
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

type ResolveMixedPropsInput = {
  hostType: string
  frame: FrameHandle
  scheduler: Scheduler
  getContext?: MixinContext['get']
  props: ElementProps
  state?: MixinRuntimeState
}

type ResolveMixedPropsOutput = {
  props: ElementProps
  state: MixinRuntimeState
}

export type MixinRuntimeState = {
  id: string
  controller?: AbortController
  aborted: boolean
  handle?: AnyMixinHandle
  runners: RunnerEntry[]
  binding?: MixinRuntimeBinding
  removePrepared?: boolean
  pendingRemoval?: {
    controller: AbortController
    done: Promise<void>
  }
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

export function resolveMixedProps(input: ResolveMixedPropsInput): ResolveMixedPropsOutput {
  let state = input.state ?? createMixinRuntimeState()
  let hostType = input.hostType
  state.handle ??= new MixinHandleImpl(
    state,
    hostType,
    input.frame,
    input.scheduler,
    input.getContext ?? (() => undefined),
  )
  let handle = state.handle as ScopedAnyMixinHandle

  let runnerCount = 0
  let props = composeMixedProps(hostType, input.props, (descriptor, index, mixinProps) => {
    runnerCount = index + 1
    let entry = state.runners[index]
    if (!entry || entry.type !== descriptor.type) {
      if (entry) {
        queueMixinRemove(handle, entry.scope)
      }
      let scope = Symbol('mixin-scope')
      handle.setActiveScope(scope)
      entry = {
        scope,
        type: descriptor.type as AnyMixinType,
        runner: normalizeMixinRunner(
          descriptor.type(handle, hostType) as AnyMixinSetupResult,
          handle,
        ),
      }
      handle.setActiveScope(undefined)
      state.runners[index] = entry
      let binding = state.binding
      if (binding?.node) {
        queueMixinBindEvent(handle, entry.scope, 'insert', binding)
      }
    }

    // Unlike the server renderer, mixin errors are not isolated here: a
    // throwing mixin aborts the client render.
    handle.setActiveScope(entry.scope)
    let result = entry.runner(...descriptor.args, mixinProps)
    handle.setActiveScope(undefined)
    return result
  })

  for (let index = runnerCount; index < state.runners.length; index++) {
    let entry = state.runners[index]
    if (entry) {
      removeMixinScope(handle, entry.scope)
    }
  }

  if (state.runners.length > runnerCount) {
    state.runners.length = runnerCount
  }

  return { state, props }
}

export function teardownMixins(state?: MixinRuntimeState) {
  if (!state) return
  state.binding = undefined
  prepareMixinRemoval(state)
  cancelPendingMixinRemoval(state)
  let handle = state.handle as ScopedAnyMixinHandle | undefined
  if (handle) {
    handle.queueCommitTask(() => finalizeMixinTeardown(state))
    return
  }
  finalizeMixinTeardown(state)
}

export function bindMixinRuntime<target>(
  state: MixinRuntimeState | undefined,
  binding?: MixinRuntimeBinding<target>,
  reclaimed?: boolean,
) {
  if (!state) return
  let previousNode = state.binding?.node
  state.binding = binding
  if (!binding?.node || previousNode === binding.node) return
  let handle = state.handle as ScopedAnyMixinHandle | undefined
  if (!handle) return
  for (let entry of state.runners) {
    queueMixinBindEvent(handle, entry.scope, reclaimed ? 'reclaimed' : 'insert', binding)
  }
}

export function prepareMixinRemoval(state?: MixinRuntimeState) {
  if (!state || state.removePrepared) return state?.pendingRemoval?.done
  state.removePrepared = true

  let pendingRemoval: MixinRuntimeState['pendingRemoval']
  let persistTeardowns: Array<(signal: AbortSignal) => void | Promise<void>> = []
  let registerPersistNode = (teardown: (signal: AbortSignal) => void | Promise<void>) => {
    persistTeardowns.push(teardown)
  }

  if (!state.handle) return
  dispatchMixinEvent(state, () => {
    let event = new Event('beforeRemove') as MixinBeforeRemoveEvent
    event.persistNode = registerPersistNode
    return event
  })

  if (persistTeardowns.length > 0) {
    let controller = new AbortController()
    let done = Promise.allSettled(
      persistTeardowns.map((teardown) => Promise.resolve().then(() => teardown(controller.signal))),
    ).then(() => {})
    pendingRemoval = { controller, done }
  }

  state.pendingRemoval = pendingRemoval
  return pendingRemoval?.done
}

export function cancelPendingMixinRemoval(
  state?: MixinRuntimeState,
  reason: unknown = new DOMException('', 'AbortError'),
) {
  if (!state?.pendingRemoval) return
  state.pendingRemoval.controller.abort(reason)
  state.pendingRemoval = undefined
  state.removePrepared = false
}

function createMixinRuntimeState(): MixinRuntimeState {
  return {
    id: `m${++mixinHandleId}`,
    aborted: false,
    runners: [],
  }
}

type SchedulerPhaseType = 'beforeUpdate' | 'commit'

type MixinScope = {
  target: TypedEventTarget<MixinHandleEventMap<Element>>
  phaseCounts: Record<SchedulerPhaseType, number>
  controller?: AbortController
}

class MixinHandleImpl
  extends TypedEventTarget<MixinHandleEventMap<Element>>
  implements ScopedAnyMixinHandle
{
  id: string
  context: MixinContext
  frame: FrameHandle
  element: MixinElement<Element, ElementProps>
  #state: MixinRuntimeState
  #scheduler: Scheduler
  #phaseListenerCounts: Record<SchedulerPhaseType, number> = {
    beforeUpdate: 0,
    commit: 0,
  }
  #activeScope?: symbol
  #scopes = new Map<symbol, MixinScope>()
  #onSchedulerPhase = (event: Event) => {
    let binding = this.#state.binding
    if (!binding) return
    if (!isBindingInUpdateScope(binding, (event as SchedulerPhaseEvent).parents)) return
    for (let [, scope] of this.#scopes) {
      let updateEvent = new Event(event.type) as MixinUpdateEvent<Element>
      updateEvent.node = binding.node
      scope.target.dispatchEvent(updateEvent)
    }
  }

  constructor(
    state: MixinRuntimeState,
    hostType: string,
    frame: FrameHandle,
    scheduler: Scheduler,
    getContext: MixinContext['get'],
  ) {
    super()
    this.#state = state
    this.#scheduler = scheduler
    this.id = state.id
    this.context = {
      get: getContext,
    }
    this.frame = frame

    let element = ((_: { update(): Promise<AbortSignal> }, __: unknown) =>
      (props: ElementProps) => ({
        $rmx: true as const,
        type: hostType,
        key: null,
        props,
      })) as unknown as MixinElement<Element, ElementProps>
    element.__rmxMixinElementType = hostType
    this.element = element
  }

  get signal() {
    let scope = this.#activeScope
    invariant(
      scope,
      'handle.signal is only available during mixin setup, render, or lifecycle callbacks',
    )
    let record = this.#scopes.get(scope)
    invariant(record)
    record.controller ??= new AbortController()
    return record.controller.signal
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    let scope = this.#getActiveScope()
    scope.target.addEventListener(
      type as keyof MixinHandleEventMap<Element>,
      listener as EventListener,
      options,
    )
    if (!listener || !isSchedulerPhaseType(type)) return
    scope.phaseCounts[type] += 1
    this.#updatePhaseListenerCount(type, 1)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    let scope = this.#getActiveScope()
    scope.target.removeEventListener(
      type as keyof MixinHandleEventMap<Element>,
      listener as EventListener,
      typeof options === 'boolean' ? { capture: options } : options,
    )
    if (!listener || !isSchedulerPhaseType(type)) return
    scope.phaseCounts[type] = Math.max(0, scope.phaseCounts[type] - 1)
    this.#updatePhaseListenerCount(type, -1)
  }

  update(): Promise<AbortSignal> {
    return new Promise((resolve) => {
      let signal = getMixinRuntimeSignal(this.#state)
      if (signal.aborted) {
        resolve(signal)
        return
      }
      let binding = this.#state.binding
      if (!binding) {
        resolve(signal)
        return
      }
      binding.enqueueUpdate(resolve)
    })
  }

  queueTask(task: (node: Element, signal: AbortSignal) => void): void {
    this.#scheduler.enqueueTasks([
      () => {
        let binding = this.#state.binding
        invariant(binding)
        task(binding.node, getMixinRuntimeSignal(this.#state))
      },
    ])
  }

  queueCommitTask(task: () => void): void {
    this.#scheduler.enqueueCommitPhase([task])
  }

  setActiveScope(scope?: symbol): void {
    this.#activeScope = scope
    if (!scope) return
    if (this.#scopes.has(scope)) return
    this.#scopes.set(scope, {
      target: new TypedEventTarget<MixinHandleEventMap<Element>>(),
      phaseCounts: { beforeUpdate: 0, commit: 0 },
    })
  }

  dispatchScopedEvent(scope: symbol, event: Event): void {
    let record = this.#scopes.get(scope)
    if (!record) return
    let previousScope = this.#activeScope
    this.#activeScope = scope
    record.target.dispatchEvent(event)
    this.#activeScope = previousScope
  }

  releaseScope(scope: symbol): void {
    let record = this.#scopes.get(scope)
    if (record) {
      this.#updatePhaseListenerCount('beforeUpdate', -record.phaseCounts.beforeUpdate)
      this.#updatePhaseListenerCount('commit', -record.phaseCounts.commit)
      record.controller?.abort()
      this.#scopes.delete(scope)
    }
    if (this.#activeScope === scope) {
      this.#activeScope = undefined
    }
  }

  #getActiveScope(): MixinScope {
    let scope = this.#activeScope
    invariant(scope)
    let record = this.#scopes.get(scope)
    invariant(record)
    return record
  }

  // Subscribes to the scheduler phase when the first listener is added and
  // unsubscribes whenever the count reaches zero on removal.
  #updatePhaseListenerCount(type: SchedulerPhaseType, delta: number) {
    if (delta === 0) return
    let count = Math.max(0, this.#phaseListenerCounts[type] + delta)
    this.#phaseListenerCounts[type] = count
    if (delta > 0) {
      if (count === 1) this.#scheduler.addEventListener(type, this.#onSchedulerPhase)
    } else if (count === 0) {
      this.#scheduler.removeEventListener(type, this.#onSchedulerPhase)
    }
  }
}

export function getMixinRuntimeSignal(state: MixinRuntimeState): AbortSignal {
  let controller = state.controller
  if (!controller) {
    controller = new AbortController()
    if (state.aborted) {
      controller.abort()
    }
    state.controller = controller
  }
  return controller.signal
}

export function dispatchMixinBeforeUpdate(state?: MixinRuntimeState) {
  dispatchMixinUpdateEvent(state, 'beforeUpdate')
}

export function dispatchMixinCommit(state?: MixinRuntimeState) {
  dispatchMixinUpdateEvent(state, 'commit')
}

function queueMixinBindEvent(
  handle: ScopedAnyMixinHandle,
  scope: symbol,
  type: 'insert' | 'reclaimed',
  binding: MixinRuntimeBinding,
) {
  let { node, parent, key } = binding
  handle.queueCommitTask(() => {
    let event = new Event(type) as MixinInsertEvent<Element>
    event.node = node
    event.parent = parent
    event.key = key
    handle.dispatchScopedEvent(scope, event)
  })
}

function removeMixinScope(handle: ScopedAnyMixinHandle, scope: symbol) {
  handle.dispatchScopedEvent(scope, new Event('remove'))
  handle.releaseScope(scope)
}

function queueMixinRemove(handle: ScopedAnyMixinHandle, scope: symbol) {
  handle.queueCommitTask(() => removeMixinScope(handle, scope))
}

function dispatchMixinEvent(state: MixinRuntimeState | undefined, createEvent: () => Event) {
  if (!state?.handle) return
  let handle = state.handle as ScopedAnyMixinHandle
  for (let entry of state.runners) {
    handle.dispatchScopedEvent(entry.scope, createEvent())
  }
}

function finalizeMixinTeardown(state: MixinRuntimeState) {
  dispatchMixinEvent(state, () => new Event('remove'))
  let handle = state.handle as ScopedAnyMixinHandle | undefined
  if (handle) {
    for (let entry of state.runners) {
      handle.releaseScope(entry.scope)
    }
  }
  state.runners.length = 0
  state.aborted = true
  state.controller?.abort()
  state.pendingRemoval = undefined
  state.removePrepared = true
  state.handle = undefined
}

function dispatchMixinUpdateEvent(state: MixinRuntimeState | undefined, type: SchedulerPhaseType) {
  let node = state?.binding?.node
  if (!node) return
  dispatchMixinEvent(state, () => {
    let event = new Event(type) as MixinUpdateEvent<Element>
    event.node = node
    return event
  })
}

function isSchedulerPhaseType(type: string): type is SchedulerPhaseType {
  return type === 'beforeUpdate' || type === 'commit'
}

function isBindingInUpdateScope(binding: MixinRuntimeBinding, parents: ParentNode[]): boolean {
  for (let parent of parents) {
    if (parent.contains(binding.node)) return true
  }
  return false
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
