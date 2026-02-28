import type { FrameHandle } from './component.ts'
import type { ElementProps, RemixElement } from './jsx.ts'
import type { Scheduler } from './scheduler.ts'
import type { SchedulerPhaseEvent } from './scheduler.ts'
import { TypedEventTarget } from './typed-event-target.ts'
import { invariant } from './invariant.ts'

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

export type MixinProps<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = props & {
  mix?: MixValue<node, props>
}

export type MixinElement<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = ((
  handle: { update(): Promise<AbortSignal> },
  setup: unknown,
) => (props: MixinProps<node, props>) => RemixElement) & {
  __rmxMixinElementType: string
}

export type MixinInsertEvent<node extends EventTarget = Element> = Event & {
  node: node
  parent: ParentNode
  key?: string
}

export type MixinReclaimedEvent<node extends EventTarget = Element> = Event & {
  node: node
  parent: ParentNode
  key?: string
}

export type MixinUpdateEvent<node extends EventTarget = Element> = Event & {
  node: node
}

export type MixinBeforeRemoveEvent = Event & {
  persistNode(teardown: (signal: AbortSignal) => void | Promise<void>): void
}

type MixinHandleEventMap<node extends EventTarget = Element> = {
  beforeRemove: MixinBeforeRemoveEvent
  reclaimed: MixinReclaimedEvent<node>
  remove: Event
  insert: MixinInsertEvent<node>
  beforeUpdate: MixinUpdateEvent<node>
  commit: MixinUpdateEvent<node>
}

export type MixinHandle<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = TypedEventTarget<MixinHandleEventMap<node>> & {
  id: string
  frame: FrameHandle
  element: MixinElement<node, props>
  signal: AbortSignal
  update(): Promise<AbortSignal>
  queueTask(task: (node: node, signal: AbortSignal) => void): void
}

type MixinRuntimeType<
  args extends unknown[] = [],
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) =>
  | ((
      ...args: [...args, currentProps: props]
    ) => void | null | RemixElement | MixinElement<node, props>)
  | void

export type MixinType<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) =>
  | ((
      ...args: [...args, currentProps: props]
    ) => void | null | RemixElement | MixinElement<node, props>)
  | void

export type MixinDescriptor<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = {
  type: MixinRuntimeType<args, node, props>
  args: args
  readonly __node?: (node: node) => void
}

export type MixValue<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = ReadonlyArray<MixinDescriptor<node, any, props>>

type AnyMixinType = MixinRuntimeType<unknown[], Element, ElementProps>
type AnyMixinDescriptor = MixinDescriptor<Element, unknown[], ElementProps>
type AnyMixinRunner = (
  ...args: [...unknown[], currentProps: ElementProps]
) => void | null | RemixElement | MixinElement<Element, ElementProps>
type AnyMixinRunnerResult = ReturnType<AnyMixinRunner>
type AnyMixinSetupResult = ReturnType<AnyMixinType> | AnyMixinRunnerResult
type AnyMixinHandle = MixinHandle<Element, ElementProps>
type ScopedAnyMixinHandle = AnyMixinHandle & {
  setActiveScope(scope?: symbol): void
  dispatchScopedEvent(scope: symbol, event: Event): void
  releaseScope(scope: symbol): void
}

type RunnerEntry = {
  type: AnyMixinType
  runner: AnyMixinRunner
  scope: symbol
}

type MixinHandleFactoryOptions = {
  id: string
  hostType: string
  frame: FrameHandle
  scheduler: Scheduler
  getSignal: () => AbortSignal
  getBinding: () => MixinRuntimeBinding | undefined
}

export type MixinRuntimeBinding = {
  node: Element
  parent: ParentNode
  key?: string
  enqueueUpdate(done: (signal: AbortSignal) => void): void
}

type ResolveMixedPropsInput = {
  hostType: string
  frame: FrameHandle
  scheduler: Scheduler
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
    signal: AbortSignal
    cancel: (reason?: unknown) => void
    done: Promise<void>
  }
}

let mixinHandleId = 0

export function createMixin<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
>(type: MixinType<node, args, props>) {
  return <boundNode extends node = node>(
    ...args: RebindTuple<args, node, boundNode>
  ): MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props> => ({
    type: type as unknown as MixinRuntimeType<RebindTuple<args, node, boundNode>, boundNode, props>,
    args: args as RebindTuple<args, node, boundNode>,
  })
}

