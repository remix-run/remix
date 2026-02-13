import { createContainer } from '@remix-run/interaction'
import type { EventListeners, EventsContainer } from '@remix-run/interaction'

import { definePlugin } from '../types.ts'

export const interactions = definePlugin(() => (hostHandle) => {
  let container: EventsContainer<Element>
  let listeners: EventListeners = {}

  hostHandle.addEventListener('afterFlush', (event) => {
    if (!container) {
      container = createContainer(event.node)
    }
    container.set(listeners ?? {})
  })

  hostHandle.addEventListener('remove', () => {
    container.dispose()
  })

  return (input) => {
    listeners = input.props.on ?? {}
    delete input.props.on
    return input
  }
})
