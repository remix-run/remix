import { createMixin } from '@remix-run/reconciler'
import type { MixinDescriptor } from '@remix-run/reconciler'
import type { DispatchedEvent } from '../../jsx-runtime.ts'

type OnHandler<target extends EventTarget, event extends Event> = (
  event: DispatchedEvent<event, target>,
  reentrySignal: AbortSignal,
) => void

let onMixin = createMixin<
  [type: string, handler: OnHandler<EventTarget, Event>],
  EventTarget
>(() => {
  return (node, signal) => {
    let activeType = ''
    let activeHandler: null | OnHandler<EventTarget, Event> = null
    let reentryController: null | AbortController = null

    let listener: EventListener = (event) => {
      if (!activeHandler) return
      reentryController?.abort()
      reentryController = new AbortController()
      activeHandler(event as DispatchedEvent<Event, EventTarget>, reentryController.signal)
    }

    signal.addEventListener('abort', () => {
      reentryController?.abort()
      if (activeType) {
        node.removeEventListener(activeType, listener)
      }
      activeType = ''
      activeHandler = null
    })

    return (type: string, handler: OnHandler<EventTarget, Event>) => {
      if (activeType !== type) {
        if (activeType) {
          node.removeEventListener(activeType, listener)
        }
        activeType = type
        if (activeType) {
          node.addEventListener(activeType, listener)
        }
      }
      activeHandler = handler
    }
  }
})

export function on<target extends EventTarget = EventTarget, event extends Event = Event>(
  type: string,
  handler: OnHandler<target, event>,
): MixinDescriptor<target, [type: string, handler: OnHandler<target, event>]> {
  return onMixin(type, handler as unknown as OnHandler<EventTarget, Event>) as MixinDescriptor<
    target,
    [type: string, handler: OnHandler<target, event>]
  >
}
