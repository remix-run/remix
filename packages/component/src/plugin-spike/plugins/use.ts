import { definePlugin } from '../types.ts'
import type { HostHandle, PluginHandle } from '../types.ts'

export type DirectiveType<args extends any[] = any[]> = (
  plugin: PluginHandle,
) => (host: HostHandle) => (...args: args) => void

export type DirectiveDescriptor<
  target extends EventTarget = EventTarget,
  args extends any[] = any[],
> = {
  type: DirectiveType<args>
  args: args
  __target?: target
}

export type UseValue<target extends EventTarget = EventTarget> = ReadonlyArray<
  DirectiveDescriptor<target, any[]>
>

type AnyDirectiveType = DirectiveType<any[]>
type AnyDirectiveDescriptor = DirectiveDescriptor<EventTarget, any[]>
type DirectiveRunner = (...args: unknown[]) => void

declare module '../../lib/dom.ts' {
  interface HostProps<eventTarget extends EventTarget> {
    use?: UseValue<eventTarget>
  }
}

export function createDirective<args extends any[]>(type: DirectiveType<args>) {
  return <target extends EventTarget = EventTarget>(
    ...args: args
  ): DirectiveDescriptor<target, args> => ({ type, args })
}

export const use = definePlugin((plugin) => {
  let typeCache = new Map<AnyDirectiveType, (host: HostHandle) => DirectiveRunner>()

  return (host) => {
    let runners: DirectiveRunner[] = []
    let runnerTypes: AnyDirectiveType[] = []

    return (input) => {
      let descriptors = normalizeUseValue(input.props.use)
      if ('use' in input.props) {
        delete input.props.use
      }

      for (let index = 0; index < descriptors.length; index++) {
        let descriptor = descriptors[index]
        let currentType = runnerTypes[index]
        if (currentType !== descriptor.type) {
          let createRunner = getRunnerFactory(typeCache, descriptor.type, plugin)
          runners[index] = createRunner(host)
          runnerTypes[index] = descriptor.type
        }

        let runner = runners[index]
        if (runner) {
          runner(...descriptor.args)
        }
      }

      for (let index = descriptors.length; index < runners.length; index++) {
        let runner = runners[index]
        if (runner) {
          runner()
        }
      }

      if (runners.length > descriptors.length) {
        runners.length = descriptors.length
      }
      if (runnerTypes.length > descriptors.length) {
        runnerTypes.length = descriptors.length
      }

      return input
    }
  }
})

function getRunnerFactory(
  cache: Map<AnyDirectiveType, (host: HostHandle) => DirectiveRunner>,
  type: AnyDirectiveType,
  plugin: PluginHandle,
) {
  let createRunner = cache.get(type)
  if (createRunner) return createRunner
  let created = type(plugin)
  cache.set(type, created)
  return created
}

function normalizeUseValue(value: unknown): AnyDirectiveDescriptor[] {
  if (!Array.isArray(value)) return []
  let descriptors: AnyDirectiveDescriptor[] = []
  for (let entry of value) {
    if (isDirectiveDescriptor(entry)) {
      descriptors.push(entry)
    }
  }
  return descriptors
}

function isDirectiveDescriptor(value: unknown): value is AnyDirectiveDescriptor {
  if (!value || typeof value !== 'object') return false
  let entry = value as { type?: unknown; args?: unknown }
  return typeof entry.type === 'function' && Array.isArray(entry.args)
}
