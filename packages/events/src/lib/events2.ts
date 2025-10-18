export type RemixEventListener<E extends Event> = (
  event: E,
  signal: AbortSignal,
) => void | Promise<void>

export type DispatchedEvent<E extends Event, T extends EventTarget> = E & { currentTarget: T }

// infer event names and event types for a given target
type EventName<Target extends EventTarget> = Extract<keyof EventsFor<Target>, string>
type EventOf<Target extends EventTarget, Name extends EventName<Target>> = (EventsFor<Target> &
  Record<string, Event>)[Name]

// descriptor type forms we support
type InteractionFn = (this: Interaction<any>, ...args: any[]) => any
type DescriptorType<Target extends EventTarget> = EventName<Target> | [InteractionFn, string]

// infer event type from an interaction function's `this: Interaction<E>`
type InferInteractionEvent<I> = I extends (this: infer H, ...args: any[]) => any
  ? H extends Interaction<infer E>
    ? E
    : Event
  : Event

export type EventDescriptor<
  Target extends EventTarget,
  Type extends DescriptorType<Target> = DescriptorType<Target>,
> = {
  type: Type
  listener: Type extends string
    ? RemixEventListener<DispatchedEvent<EventOf<Target, Extract<Type, EventName<Target>>>, Target>>
    : Type extends [infer I, string]
      ? RemixEventListener<DispatchedEvent<InferInteractionEvent<I>, Target>>
      : never
  options: AddEventListenerOptions
}

type T = EventsFor<HTMLButtonElement>['click']
//   ^?

export interface EventContainer<Target extends EventTarget> {
  on<Type extends DescriptorType<Target>>(
    descriptors: EventDescriptor<Target, Type> | EventDescriptor<Target, Type>[] | undefined,
  ): void
}

export interface Interaction<E extends Event> {
  signal: AbortSignal
  target: EventTarget
  dispatchEvent(event: E): void
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
    ? RemixEventListener<DispatchedEvent<EventOf<Target, Extract<Type, EventName<Target>>>, Target>>
    : Type extends [infer I, string]
      ? RemixEventListener<DispatchedEvent<InferInteractionEvent<I>, Target>>
      : never,
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

let attachedInteractions = new WeakMap<EventTarget, Interaction<any>>()

function addEventListeners(
  target: EventTarget,
  descriptors: EventDescriptor<any, any>[],
  signal: AbortSignal,
) {
  for (let descriptor of descriptors) {
    if (Array.isArray(descriptor.type)) {
      let [interactionType, eventType] = descriptor.type

      if (!attachedInteractions.has(target)) {
        let handle: Interaction<any> = {
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

export function createBinder<I extends InteractionFn>(
  interactionType: I,
  eventType: string,
): <T extends EventTarget = EventTarget>(
  listener: RemixEventListener<DispatchedEvent<InferInteractionEvent<I>, T>>,
) => EventDescriptor<T, [I, string]> {
  return (listener) => bind([interactionType, eventType], listener)
}

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
