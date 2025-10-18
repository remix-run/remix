export type RemixEventListener<E extends Event = Event> = (
  event: E,
  signal: AbortSignal,
) => void | Promise<void>

export type EventDescriptor<E extends Event = Event> = {
  type: string | [Function, string]
  listener: RemixEventListener<E>
  options: AddEventListenerOptions
}

export interface EventContainer {
  on(descriptors: EventDescriptor | EventDescriptor[] | undefined): void
}

export interface Interaction<E extends Event = Event> {
  signal: AbortSignal
  target: EventTarget
  dispatchEvent(event: E): void
}

type EventsFor<T extends EventTarget> = T extends HTMLElement
  ? HTMLElementEventMap
  : Record<string, Event>

export function bind<
  Target extends EventTarget,
  EventStringType extends keyof EventsFor<Target> & string,
  EventType extends EventsFor<Target>[EventStringType] & Event,
>(
  type: EventStringType | [Function, EventStringType],
  listener: RemixEventListener<Omit<EventType, 'currentTarget'> & { currentTarget: Target }>,
  options: AddEventListenerOptions = {},
): EventDescriptor<Omit<EventType, 'currentTarget'> & { currentTarget: Target }> {
  return { type, listener, options }
}

export function events(target: EventTarget, signal?: AbortSignal): EventContainer {
  signal = signal ?? new AbortController().signal

  return {
    on: (descriptors) => {
      if (!descriptors) descriptors = []
      if (!Array.isArray(descriptors)) descriptors = [descriptors]
      addEventListeners(target, descriptors, signal)
    },
  }
}

events(document.createElement('button')).on(bind('click', (event) => {}))

let attachedInteractions = new WeakMap<EventTarget, Interaction>()

function addEventListeners(
  target: EventTarget,
  descriptors: EventDescriptor[],
  signal: AbortSignal,
) {
  for (let descriptor of descriptors) {
    if (Array.isArray(descriptor.type)) {
      let [interactionType, eventType] = descriptor.type

      if (!attachedInteractions.has(target)) {
        let handle: Interaction = {
          target,
          signal,
          dispatchEvent: (event) => {
            target.dispatchEvent(event)
          },
        }

        let childDescriptors = interactionType.call(handle)
        addEventListeners(target, childDescriptors, signal)
        attachedInteractions.set(target, handle)
      }

      let interactionDescriptor = { ...descriptor, type: eventType }
      addEventListeners(target, [interactionDescriptor], signal)
      continue
    }

    let options = { signal, ...descriptor.options }
    let listener = withSignal(descriptor.listener, signal)
    target.addEventListener(descriptor.type, listener, options)
  }
}

export function createBinder(
  interactionType: Function,
  eventType: string,
): (listener: RemixEventListener) => EventDescriptor {
  return (listener) => bind([interactionType, eventType], listener)
}

// export type InferEventType<E extends Event> = E extends { type: infer Type } ? Type : never
// export function createBinder<
//   I extends (this: Interaction<any>) => EventDescriptor[],
//   T extends EventTarget = EventTarget,
// >(
//   interactionType: I,
//   eventType: InferEventType<ThisParameterType<I> extends Interaction<infer E> ? E : Event>,
// ): (listener: EventListenerWithSignal<Event, T>) => EventDescriptor<Event, T> {
//   return (listener: EventListenerWithSignal<Event, T>) =>
//     bind([interactionType, eventType], listener)
// }

function withSignal(listener: RemixEventListener, containerSignal: AbortSignal): EventListener {
  let controller = new AbortController()

  containerSignal.addEventListener('abort', () => controller.abort(), { once: true })

  return (event) => {
    controller.abort(new DOMException('', 'EventReentry'))
    controller = new AbortController()
    listener(event, controller.signal)
  }
}
