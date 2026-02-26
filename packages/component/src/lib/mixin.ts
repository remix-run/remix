import { createContainer, TypedEventTarget } from '@remix-run/interaction'
import type { EventListeners } from '@remix-run/interaction'
import type { FrameHandle, Task } from './component.ts'
import type { ElementProps, RemixElement } from './jsx.ts'
import type { Scheduler } from './scheduler.ts'

type RebindNode<value, baseNode, boundNode> = value extends (...args: infer fnArgs) => infer fnResult
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
  node extends EventTarget = EventTarget,
  props extends ElementProps = ElementProps,
> = props & {
  mix?: MixValue<node, props>
}

export type MixinElement<
  node extends EventTarget = EventTarget,
  props extends ElementProps = ElementProps,
> = ((
  handle: { update(): Promise<AbortSignal> },
  setup: unknown,
) => (props: MixinProps<node, props>) => RemixElement) & {
  __rmxMixinElementType: string
}

type MixinHandleEventMap = {
  remove: Event
}

export type MixinHandle<
  node extends EventTarget = EventTarget,
  props extends ElementProps = ElementProps,
> = TypedEventTarget<MixinHandleEventMap> & {
  id: string
  frame: FrameHandle
  signal: AbortSignal
  element: MixinElement<node, props>
  update(): Promise<AbortSignal>
  queueTask(task: Task): void
  on: <target extends EventTarget>(target: target, listeners: EventListeners<target>) => void
}

type MixinRuntimeType<
  args extends unknown[] = [],
  node extends EventTarget = EventTarget,
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => (...args: [...args, currentProps: props]) => void | null | RemixElement

export type MixinType<
  node extends EventTarget = EventTarget,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => (...args: [...args, currentProps: props]) => void | null | RemixElement

export type MixinDescriptor<
  node extends EventTarget = EventTarget,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = {
  type: MixinRuntimeType<args, node, props>
  args: args
  readonly __node?: (node: node) => void
}

export type MixValue<
  node extends EventTarget = EventTarget,
  props extends ElementProps = ElementProps,
> = ReadonlyArray<MixinDescriptor<node, any, props>>

type AnyMixinType = MixinRuntimeType<unknown[], EventTarget, ElementProps>
type AnyMixinDescriptor = MixinDescriptor<EventTarget, unknown[], ElementProps>
type AnyMixinRunner = (
  ...args: [...unknown[], currentProps: ElementProps]
) => void | null | RemixElement
type AnyMixinHandle = MixinHandle<EventTarget, ElementProps>

type RunnerEntry = {
  type: AnyMixinType
  runner: AnyMixinRunner
  handle: AnyMixinHandle
}

export type MixinRuntimeBinding = {
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
  controller: AbortController
  runners: RunnerEntry[]
  binding?: MixinRuntimeBinding
}

let mixinHandleId = 0

export function createMixin<
  node extends EventTarget = EventTarget,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
>(type: MixinType<node, args, props>) {
  return <boundNode extends node = node>(
    ...args: RebindTuple<args, node, boundNode>
  ): MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props> => ({
    type: type as unknown as MixinRuntimeType<
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
  let scheduler = input.scheduler
  let descriptors = resolveMixDescriptors(input.props)
  let composedProps = withoutMix(input.props)
  let maxDescriptors = 1024

  for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
    let descriptor = descriptors[index]
    let entry = state.runners[index]
    if (!entry || entry.type !== descriptor.type) {
      if (entry) {
        entry.handle.dispatchEvent(new Event('remove'))
      }
      let handle = createMixinHandle({
        id: state.id,
        hostType,
        frame: input.frame,
        scheduler,
        controller: state.controller,
        getBinding: () => state.binding,
      })
      entry = {
        type: descriptor.type as AnyMixinType,
        runner: descriptor.type(handle, hostType) as AnyMixinRunner,
        handle,
      }
      state.runners[index] = entry
    }

    let result = entry.runner(...descriptor.args, composedProps)
    if (!result) continue

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
    composedProps = withoutMix(result.props as ElementProps)
  }

  for (let index = descriptors.length; index < state.runners.length; index++) {
    let entry = state.runners[index]
    entry?.handle.dispatchEvent(new Event('remove'))
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
  for (let entry of state.runners) {
    entry.handle.dispatchEvent(new Event('remove'))
  }
  state.runners.length = 0
  state.controller.abort()
}

export function bindMixinRuntime(state: MixinRuntimeState | undefined, binding?: MixinRuntimeBinding) {
  if (!state) return
  state.binding = binding
}

function createMixinRuntimeState(): MixinRuntimeState {
  return {
    id: `m${++mixinHandleId}`,
    controller: new AbortController(),
    runners: [],
  }
}

function createMixinHandle(options: {
  id: string
  hostType: string
  frame: FrameHandle
  scheduler: Scheduler
  controller: AbortController
  getBinding: () => MixinRuntimeBinding | undefined
}): AnyMixinHandle {
  let handle = new TypedEventTarget<MixinHandleEventMap>() as AnyMixinHandle
  let element = ((_: { update(): Promise<AbortSignal> }, __: unknown) => (props: ElementProps) => ({
    $rmx: true as const,
    type: options.hostType,
    key: null,
    props,
  })) as unknown as MixinElement<EventTarget, ElementProps>

  element.__rmxMixinElementType = options.hostType
  handle.id = options.id
  handle.frame = options.frame
  handle.signal = options.controller.signal
  handle.element = element
  handle.update = () =>
    new Promise((resolve) => {
      if (options.controller.signal.aborted) {
        resolve(options.controller.signal)
        return
      }
      let binding = options.getBinding()
      if (!binding) {
        resolve(options.controller.signal)
        return
      }
      binding.enqueueUpdate(resolve)
    })
  handle.queueTask = (task) => {
    options.scheduler.enqueueTasks([() => task(options.controller.signal)])
  }
  handle.on = <target extends EventTarget>(target: target, listeners: EventListeners<target>) => {
    let container = createContainer(target, { signal: options.controller.signal })
    container.set(listeners)
  }
  return handle
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

function isRemixElement(value: unknown): value is RemixElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}

function isMixinElement(value: unknown): value is MixinElement<EventTarget, ElementProps> {
  if (typeof value !== 'function') return false
  return '__rmxMixinElementType' in value
}
