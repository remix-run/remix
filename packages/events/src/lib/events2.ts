type EventListenerWithSignal<E extends Event> = (
  event: E,
  signal: AbortSignal,
) => void | Promise<void>

export type DispatchedEvent<E extends Event, T extends EventTarget> = E & { currentTarget: T }

// infer event names and event types for a given target
type EventName<Target extends EventTarget> = Extract<keyof EventsFor<Target>, string>
type EventOf<Target extends EventTarget, Name extends EventName<Target>> = (EventsFor<Target> &
  Record<string, Event>)[Name]

// descriptor type forms we support
type InteractionFn = (this: Interaction<any>) => unknown
type DescriptorType<Target extends EventTarget> = EventName<Target> | [InteractionFn, string]

type InferInteractionEvent<I> = I extends (this: infer H) => unknown
  ? H extends Interaction<infer E>
    ? E
    : Event
  : Event

// infer literal type union from an Event subclass's `type` property
type EventTypeOf<E extends Event> = E extends { type: infer T } ? Extract<T, string> : string

export type EventDescriptor<
  Target extends EventTarget,
  Type extends DescriptorType<Target> = DescriptorType<Target>,
> = {
  type: Type
  listener: Type extends string
    ? EventListenerWithSignal<
        DispatchedEvent<EventOf<Target, Extract<Type, EventName<Target>>>, Target>
      >
    : Type extends [infer I, string]
      ? EventListenerWithSignal<DispatchedEvent<InferInteractionEvent<I>, Target>>
      : never
  options: AddEventListenerOptions
}

export interface EventContainer<Target extends EventTarget> {
  on<Type extends DescriptorType<Target>>(
    descriptors: EventDescriptor<Target, Type> | EventDescriptor<Target, Type>[] | undefined,
  ): void
  dispose(): void
}

export interface Interaction<E extends Event = Event> {
  signal: AbortSignal
  target: EventTarget
  dispatchEvent(event: E): void
}

// prettier-ignore
export type EventsFor<T extends EventTarget> = 
  T extends HTMLElement ? HTMLElementEventMap :
  T extends Element ? ElementEventMap :
  T extends Window ? WindowEventMap :
  T extends Document ? DocumentEventMap :
  T extends Worker ? WorkerEventMap :
  T extends ServiceWorker ? ServiceWorkerEventMap :
  T extends WebSocket ? WebSocketEventMap :
  T extends MessagePort ? MessagePortEventMap :
  GlobalEventHandlersEventMap & Record<string, Event>

// host event overload
export function bind<
  Target extends EventTarget = EventTarget,
  Type extends EventName<Target> = EventName<Target>,
>(
  type: Type,
  listener: EventListenerWithSignal<DispatchedEvent<EventOf<Target, Type>, Target>>,
  options?: AddEventListenerOptions,
): EventDescriptor<Target, Type>

// interaction event overload (restrict Name to the event type literal union)
export function bind<
  Interaction extends InteractionFn,
  Target extends EventTarget = EventTarget,
  Type extends EventTypeOf<InferInteractionEvent<Interaction>> = EventTypeOf<
    InferInteractionEvent<Interaction>
  >,
>(
  type: [Interaction, Type],
  listener: EventListenerWithSignal<DispatchedEvent<InferInteractionEvent<Interaction>, Target>>,
  options?: AddEventListenerOptions,
): EventDescriptor<Target, [Interaction, Type]>

// implementation
export function bind<
  Target extends EventTarget = EventTarget,
  Type extends DescriptorType<Target> = DescriptorType<Target>,
>(type: Type, listener: any, options: AddEventListenerOptions = {}): EventDescriptor<Target, Type> {
  return { type, listener, options }
}

export function events<Target extends EventTarget>(
  target: Target,
  signal?: AbortSignal,
): EventContainer<Target> {
  let controller = new AbortController()
  if (signal) {
    signal.addEventListener(
      'abort',
      () => controller.abort(new DOMException('1', 'EventContainer')),
      { once: true },
    )
  }

  let descriptors: EventDescriptor<Target>[] = []

  return {
    on: (nextDescriptors) => {
      if (!nextDescriptors) nextDescriptors = []
      if (!Array.isArray(nextDescriptors)) nextDescriptors = [nextDescriptors]
      if (descriptorsChanged(descriptors, nextDescriptors)) {
        controller.abort(new DOMException('descriptors changed', 'EventContainer'))
        controller = new AbortController()
        addEventListeners(target, nextDescriptors, controller.signal)
      } else {
        // update listeners in place
        for (let i = 0; i < descriptors.length; i++) {
          descriptors[i].listener = withSignal(nextDescriptors[i].listener, controller.signal)
        }
      }
    },
    dispose: () => controller.abort(),
  }
}

// Simple diff, we can optimize this if we want to, this simply prevents
// add/remove event listeners if the types/options/order is the same
function descriptorsChanged(
  descriptors: EventDescriptor<any, any>[],
  nextDescriptors: EventDescriptor<any, any>[],
): boolean {
  if (descriptors.length !== nextDescriptors.length) return true
  for (let i = 0; i < descriptors.length; i++) {
    if (descriptors[i].type !== nextDescriptors[i].type) return true
    if (descriptors[i].options !== nextDescriptors[i].options) return true
  }
  return false
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
  eventType: EventTypeOf<InferInteractionEvent<I>>,
) {
  return function <T extends EventTarget = EventTarget>(
    listener: EventListenerWithSignal<DispatchedEvent<InferInteractionEvent<I>, T>>,
  ): EventDescriptor<T, [I, EventTypeOf<InferInteractionEvent<I>>]> {
    return bind([interactionType, eventType], listener)
  }
}

function withSignal(
  listener: EventListenerWithSignal<any>,
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
