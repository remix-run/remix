import { createContainer } from '@remix-run/interaction'
import { definePlugin } from '@remix-run/reconciler'
import type { Dispatched, EventListeners, EventsContainer } from '@remix-run/interaction'

export type DispatchedEvent<event extends Event, node extends EventTarget> = Dispatched<event, node>
export type OnValue<node extends EventTarget> = EventListeners<node>

export const onPlugin = definePlugin<Element>(() => ({
  keys: ['on'],
  setup() {
    let container: null | EventsContainer<Element> = null

    return {
      commit(input, node) {
        let value = input.props.on
        let listeners = isListeners(value) ? value : null
        delete input.props.on

        if (!container) {
          container = createContainer(node)
        }
        container.set(listeners ?? {})
      },
      remove(_node, reason) {
        if (!container) return
        if (reason === 'deactivate') {
          container.dispose()
          container = null
          return
        }
        // Ensure listeners are torn down if host is removed.
        container.dispose()
        container = null
      },
    }
  },
}))

function isListeners(value: unknown): value is OnValue<Element> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
