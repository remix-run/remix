export type RemixEventListener<E extends Event> = (
  event: E,
  signal: AbortSignal,
) => void | Promise<void>

// infer event names and event types for a given target
type EventName<Target extends EventTarget> = Extract<keyof EventsFor<Target>, string>
type EventOf<Target extends EventTarget, Name extends EventName<Target>> = (EventsFor<Target> &
  Record<string, Event>)[Name]

// descriptor type forms we support
type DescriptorType<Target extends EventTarget> = EventName<Target> | [Function, string]

export type EventDescriptor<
  Target extends EventTarget,
  Type extends DescriptorType<Target> = DescriptorType<Target>,
> = {
  type: Type
  listener: Type extends string
    ? RemixEventListener<EventOf<Target, Extract<Type, EventName<Target>>>>
    : RemixEventListener<Event>
  options: AddEventListenerOptions
}

type T = EventsFor<HTMLButtonElement>['click']
//   ^?

export interface EventContainer<Target extends EventTarget> {
  on<Type extends DescriptorType<Target>>(
    descriptors: EventDescriptor<Target, Type> | EventDescriptor<Target, Type>[] | undefined,
  ): void
}

export interface Interaction {
  signal: AbortSignal
  target: EventTarget
  dispatchEvent(event: Event): void
}

// prettier-ignore
export type EventsFor<T extends EventTarget> = 
  [T] extends [HTMLElement] ? HTMLElementEventMap :
  [T] extends [Element] ? ElementEventMap :
  [T] extends [Window] ? WindowEventMap :
  [T] extends [Document] ? DocumentEventMap :
  [T] extends [Worker] ? WorkerEventMap :
  [T] extends [ServiceWorker] ? ServiceWorkerEventMap :
  [T] extends [WebSocket] ? WebSocketEventMap :
  [T] extends [MessagePort] ? MessagePortEventMap :
  GlobalEventHandlersEventMap & Record<string, Event>

export function bind<
  Target extends EventTarget = EventTarget,
  Type extends DescriptorType<Target> = DescriptorType<Target>,
>(
  type: Type,
  listener: Type extends string
    ? RemixEventListener<EventOf<Target, Extract<Type, EventName<Target>>>>
    : RemixEventListener<Event>,
  options: AddEventListenerOptions = {},
): EventDescriptor<Target, Type> {
  return { type, listener, options }
}

export function events<Target extends EventTarget>(
  target: Target,
  signal?: AbortSignal,
): EventContainer<Target> {
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
  descriptors: EventDescriptor<any, any>[],
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
): (listener: RemixEventListener<Event>) => EventDescriptor<EventTarget, [Function, string]> {
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

function withSignal(
  listener: RemixEventListener<any>,
  containerSignal: AbortSignal,
): EventListener {
  let controller = new AbortController()

  containerSignal.addEventListener('abort', () => controller.abort(), { once: true })

  return (event) => {
    controller.abort(new DOMException('', 'EventReentry'))
    controller = new AbortController()
    listener(event, controller.signal)
  }
}
