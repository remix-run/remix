import { definePlugin } from './types.ts'
import type { Plugin } from './types.ts'

export type MixinType<node extends EventTarget = EventTarget, args extends unknown[] = unknown[]> = () => (
  node: node,
  signal: AbortSignal,
) => (...args: [...args, currentProps: Record<string, unknown>]) => void | null | Record<string, unknown>

export type MixinDescriptor<
  node extends EventTarget = EventTarget,
  args extends unknown[] = unknown[],
> = {
  type: MixinType<node, args>
  args: args
}

export type MixValue<node extends EventTarget = EventTarget> = ReadonlyArray<
  MixinDescriptor<node, any>
>

type AnyMixinType = MixinType<EventTarget, unknown[]>
type AnyMixinDescriptor = MixinDescriptor<EventTarget, unknown[]>
type AnyMixinRunner = (
  ...args: [...unknown[], currentProps: Record<string, unknown>]
) => void | null | Record<string, unknown>
type RunnerEntry = {
  type: AnyMixinType
  runner: AnyMixinRunner
  controller: AbortController
}

export function createMixin<args extends unknown[], node extends EventTarget = EventTarget>(
  type: MixinType<node, args>,
) {
  return (...args: args): MixinDescriptor<node, args> => ({ type, args })
}

export let mixPlugin: Plugin<any, EventTarget, EventTarget, EventTarget> = definePlugin({
  phase: 'special',
  priority: 0,
  routing: { keys: ['mix'] },
  shouldActivate(context) {
    return resolveMixDescriptors(context.delta.nextProps).length > 0
  },
  mount() {
    let controller = new AbortController()
    return {
      controller,
      runnerEntries: [] as RunnerEntry[],
    }
  },
  apply(context, slot) {
    let state = slot as {
      controller: AbortController
      runnerEntries: RunnerEntry[]
    }
    let node = context.host.node
    let descriptors = resolveMixDescriptors(context.delta.nextProps)
    let mergedProps: null | Record<string, unknown> = null
    let maxDescriptors = 1024
    for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
      let descriptor = descriptors[index]
      let entry = state.runnerEntries[index]
      if (!entry || entry.type !== descriptor.type) {
        entry?.controller.abort()
        let createRunner = getMixinRunnerFactory(descriptor.type)
        let controller = new AbortController()
        state.controller.signal.addEventListener('abort', () => {
          controller.abort()
        })
        entry = {
          type: descriptor.type,
          runner: createRunner(node, controller.signal),
          controller,
        }
        state.runnerEntries[index] = entry
      }
      let runner = entry.runner
      if (!runner) continue
      let result = runner(...descriptor.args, context.delta.nextProps)
      if (!result || typeof result !== 'object') continue
      let nestedDescriptors = resolveMixDescriptors(result as Record<string, unknown>)
      for (let nested of nestedDescriptors) descriptors.push(nested)
      if (!mergedProps) mergedProps = {}
      for (let key in result) {
        if (key === 'mix') continue
        mergedProps[key] = result[key]
      }
    }
    for (let index = descriptors.length; index < state.runnerEntries.length; index++) {
      let entry = state.runnerEntries[index]
      entry?.controller.abort()
    }
    if (state.runnerEntries.length > descriptors.length) {
      state.runnerEntries.length = descriptors.length
    }
    if (mergedProps) context.mergeProps(mergedProps)
    context.consume('mix')
  },
  unmount(_context, slot) {
    let state = slot as {
      controller: AbortController
      runnerEntries: RunnerEntry[]
    }
    for (let index = 0; index < state.runnerEntries.length; index++) {
      let entry = state.runnerEntries[index]
      entry?.controller.abort()
    }
    state.runnerEntries.length = 0
    state.controller.abort()
  },
})

let mixinRunnerFactoryCache = new Map<
  AnyMixinType,
  (node: EventTarget, signal: AbortSignal) => AnyMixinRunner
>()

function getMixinRunnerFactory(type: AnyMixinType) {
  let cached = mixinRunnerFactoryCache.get(type)
  if (cached) return cached
  let next = type()
  mixinRunnerFactoryCache.set(type, next)
  return next
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
