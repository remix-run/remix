import { createContainer } from '@remix-run/interaction'
import type { EventsContainer } from '@remix-run/interaction'

import { definePlugin } from '../types.ts'

export const interactions = definePlugin(() => (host) => {
  let container: EventsContainer<Element>

  return (input) => {
    let listeners = input.props.on
    delete input.props.on

    if (listeners) {
      host.queueTask((node) => {
        if (!container) {
          container = createContainer(node)
          host.addEventListener('remove', container.dispose)
        }
        container.set(listeners ?? {})
      })
    } else if (container) {
      container.set({})
    }

    return input
  }
})
