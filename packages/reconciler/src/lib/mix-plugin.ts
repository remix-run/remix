import { TypedEventTarget } from '@remix-run/typed-event-target'
import { definePlugin } from './types.ts'
import type { Plugin } from './types.ts'
import type { PluginCommitEvent } from './types.ts'
import type { PluginDetachEvent } from './types.ts'
import type { PluginSetupHandle } from './types.ts'
import { ReconcilerErrorEvent } from './types.ts'
import type { HostTask, ReconcilerElement, ReconcilerRoot, RenderValue } from './types.ts'

export type MixinType<
  node = unknown,
  args extends unknown[] = unknown[],
  elementType extends string = string,
> = (
  handle: MixinHandle<node, elementType>,
  type: elementType,
) => (...args: [...args, currentProps: Record<string, unknown>]) => void | null | ReconcilerElement

type MixinRuntimeType<args extends unknown[] = unknown[], elementType extends string = string> = (
  handle: MixinHandle<unknown, elementType>,
  type: elementType,
) => (...args: [...args, currentProps: Record<string, unknown>]) => void | null | ReconcilerElement

export type MixinDescriptor<
  node = unknown,
  args extends unknown[] = unknown[],
  elementType extends string = string,
> = {
  type: MixinRuntimeType<args, elementType>
  args: args
  readonly __node?: node
}

export type MixValue<node = unknown, elementType extends string = string> = ReadonlyArray<
  MixinDescriptor<node, any, elementType>
>

type MixinHandleEventMap = {
  detach: MixinDetachEvent
  remove: Event
}

export type MixinHandle<node = unknown, elementType extends string = string> = TypedEventTarget<
  MixinHandleEventMap
> & {
  root: ReconcilerRoot<RenderValue>
  element: MixinElement<elementType>
  update(): Promise<AbortSignal>
  queueTask(task: HostTask<node>): void
}

export type MixinElement<elementType extends string = string> = ((
  handle: { update(): Promise<AbortSignal> },
  setup: unknown,
) => (props: Record<string, unknown>) => ReconcilerElement) & {
  __rmxMixinElementType: elementType
}

type AnyMixinType = MixinRuntimeType<unknown[]>
type AnyMixinDescriptor = MixinDescriptor<unknown, unknown[]>
type AnyMixinRunner = (
  ...args: [...unknown[], currentProps: Record<string, unknown>]
) => void | null | ReconcilerElement
type RunnerEntry = {
  type: AnyMixinType
  runner: AnyMixinRunner
  handle: MixinHandle<unknown>
}

export class MixinDetachEvent extends Event {
  #event: PluginDetachEvent<unknown>

  constructor(event: PluginDetachEvent<unknown>) {
    super('detach')
    this.#event = event
  }

  retain() {
    this.#event.retain()
  }

  waitUntil(promise: Promise<unknown>) {
    this.#event.waitUntil(promise)
  }
}

export function createMixin<
  args extends unknown[],
  node = unknown,
  elementType extends string = string,
>(type: MixinType<node, args, elementType>) {
  return (...args: args): MixinDescriptor<node, args, elementType> => ({
    type: type as unknown as MixinRuntimeType<args, elementType>,
    args,
  })
}

