import { definePlugin } from '../types.ts'
import type { Component, Plugin, ReconcilerElement, UpdateHandle } from '../types.ts'

export function componentPlugin<elementNode>(): Plugin<elementNode> {
  type ComponentFactory = Component<unknown, Record<string, unknown>>

  return definePlugin(() => (hostHandle) => {
    let currentType: null | unknown = null
    let render: null | ((props: Record<string, unknown>) => ReconcilerElement) = null
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
      let nextInput = splitSetupProps(input.props)
      if (!render || currentType !== input.type) {
        let nextRender = (input.type as ComponentFactory)(handle, nextInput.setup)
        if (typeof nextRender !== 'function') {
          throw new Error('component factory must return a render function')
        }
        currentType = input.type
        render = nextRender
      }

      let next = render(nextInput.props)
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

function splitSetupProps(props: Record<string, unknown>) {
  if (!('setup' in props)) {
    return {
      setup: undefined,
      props,
    }
  }
  let { setup, ...nextProps } = props
  return {
    setup,
    props: nextProps,
  }
}

function isElementRecord(value: unknown): value is { type: unknown; props: Record<string, unknown> } {
  if (!value || typeof value !== 'object') return false
  let record = value as { $rmx?: unknown; type?: unknown; props?: unknown }
  if (record.$rmx !== true) return false
  return 'type' in record && !!record.props && typeof record.props === 'object'
}