export function resolveMixedProps(input: ResolveMixedPropsInput): ResolveMixedPropsOutput {
  let state = input.state ?? createMixinRuntimeState()
  let handle = state.handle as ScopedAnyMixinHandle | undefined
  if (!handle) {
    handle = createMixinHandle({
      id: state.id,
      hostType: input.hostType,
      frame: input.frame,
      scheduler: input.scheduler,
      getSignal: () => getMixinRuntimeSignal(state),
      getBinding: () => state.binding,
    }) as ScopedAnyMixinHandle
    state.handle = handle
  }
  let hostType = input.hostType
  let descriptors = resolveMixDescriptors(input.props)
  let composedProps = withoutMix(input.props)
  let maxDescriptors = 1024

  for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
    let descriptor = descriptors[index]
    let entry = state.runners[index]
    if (!entry || entry.type !== descriptor.type) {
      if (entry) {
        handle.dispatchScopedEvent(entry.scope, new Event('remove'))
        handle.releaseScope(entry.scope)
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
        dispatchMixinInsert(handle, entry.scope, binding.node, binding.parent, binding.key)
      }
    }

    handle.setActiveScope(entry.scope)
    let result = entry.runner(...descriptor.args, composedProps)
    handle.setActiveScope(undefined)
    if (!result) continue
    if (isMixinElement(result)) continue

    if (!isRemixElement(result)) {
      console.error(new Error('mixins must return a remix element'))
      continue
    }

    let resultType =
      typeof result.type === 'string'
        ? result.type
        : isMixinElement(result.type)
          ? result.type.__rmxMixinElementType
          : null
    if (resultType !== hostType) {
      console.error(new Error('mixins must return an element with the same host type'))
      continue
    }

    if (result.type !== resultType) {
      result = { ...result, type: resultType }
    }

    let nestedDescriptors = resolveMixDescriptors(result.props)
    for (let nested of nestedDescriptors) descriptors.push(nested)
    composedProps = composeMixinProps(composedProps, withoutMix(result.props))
  }

  for (let index = descriptors.length; index < state.runners.length; index++) {
    let entry = state.runners[index]
    if (entry) {
      handle.dispatchScopedEvent(entry.scope, new Event('remove'))
      handle.releaseScope(entry.scope)
    }
  }

  if (state.runners.length > descriptors.length) {
    state.runners.length = descriptors.length
  }

  let nextMix = input.props.mix
  return {
    state,
    props: {
      ...composedProps,
      ...(nextMix === undefined ? {} : { mix: nextMix }),
    },
  }
}