export let mixPlugin: Plugin<unknown> = definePlugin({
  phase: 'special',
  priority: 0,
  keys: ['mix'],
  shouldActivate(context) {
    return resolveMixDescriptors(context.delta.nextProps).length > 0
  },
  setup(handle) {
    let hostType = handle.host.type
    let runnerEntries: RunnerEntry[] = []
    return {
      detach(event) {
        for (let index = 0; index < runnerEntries.length; index++) {
          let entry = runnerEntries[index]
          let detachEvent = new MixinDetachEvent(event as PluginDetachEvent<unknown>)
          entry?.handle.dispatchEvent(detachEvent)
        }
      },
      remove() {
        for (let index = 0; index < runnerEntries.length; index++) {
          let entry = runnerEntries[index]
          entry?.handle.dispatchEvent(new Event('remove'))
        }
        runnerEntries.length = 0
      },
      commit(event) {
        let context = event as PluginCommitEvent<unknown>
        let descriptors = resolveMixDescriptors(context.delta.nextProps)
        let composedProps = withoutMix(context.delta.nextProps)
        let maxDescriptors = 1024
        for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
          let descriptor = descriptors[index]
          let entry = runnerEntries[index]
          if (!entry || entry.type !== descriptor.type) {
            entry?.handle.dispatchEvent(new Event('remove'))
            let entryHandle = createMixinHandle(handle)
            entry = {
              type: descriptor.type,
              runner: descriptor.type(entryHandle, hostType) as AnyMixinRunner,
              handle: entryHandle,
            }
            runnerEntries[index] = entry
          }
          let runner = entry.runner
          if (!runner) continue
          let result = runner(...descriptor.args, composedProps)
          if (!result) continue
          if (!isReconcilerElement(result)) {
            handle.root.dispatchEvent(
              new ReconcilerErrorEvent(new Error('mixins must return a reconciler element')),
            )
            continue
          }
          let resultType =
            typeof result.type === 'string'
              ? result.type
              : isMixinElement(result.type)
                ? result.type.__rmxMixinElementType
                : null
          if (resultType == null || resultType !== hostType) {
            handle.root.dispatchEvent(
              new ReconcilerErrorEvent(
                new Error('mixins must return an element with the same host type'),
              ),
            )
            continue
          }
          if (result.type !== resultType) {
            result = {
              ...result,
              type: resultType,
            }
          }
          let nestedDescriptors = resolveMixDescriptors(result.props)
          for (let nested of nestedDescriptors) descriptors.push(nested)
          composedProps = withoutMix(result.props)
        }
        for (let index = descriptors.length; index < runnerEntries.length; index++) {
          let entry = runnerEntries[index]
          entry?.handle.dispatchEvent(new Event('remove'))
        }
        if (runnerEntries.length > descriptors.length) {
          runnerEntries.length = descriptors.length
        }
        let nextMix = context.delta.nextProps.mix
        context.replaceProps({
          ...composedProps,
          ...(nextMix === undefined ? {} : { mix: nextMix }),
        })
        context.consume('mix')
      },
    }
  },
})

function createMixinHandle(handle: PluginSetupHandle<unknown>) {
  let mixinHandle = new TypedEventTarget<MixinHandleEventMap>() as MixinHandle<unknown, string>
  let element = ((_updateHandle: unknown, _setup: unknown) => (props: Record<string, unknown>) => ({
    $rmx: true as const,
    type: handle.host.type,
    key: null,
    props,
  })) as unknown as MixinElement<string>
  element.__rmxMixinElementType = handle.host.type
  mixinHandle.root = handle.root
  mixinHandle.element = element
  mixinHandle.update = () => handle.update()
  mixinHandle.queueTask = (task) => handle.queueTask(task)
  return mixinHandle
}

function normalizeMixValue(value: unknown): AnyMixinDescriptor[] {
  if (!Array.isArray(value)) return []
  let descriptors: AnyMixinDescriptor[] = []
  for (let index = 0; index < value.length; index++) {
    let entry = value[index]
    if (!isMixinDescriptor(entry)) continue
    descriptors.push(entry)
  }
  return descriptors
}

function resolveMixDescriptors(props: Record<string, unknown>) {
  let descriptors: AnyMixinDescriptor[] = []
  descriptors.push(...normalizeMixValue(props.mix))
  return descriptors
}

function isMixinDescriptor(value: unknown): value is AnyMixinDescriptor {
  if (!value || typeof value !== 'object') return false
  let entry = value as { type?: unknown; args?: unknown }
  return typeof entry.type === 'function' && Array.isArray(entry.args)
}

function isReconcilerElement(value: unknown): value is ReconcilerElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}

function isMixinElement(value: unknown): value is MixinElement<string> {
  if (typeof value !== 'function') return false
  return '__rmxMixinElementType' in value
}

function withoutMix(props: Record<string, unknown>) {
  if (!('mix' in props)) return props
  let output: Record<string, unknown> = { ...props }
  delete output.mix
  return output
}
