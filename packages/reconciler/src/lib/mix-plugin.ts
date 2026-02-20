import { definePlugin } from './types.ts'
import type { Plugin } from './types.ts'
import type { PluginCommitEvent } from './types.ts'
import type { PluginSetupHandle } from './types.ts'

export type MixinType<node extends EventTarget = EventTarget, args extends unknown[] = unknown[]> = () => (
  handle: PluginSetupHandle<node>,
  node: node,
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
  handle: PluginSetupHandle<EventTarget>
}

export function createMixin<args extends unknown[], node extends EventTarget = EventTarget>(
  type: MixinType<node, args>,
) {
  return (...args: args): MixinDescriptor<node, args> => ({ type, args })
}

export let mixPlugin: Plugin<EventTarget> = definePlugin({
  phase: 'special',
  priority: 0,
  keys: ['mix'],
  shouldActivate(context) {
    return resolveMixDescriptors(context.delta.nextProps).length > 0
  },
  setup(handle) {
    let node = handle.host.node
    let runnerEntries: RunnerEntry[] = []

    handle.addEventListener('remove', () => {
      for (let index = 0; index < runnerEntries.length; index++) {
        let entry = runnerEntries[index]
        entry?.handle.dispatchEvent(new Event('remove'))
      }
      runnerEntries.length = 0
    })

    handle.addEventListener('commit', (event) => {
      let context = event as PluginCommitEvent<EventTarget>
      let descriptors = resolveMixDescriptors(context.delta.nextProps)
      let mergedProps: null | Record<string, unknown> = null
      let maxDescriptors = 1024
      for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
        let descriptor = descriptors[index]
        let entry = runnerEntries[index]
        if (!entry || entry.type !== descriptor.type) {
          entry?.handle.dispatchEvent(new Event('remove'))
          let createRunner = getMixinRunnerFactory(descriptor.type)
          let entryHandle = new EventTarget() as PluginSetupHandle<EventTarget>
          entryHandle.root = handle.root
          entryHandle.host = handle.host
          entry = {
            type: descriptor.type,
            runner: createRunner(entryHandle, node),
            handle: entryHandle,
          }
          runnerEntries[index] = entry
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
      for (let index = descriptors.length; index < runnerEntries.length; index++) {
        let entry = runnerEntries[index]
        entry?.handle.dispatchEvent(new Event('remove'))
      }
      if (runnerEntries.length > descriptors.length) {
        runnerEntries.length = descriptors.length
      }
      if (mergedProps) context.mergeProps(mergedProps)
      context.consume('mix')
    })
  },
})

let mixinRunnerFactoryCache = new Map<
  AnyMixinType,
  (handle: PluginSetupHandle<EventTarget>, node: EventTarget) => AnyMixinRunner
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