export function teardownMixins(state?: MixinRuntimeState) {
  if (!state) return
  state.binding = undefined
  prepareMixinRemoval(state)
  cancelPendingMixinRemoval(state)
  dispatchMixinRemoveEvent(state)
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

export function bindMixinRuntime(
  state: MixinRuntimeState | undefined,
  binding?: MixinRuntimeBinding,
  options?: { dispatchReclaimed?: boolean },
) {
  if (!state) return
  let previousNode = state.binding?.node
  let nextBinding = binding
  state.binding = nextBinding
  if (!nextBinding?.node || previousNode === nextBinding.node) return
  let nextNode = nextBinding.node
  let handle = state.handle as ScopedAnyMixinHandle | undefined
  if (!handle) return
  for (let entry of state.runners) {
    if (options?.dispatchReclaimed) {
      dispatchMixinReclaimed(handle, entry.scope, nextNode, nextBinding.parent, nextBinding.key)
    } else {
      dispatchMixinInsert(handle, entry.scope, nextNode, nextBinding.parent, nextBinding.key)
    }
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

  let handle = state.handle as ScopedAnyMixinHandle | undefined
  if (!handle) return
  for (let entry of state.runners) {
    dispatchMixinBeforeRemove(handle, entry.scope, registerPersistNode)
  }

  if (persistTeardowns.length > 0) {
    let controller = new AbortController()
    let done = Promise.allSettled(
      persistTeardowns.map((teardown) => Promise.resolve().then(() => teardown(controller.signal))),
    ).then(() => {})
    pendingRemoval = {
      signal: controller.signal,
      cancel(reason) {
        controller.abort(reason)
      },
      done,
    }
  }

  state.pendingRemoval = pendingRemoval
  return pendingRemoval?.done
}

export function cancelPendingMixinRemoval(
  state?: MixinRuntimeState,
  reason: unknown = new DOMException('', 'AbortError'),
) {
  if (!state?.pendingRemoval) return
  state.pendingRemoval.cancel(reason)
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

function createMixinHandle(options: {
  id: string
  hostType: string
  frame: FrameHandle
  scheduler: Scheduler
  getSignal: () => AbortSignal
  getBinding: () => MixinRuntimeBinding | undefined
}): AnyMixinHandle {
  return new MixinHandleImpl(options)
}

class MixinHandleImpl
  extends TypedEventTarget<MixinHandleEventMap<Element>>
  implements ScopedAnyMixinHandle
{
  id: string
  frame: FrameHandle
  element: MixinElement<Element, ElementProps>
  #options: MixinHandleFactoryOptions
  #phaseListenerCounts: Record<'beforeUpdate' | 'commit', number> = {
    beforeUpdate: 0,
    commit: 0,
  }
  #activeScope?: symbol
  #scopeTargets = new Map<symbol, TypedEventTarget<MixinHandleEventMap<Element>>>()
  #scopePhaseCounts = new Map<symbol, Record<'beforeUpdate' | 'commit', number>>()
  #onSchedulerBeforeUpdate = (event: Event) => {
    this.#dispatchSchedulerPhaseToHandle('beforeUpdate', event as SchedulerPhaseEvent)
  }
  #onSchedulerCommit = (event: Event) => {
    this.#dispatchSchedulerPhaseToHandle('commit', event as SchedulerPhaseEvent)
  }

  constructor(options: MixinHandleFactoryOptions) {
    super()
    this.#options = options
    this.id = options.id
    this.frame = options.frame

    let element = ((_: { update(): Promise<AbortSignal> }, __: unknown) =>
      (props: ElementProps) => ({
        $rmx: true as const,
        type: options.hostType,
        key: null,
        props,
      })) as unknown as MixinElement<Element, ElementProps>
    element.__rmxMixinElementType = options.hostType
    this.element = element
  }

  get signal() {
    return this.#options.getSignal()
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    let target = this.#getActiveScopeTarget()
    target.addEventListener(
      type as keyof MixinHandleEventMap<Element>,
      listener as EventListener,
      options,
    )
    if (!listener || !isSchedulerPhaseType(type)) return
    let scope = this.#activeScope
    invariant(scope)
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope)
    invariant(scopePhaseCounts)
    scopePhaseCounts[type] += 1
    this.#phaseListenerCounts[type] += 1
    if (this.#phaseListenerCounts[type] !== 1) return
    if (type === 'beforeUpdate') {
      this.#options.scheduler.addEventListener('beforeUpdate', this.#onSchedulerBeforeUpdate)
    } else {
      this.#options.scheduler.addEventListener('commit', this.#onSchedulerCommit)
    }
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    let target = this.#getActiveScopeTarget()
    target.removeEventListener(
      type as keyof MixinHandleEventMap<Element>,
      listener as EventListener,
      typeof options === 'boolean' ? { capture: options } : options,
    )
    if (!listener || !isSchedulerPhaseType(type)) return
    let scope = this.#activeScope
    invariant(scope)
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope)
    invariant(scopePhaseCounts)
    scopePhaseCounts[type] = Math.max(0, scopePhaseCounts[type] - 1)
    this.#phaseListenerCounts[type] = Math.max(0, this.#phaseListenerCounts[type] - 1)
    if (this.#phaseListenerCounts[type] !== 0) return
    if (type === 'beforeUpdate') {
      this.#options.scheduler.removeEventListener('beforeUpdate', this.#onSchedulerBeforeUpdate)
    } else {
      this.#options.scheduler.removeEventListener('commit', this.#onSchedulerCommit)
    }
  }

  update(): Promise<AbortSignal> {
    return new Promise((resolve) => {
      let signal = this.#options.getSignal()
      if (signal.aborted) {
        resolve(signal)
        return
      }
      let binding = this.#options.getBinding()
      if (!binding) {
        resolve(signal)
        return
      }
      binding.enqueueUpdate(resolve)
    })
  }

  queueTask(task: (node: Element, signal: AbortSignal) => void): void {
    this.#options.scheduler.enqueueTasks([
      () => {
        let binding = this.#options.getBinding()
        invariant(binding)
        task(binding.node, this.#options.getSignal())
      },
    ])
  }

  setActiveScope(scope?: symbol): void {
    this.#activeScope = scope
    if (!scope) return
    if (this.#scopeTargets.has(scope)) return
    this.#scopeTargets.set(scope, new TypedEventTarget<MixinHandleEventMap<Element>>())
    this.#scopePhaseCounts.set(scope, { beforeUpdate: 0, commit: 0 })
  }

  dispatchScopedEvent(scope: symbol, event: Event): void {
    let previousScope = this.#activeScope
    this.#activeScope = scope
    this.#scopeTargets.get(scope)?.dispatchEvent(event)
    this.#activeScope = previousScope
  }

  releaseScope(scope: symbol): void {
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope)
    if (scopePhaseCounts) {
      this.#decrementGlobalPhaseCount('beforeUpdate', scopePhaseCounts.beforeUpdate)
      this.#decrementGlobalPhaseCount('commit', scopePhaseCounts.commit)
    }
    this.#scopePhaseCounts.delete(scope)
    this.#scopeTargets.delete(scope)
    if (this.#activeScope === scope) {
      this.#activeScope = undefined
    }
  }

  #dispatchSchedulerPhaseToHandle(type: 'beforeUpdate' | 'commit', event: SchedulerPhaseEvent) {
    let binding = this.#options.getBinding()
    if (!binding) return
    if (!isBindingInUpdateScope(binding, event.parents)) return
    for (let [, target] of this.#scopeTargets) {
      let updateEvent = new Event(type) as MixinUpdateEvent<Element>
      updateEvent.node = binding.node
      target.dispatchEvent(updateEvent)
    }
  }

  #getActiveScopeTarget(): TypedEventTarget<MixinHandleEventMap<Element>> {
    let scope = this.#activeScope
    invariant(scope)
    let target = this.#scopeTargets.get(scope)
    invariant(target)
    return target
  }

  #decrementGlobalPhaseCount(type: 'beforeUpdate' | 'commit', amount: number) {
    if (amount <= 0) return
    this.#phaseListenerCounts[type] = Math.max(0, this.#phaseListenerCounts[type] - amount)
    if (this.#phaseListenerCounts[type] !== 0) return
    if (type === 'beforeUpdate') {
      this.#options.scheduler.removeEventListener('beforeUpdate', this.#onSchedulerBeforeUpdate)
    } else {
      this.#options.scheduler.removeEventListener('commit', this.#onSchedulerCommit)
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

function dispatchMixinInsert(
  handle: ScopedAnyMixinHandle,
  scope: symbol,
  node: Element,
  parent: ParentNode,
  key?: string,
) {
  let event = new Event('insert') as MixinInsertEvent<Element>
  event.node = node
  event.parent = parent
  event.key = key
  handle.dispatchScopedEvent(scope, event)
}

function dispatchMixinReclaimed(
  handle: ScopedAnyMixinHandle,
  scope: symbol,
  node: Element,
  parent: ParentNode,
  key?: string,
) {
  let event = new Event('reclaimed') as MixinReclaimedEvent<Element>
  event.node = node
  event.parent = parent
  event.key = key
  handle.dispatchScopedEvent(scope, event)
}

function dispatchMixinBeforeRemove(
  handle: ScopedAnyMixinHandle,
  scope: symbol,
  persistNode: (teardown: (signal: AbortSignal) => void | Promise<void>) => void,
) {
  let event = new Event('beforeRemove') as MixinBeforeRemoveEvent
  event.persistNode = persistNode
  handle.dispatchScopedEvent(scope, event)
}

function dispatchMixinRemoveEvent(state?: MixinRuntimeState) {
  let runners = state?.runners
  if (!runners?.length) return
  let handle = state?.handle as ScopedAnyMixinHandle | undefined
  if (!handle) return
  for (let entry of runners) {
    handle.dispatchScopedEvent(entry.scope, new Event('remove'))
  }
}

function dispatchMixinUpdateEvent(
  state: MixinRuntimeState | undefined,
  type: 'beforeUpdate' | 'commit',
) {
  let node = state?.binding?.node
  if (!node) return
  let runners = state?.runners
  if (!runners?.length) return
  let handle = state?.handle as ScopedAnyMixinHandle | undefined
  if (!handle) return
  for (let entry of runners) {
    let event = new Event(type) as MixinUpdateEvent<Element>
    event.node = node
    handle.dispatchScopedEvent(entry.scope, event)
  }
}

function isSchedulerPhaseType(type: string): type is 'beforeUpdate' | 'commit' {
  return type === 'beforeUpdate' || type === 'commit'
}

function isBindingInUpdateScope(binding: MixinRuntimeBinding, parents: ParentNode[]): boolean {
  if (parents.length === 0) return false
  let node = binding.node as Node
  for (let parent of parents) {
    let parentNode = parent as Node
    if (parentNode === node) return true
    if (parentNode.contains(node)) return true
  }
  return false
}

function resolveMixDescriptors(props: ElementProps): AnyMixinDescriptor[] {
  let mix = props.mix
  if (mix == null || !Array.isArray(mix) || mix.length === 0) return []
  return [...mix] as AnyMixinDescriptor[]
}

function withoutMix(props: ElementProps): ElementProps {
  if (!('mix' in props)) return props
  let output = { ...props }
  delete output.mix
  return output
}

function composeMixinProps(previous: ElementProps, next: ElementProps): ElementProps {
  return { ...previous, ...next }
}

function isRemixElement(value: unknown): value is RemixElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}

function isMixinElement(value: unknown): value is MixinElement<Element, ElementProps> {
  if (typeof value !== 'function') return false
  return '__rmxMixinElementType' in value
}

function normalizeMixinRunner(result: AnyMixinSetupResult, handle: AnyMixinHandle): AnyMixinRunner {
  if (typeof result === 'function' && !isMixinElement(result)) {
    return result as AnyMixinRunner
  }
  if (result === undefined) {
    return () => handle.element
  }
  return () => result as AnyMixinRunnerResult
}
