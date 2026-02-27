import { createContainer, TypedEventTarget } from '@remix-run/interaction'
import type { EventListeners } from '@remix-run/interaction'
import type { FrameHandle } from './component.ts'
import type { ElementProps, RemixElement } from './jsx.ts'
import type { Scheduler } from './scheduler.ts'
import type { SchedulerPhaseEvent } from './scheduler.ts'
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
  reclaimed: boolean
  parent: ParentNode
  key?: string
}

export type MixinUpdateEvent<node extends EventTarget = Element> = Event & {
  node: node
}

export type MixinRemoveEvent = Event & {
  persistNode(teardown: (signal: AbortSignal) => void | Promise<void>): void
}

type MixinHandleEventMap<node extends EventTarget = Element> = {
  remove: MixinRemoveEvent
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
  update(): Promise<AbortSignal>
  queueTask(task: (node: node, signal: AbortSignal) => void): void
  on: <target extends EventTarget>(target: target, listeners: EventListeners<target>) => void
}

type MixinRuntimeType<
  args extends unknown[] = [],
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => (
  ...args: [...args, currentProps: props]
) => void | null | RemixElement | MixinElement<node, props>

export type MixinType<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => (
  ...args: [...args, currentProps: props]
) => void | null | RemixElement | MixinElement<node, props>

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
type AnyMixinHandle = MixinHandle<Element, ElementProps>

