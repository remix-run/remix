export type DispatchedEvent<E extends Event, T extends EventTarget> = E & { currentTarget: T }

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
    descriptors: EventDescriptor<Target, Type> | EventDescriptor<Target, Type>[],
  ): void
  dispose(): void
}

export interface Interaction<E extends Event = Event> {
  signal: AbortSignal
  target: EventTarget
  dispatchEvent(event: E): void
}

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

  let bindings: EventDescriptor<any, any>[] = []

  return {
    on: (nextDescriptors) => {
      if (!nextDescriptors) nextDescriptors = []
      if (!Array.isArray(nextDescriptors)) nextDescriptors = [nextDescriptors]
      if (bindingsChanged(bindings, nextDescriptors)) {
        controller.abort(new DOMException('bindings changed', 'EventContainer'))
        controller = new AbortController()
        bindings = addEventListeners(target, nextDescriptors, controller.signal)
      } else {
        bindings = updateBindingsInPlace(bindings, nextDescriptors, controller.signal)
      }
    },
    dispose: () => controller.abort(),
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

export class TypedEventTarget<EventMap> extends EventTarget {}

export interface TypedEventTarget<EventMap> {
  // typed
  addEventListener<K extends Extract<keyof EventMap, string>>(
    type: K,
    listener: TypedEventListener<EventMap>[K],
    options?: AddEventListenerOptions,
  ): void
  // base
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void

  // typed
  removeEventListener<K extends Extract<keyof EventMap, string>>(
    type: K,
    listener: TypedEventListener<EventMap>[K],
    options?: EventListenerOptions,
  ): void
  // base
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions,
  ): void
}

type TypedEventListener<EventMap> = {
  [K in keyof EventMap]: (event: EventMap[K]) => void
}

function updateBindingsInPlace(
  descriptors: EventDescriptor<any, any>[],
  nextDescriptors: EventDescriptor<any, any>[],
  containerSignal: AbortSignal,
) {
  let bindings = []
  for (let i = 0; i < descriptors.length; i++) {
    bindings.push({
      type: descriptors[i].type,
      options: descriptors[i].options,
      listener: withSignal(nextDescriptors[i].listener, containerSignal),
    })
  }
  return bindings
}

// Simple diff, we can optimize this if we want to, this simply prevents
// add/remove event listeners if the types/options/order is the same
function bindingsChanged(
  bindings: EventDescriptor<any, any>[],
  nextDescriptors: EventDescriptor<any, any>[],
): boolean {
  if (bindings.length !== nextDescriptors.length) return true
  for (let i = 0; i < bindings.length; i++) {
    if (bindings[i].type !== nextDescriptors[i].type) return true
    if (optionsChanged(bindings[i].options, nextDescriptors[i].options)) return true
  }
  return false
}

function optionsChanged(a: AddEventListenerOptions, b: AddEventListenerOptions): boolean {
  return (
    a.capture !== b.capture || a.once !== b.once || a.passive !== b.passive || a.signal !== b.signal
  )
}

let attachedInteractions = new WeakMap<EventTarget, Interaction<any>>()

function addEventListeners(
  target: EventTarget,
  descriptors: EventDescriptor<any, any>[],
  containerSignal: AbortSignal,
  bindings: EventDescriptor<any, any>[] = [],
) {
  for (let descriptor of descriptors) {
    if (Array.isArray(descriptor.type)) {
      let [interactionType, eventType] = descriptor.type

      if (!attachedInteractions.has(target)) {
        let handle: Interaction<any> = {
          target,
          signal: containerSignal,
          dispatchEvent: (event) => {
            target.dispatchEvent(event)
          },
        }

        let childDescriptors = interactionType.call(handle)
        addEventListeners(target, childDescriptors, containerSignal, bindings)
        attachedInteractions.set(target, handle)
      }

      let interactionDescriptor = { ...descriptor, type: eventType }
      addEventListeners(target, [interactionDescriptor], containerSignal, bindings)
      continue
    }

    let listenerSignal = descriptor.options.signal ?? containerSignal
    let binding = {
      type: descriptor.type,
      options: { ...descriptor.options, signal: listenerSignal },
      listener: withSignal(descriptor.listener, listenerSignal),
    }
    target.addEventListener(binding.type, binding.listener, binding.options)
    bindings.push(binding)
  }

  return bindings
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

type EventListenerWithSignal<E extends Event> = (
  event: E,
  signal: AbortSignal,
) => void | Promise<void>

// prettier-ignore
type BuiltinEventsFor<T extends EventTarget> = 
  T extends HTMLElement ? HTMLElementEventMap :
  T extends Element ? ElementEventMap :
  T extends Window ? WindowEventMap :
  T extends Document ? DocumentEventMap :
  T extends Worker ? WorkerEventMap :
  T extends ServiceWorker ? ServiceWorkerEventMap :
  T extends WebSocket ? WebSocketEventMap :
  T extends MessagePort ? MessagePortEventMap :
  GlobalEventHandlersEventMap & Record<string, Event>

type EventMapOf<T> =
  T extends TypedEventTarget<infer M>
    ? '__eventMap' extends keyof T
      ? M
      : never
    : '__eventMap' extends keyof T
      ? Exclude<T['__eventMap'], undefined>
      : never

export type EventsFor<T extends EventTarget> = [EventMapOf<T>] extends [never]
  ? BuiltinEventsFor<T>
  : EventMapOf<T>

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
