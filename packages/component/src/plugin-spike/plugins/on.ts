import { createContainer } from '@remix-run/interaction'
import type { EventsContainer } from '@remix-run/interaction'
import type { EventListeners } from '@remix-run/interaction'

import { createDirective } from './use.ts'
import type { DirectiveDescriptor } from './use.ts'

type EventType<target extends EventTarget> = Extract<keyof EventListeners<target>, string>

type ListenerValue<target extends EventTarget, type extends EventType<target>> = NonNullable<
  EventListeners<target>[type]
>

type EventListenerFor<target extends EventTarget, type extends EventType<target>> =
  ListenerValue<target, type> extends Array<infer item>
    ? EventListenerFromContainerEntry<item>
    : EventListenerFromContainerEntry<ListenerValue<target, type>>

type EventListenerFromContainerEntry<entry> = entry extends { listener: infer listener }
  ? listener
  : entry extends (...args: any[]) => any
    ? entry
    : never

let onDirective = createDirective((_) => (host) => {
  let container: EventsContainer<Element>

  return (type?: string, listener?: unknown) => {
    host.queueTask((node) => {
      if (!container) {
        container = createContainer(node)
        host.addEventListener('remove', container.dispose)
      }

      if (!type || typeof listener !== 'function') {
        container.set({})
        return
      }

      container.set({
        [type]: listener as (...args: any[]) => any,
      })
    })
  }
})

export function on<target extends EventTarget, type extends EventType<target>>(
  type: type,
  listener: EventListenerFor<target, type>,
): DirectiveDescriptor<target, [type, EventListenerFor<target, type>]>
export function on(type: string, listener: (...args: any[]) => any): DirectiveDescriptor
export function on(type: string, listener: (...args: any[]) => any): DirectiveDescriptor {
  return onDirective(type, listener)
}
