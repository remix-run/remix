import { createContainer } from '@remix-run/interaction'
import type { EventListeners, EventsContainer } from '@remix-run/interaction'

import { definePlugin } from '../types.ts'

export const interactions = definePlugin(() => (hostHandle) => {
  let container: null | EventsContainer<Element> = null
  let listeners: EventListeners = {}

  hostHandle.addEventListener('remove', () => {
    container?.dispose()
    container = null
  })

  return (input) => {
    listeners = input.props.on ?? {}
    delete input.props.on
    hostHandle.queueTask((node) => {
      if (!container) {
        container = createContainer(node)
      }
      container.set(listeners ?? {})
    })
    return input
  }
})