type RunnerEntry = {
  type: AnyMixinType
  runner: AnyMixinRunner
  handle: AnyMixinHandle
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
  let hostType = input.hostType
  let scheduler = input.scheduler
  let descriptors = resolveMixDescriptors(input.props)
  let composedProps = withoutMix(input.props)
  let maxDescriptors = 1024

  for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
    let descriptor = descriptors[index]
    let entry = state.runners[index]
    if (!entry || entry.type !== descriptor.type) {
      if (entry) {
        dispatchMixinRemove(entry.handle, () => {})
      }
      let handle = createMixinHandle({
        id: state.id,
        hostType,
        frame: input.frame,
        scheduler,
        getSignal: () => getMixinRuntimeSignal(state),
        getBinding: () => state.binding,
      })
      entry = {
        type: descriptor.type as AnyMixinType,
        runner: descriptor.type(handle, hostType) as AnyMixinRunner,
        handle,
      }
      state.runners[index] = entry
      let binding = state.binding
      if (binding?.node) {
        dispatchMixinInsert(entry.handle, binding.node, false, binding.parent, binding.key)
      }
    }

    let result = entry.runner(...descriptor.args, composedProps)
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

    let nestedDescriptors = resolveMixDescriptors(result.props as ElementProps)
    for (let nested of nestedDescriptors) descriptors.push(nested)
    composedProps = composeMixinProps(composedProps, withoutMix(result.props as ElementProps))
  }

  for (let index = descriptors.length; index < state.runners.length; index++) {
    let entry = state.runners[index]
    if (entry) {
      dispatchMixinRemove(entry.handle, () => {})
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
  state.runners.length = 0
  state.aborted = true
  state.controller?.abort()
  state.pendingRemoval = undefined
  state.removePrepared = true
}

export function bindMixinRuntime(
  state: MixinRuntimeState | undefined,
  binding?: MixinRuntimeBinding,
  options?: { reclaimed?: boolean },
) {
  if (!state) return
  let previousNode = state.binding?.node
  let nextBinding = binding
  state.binding = nextBinding
  if (!nextBinding?.node || previousNode === nextBinding.node) return
  let nextNode = nextBinding.node
  for (let entry of state.runners) {
    dispatchMixinInsert(
      entry.handle,
      nextNode,
      options?.reclaimed === true,
      nextBinding.parent,
      nextBinding.key,
    )
  }
}

export function prepareMixinRemoval(state?: MixinRuntimeState) {
  if (!state || state.removePrepared) return state?.pendingRemoval?.done
  state.removePrepared = true

  let pendingRemoval: MixinRuntimeState['pendingRemoval']
  let registerPersistNode = (teardown: (signal: AbortSignal) => void | Promise<void>) => {
    if (pendingRemoval) return
    let controller = new AbortController()
    let done = Promise.resolve().then(() => teardown(controller.signal))
    pendingRemoval = {
      signal: controller.signal,
      cancel(reason) {
        controller.abort(reason)
      },
      done,
    }
  }

  for (let entry of state.runners) {
    dispatchMixinRemove(entry.handle, registerPersistNode)
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
  implements AnyMixinHandle
{
  id: string
  frame: FrameHandle
  element: MixinElement<Element, ElementProps>
  #options: MixinHandleFactoryOptions
  #phaseListenerCounts: Record<'beforeUpdate' | 'commit', number> = {
    beforeUpdate: 0,
    commit: 0,
  }
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

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(
      type as keyof MixinHandleEventMap<Element>,
      listener as EventListener,
      options,
    )
    if (!listener || !isSchedulerPhaseType(type)) return
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
    super.removeEventListener(
      type as keyof MixinHandleEventMap<Element>,
      listener as EventListener,
      typeof options === 'boolean' ? { capture: options } : options,
    )
    if (!listener || !isSchedulerPhaseType(type)) return
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

  on<target extends EventTarget>(target: target, listeners: EventListeners<target>): void {
    let container = createContainer(target, { signal: this.#options.getSignal() })
    container.set(listeners)
  }

  #dispatchSchedulerPhaseToHandle(type: 'beforeUpdate' | 'commit', event: SchedulerPhaseEvent) {
    let binding = this.#options.getBinding()
    if (!binding) return
    if (!isBindingInUpdateScope(binding, event.parents)) return
    let updateEvent = new Event(type) as MixinUpdateEvent<Element>
    updateEvent.node = binding.node
    this.dispatchEvent(updateEvent)
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
  handle: AnyMixinHandle,
  node: Element,
  reclaimed: boolean,
  parent: ParentNode,
  key?: string,
) {
  let event = new Event('insert') as MixinInsertEvent<Element>
  event.node = node
  event.reclaimed = reclaimed
  event.parent = parent
  event.key = key
  handle.dispatchEvent(event)
}

function dispatchMixinRemove(
  handle: AnyMixinHandle,
  persistNode: (teardown: (signal: AbortSignal) => void | Promise<void>) => void,
) {
  let event = new Event('remove') as MixinRemoveEvent
  event.persistNode = persistNode
  handle.dispatchEvent(event)
}

function dispatchMixinUpdateEvent(
  state: MixinRuntimeState | undefined,
  type: 'beforeUpdate' | 'commit',
) {
  let node = state?.binding?.node
  if (!node) return
  let runners = state?.runners
  if (!runners?.length) return
  for (let entry of runners) {
    let event = new Event(type) as MixinUpdateEvent<Element>
    event.node = node
    entry.handle.dispatchEvent(event)
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
  let composed = { ...previous, ...next }
  let previousConnect = previous.connect
  let nextConnect = next.connect
  let previousClassName = readClassName(previous)
  let nextClassName = readClassName(next)

  if (
    typeof previousConnect === 'function' &&
    typeof nextConnect === 'function' &&
    previousConnect !== nextConnect
  ) {
    composed.connect = (node: Element, signal: AbortSignal) => {
      nextConnect(node, signal)
      previousConnect(node, signal)
    }
  }

  if (previousClassName || nextClassName) {
    composed.className = joinClassNames(nextClassName, previousClassName)
    if ('class' in composed) {
      delete (composed as { class?: unknown }).class
    }
  }

  return composed
}

function readClassName(props: ElementProps): string {
  let className = typeof props.className === 'string' ? props.className : ''
  let classAttr =
    'class' in (props as object) && typeof (props as { class?: unknown }).class === 'string'
      ? ((props as { class?: string }).class ?? '')
      : ''
  return joinClassNames(className, classAttr)
}

function joinClassNames(...values: string[]): string {
  let seen = new Set<string>()
  let parts: string[] = []
  for (let value of values) {
    if (!value) continue
    for (let token of value.split(/\s+/)) {
      if (!token || seen.has(token)) continue
      seen.add(token)
      parts.push(token)
    }
  }
  return parts.join(' ')
}

function isRemixElement(value: unknown): value is RemixElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}

function isMixinElement(value: unknown): value is MixinElement<Element, ElementProps> {
  if (typeof value !== 'function') return false
  return '__rmxMixinElementType' in value
}
