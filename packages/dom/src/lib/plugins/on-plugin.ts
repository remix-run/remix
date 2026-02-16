import { createContainer } from '@remix-run/interaction'
import { definePlugin } from '@remix-run/reconciler'
import type { Dispatched, EventListeners, EventsContainer } from '@remix-run/interaction'

export type DispatchedEvent<event extends Event, node extends EventTarget> = Dispatched<event, node>
export type OnValue<node extends EventTarget> = EventListeners<node>

export const onPlugin = definePlugin<Element>(() => (host) => {
  let container: null | EventsContainer<Element> = null
  let listeners: null | OnValue<Element> = null

  return (input) => {
    let value = input.props.on
    listeners = isListeners(value) ? value : null
    delete input.props.on

    if (listeners || container) {
      host.queueTask((node) => {
        if (!container) {
          container = createContainer(node)
          host.addEventListener('remove', container.dispose, { once: true })
        }
        container.set(listeners ?? {})
      })
    }

    return input
  }
})

function isListeners(value: unknown): value is OnValue<Element> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
