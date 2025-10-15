import type { EventHandler, EventDescriptor } from './events.ts'

export function createEventType<Detail = null>(eventName: string) {
  let binder = <ECurrentTarget extends EventTarget = EventTarget>(
    handler: EventHandler<CustomEvent<Detail>, ECurrentTarget>,
    options?: AddEventListenerOptions,
  ): EventDescriptor<ECurrentTarget> => {
    return {
      type: eventName,
      handler: handler as EventHandler<any, ECurrentTarget>,
      options,
    }
  }

  let createEvent = (
    ...args: null extends Detail
      ? [init?: CustomEventInit<Detail>]
      : [init: CustomEventInit<Detail> & { detail: Detail }]
  ): CustomEvent<Detail> => {
    let init = args[0]
    return new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      ...init,
    })
  }

  return [binder, createEvent] as const
}
