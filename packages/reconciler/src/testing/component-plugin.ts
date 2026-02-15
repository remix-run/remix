import { definePlugin } from '../lib/types.ts'
import type { Plugin, UpdateHandle } from '../lib/types.ts'

export type ComponentType<props extends Record<string, unknown> = Record<string, unknown>> = (
  handle: UpdateHandle,
) => (props: props) => unknown

export function componentPlugin<elementNode>(): Plugin<elementNode> {
  type ComponentFactory = ComponentType<Record<string, unknown>>

  return definePlugin(() => (hostHandle) => {
    let currentType: null | unknown = null
    let render: null | ((props: Record<string, unknown>) => unknown) = null
    let handle: UpdateHandle = {
      update: hostHandle.update,
      queueTask(task) {
        hostHandle.queueTask((_node, signal) => task(signal))
      },
      get signal() {
        return hostHandle.signal
      },
    }

    return (input) => {
      if (typeof input.type !== 'function') return input
      if (!render || currentType !== input.type) {
        let setup = (input.type as ComponentFactory)(handle)
        if (typeof setup !== 'function') {
          throw new Error('component factory must return a render function')
        }
        currentType = input.type
        render = setup
      }

      let next = render(input.props)
      if (!isElementRecord(next)) {
        throw new Error('component render must return a JSX element')
      }

      return {
        type: next.type,
        props: next.props,
      }
    }
  })
}

function isElementRecord(value: unknown): value is { type: unknown; props: Record<string, unknown> } {
  if (!value || typeof value !== 'object') return false
  let record = value as { $rmx?: unknown; type?: unknown; props?: unknown }
  if (record.$rmx !== true) return false
  return 'type' in record && !!record.props && typeof record.props === 'object'
}
