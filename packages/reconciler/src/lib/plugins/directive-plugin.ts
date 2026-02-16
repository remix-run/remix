import { definePlugin } from '../types.ts'
import type { HostHandle, Plugin, PluginHandle } from '../types.ts'

export type DirectiveType<elementNode, args extends unknown[] = unknown[]> = (
  plugin: PluginHandle,
) => (host: HostHandle<elementNode>) => (...args: args) => void

export type DirectiveDescriptor<elementNode, args extends unknown[] = unknown[]> = {
  type: DirectiveType<elementNode, args>
  args: args
}

export type UseValue<elementNode> = ReadonlyArray<DirectiveDescriptor<elementNode, any[]>>

type AnyDirectiveType<elementNode> = DirectiveType<elementNode, any[]>
type AnyDirectiveDescriptor<elementNode> = DirectiveDescriptor<elementNode, any[]>
type DirectiveRunner = (...args: unknown[]) => void

export function createDirective<elementNode, args extends unknown[]>(
  type: DirectiveType<elementNode, args>,
) {
  return (...args: args): DirectiveDescriptor<elementNode, args> => ({ type, args })
}

export function usePlugin<elementNode>(): Plugin<elementNode> {
  return definePlugin<elementNode>((pluginHandle) => {
    let typeCache = new Map<AnyDirectiveType<elementNode>, (host: HostHandle<elementNode>) => DirectiveRunner>()

    return (hostHandle) => {
      let runners: DirectiveRunner[] = []
      let runnerTypes: AnyDirectiveType<elementNode>[] = []

      return (input) => {
        let descriptors = normalizeUseValue<elementNode>(input.props.use)
        if ('use' in input.props) {
          delete input.props.use
        }

        for (let index = 0; index < descriptors.length; index++) {
          let descriptor = descriptors[index]
          let currentType = runnerTypes[index]
          if (currentType !== descriptor.type) {
            let createRunner = getRunnerFactory(typeCache, descriptor.type, pluginHandle)
            runners[index] = createRunner(hostHandle)
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
}

function getRunnerFactory<elementNode>(
  cache: Map<AnyDirectiveType<elementNode>, (host: HostHandle<elementNode>) => DirectiveRunner>,
  type: AnyDirectiveType<elementNode>,
  pluginHandle: PluginHandle,
) {
  let createRunner = cache.get(type)
  if (createRunner) return createRunner
  let created = type(pluginHandle)
  cache.set(type, created)
  return created
}

function normalizeUseValue<elementNode>(value: unknown): AnyDirectiveDescriptor<elementNode>[] {
  if (!Array.isArray(value)) return []
  let descriptors: AnyDirectiveDescriptor<elementNode>[] = []
  for (let entry of value) {
    if (isDirectiveDescriptor<elementNode>(entry)) {
      descriptors.push(entry)
    }
  }
  return descriptors
}

function isDirectiveDescriptor<elementNode>(
  value: unknown,
): value is AnyDirectiveDescriptor<elementNode> {
  if (!value || typeof value !== 'object') return false
  let entry = value as { type?: unknown; args?: unknown }
  return typeof entry.type === 'function' && Array.isArray(entry.args)
}
