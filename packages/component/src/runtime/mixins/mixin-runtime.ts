import type { FrameHandle } from '../component.ts'
import { TypedEventTarget } from '../component.ts'
import type { ElementProps } from '../core/vnode.ts'
import { isRemixElement, jsx } from '../core/vnode.ts'
import type { Key } from '../key.ts'
import type { Scheduler, SchedulerPhaseEvent } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import { isMixinDescriptor } from './mixin.ts'
import type {
  MixinType,
  MixinDescriptor,
  MixinHandle,
  MixinHandleEventMap,
  MixinContext,
  MixinElement,
  MixinReturn,
  MixDescriptor,
} from './mixin.ts'

type AnyMixinType = MixinType<Element, unknown[], ElementProps>
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

function isMixinElementFunction(
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
