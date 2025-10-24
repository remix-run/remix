export declare function events<target extends EventTarget>(
  target: target,
  signal?: AbortSignal,
): EventContainer<target>

// prettier-ignore
type EventContainer<target extends EventTarget> = {
  on: <arg, type extends GetEventType<target> | [InteractionFn<Event>, string]>(arg:
    arg & { type: type } extends EventDescriptor<EventTarget, any> ? EventDescriptor<target, type> :
    arg extends Array<EventDescriptor<target, any>> ? arg :
    EventDescriptor<target, type>
  ) => void
}

type EventListenerWithSignal<event extends Event> = (
  event: event,
  signal: AbortSignal,
) => void | Promise<void>

// prettier-ignore
type EventDescriptor<
  target extends EventTarget,
  type extends GetEventType<target> | [InteractionFn<Event>, string],
> = {
  type: type extends string ? Autocomplete<type> : type
  listener: EventListenerWithSignal<
    type extends GetEventType<target> ? GetEvent<target, type> :
    type extends InteractionFn<infer event> ? event :
    never
  >
  options?: EventListenerOptions
}

// prettier-ignore
export declare function bind<target extends EventTarget, type extends GetEventType<target>>(
  type: Autocomplete<type>,
  listener: EventListenerWithSignal<GetEvent<target, type>>,
  options?: AddEventListenerOptions,
): EventDescriptor<target, type>

// prettier-ignore
export declare function bind<target extends EventTarget, event extends Event, type extends event['type']>(
  type: [InteractionFn<event>, type],
  listener: EventListenerWithSignal<EventWithTarget<event, target>>,
  options?: AddEventListenerOptions,
): EventDescriptor<target, [InteractionFn<event>, type]>

type Autocomplete<T> = T | (string & {})

// prettier-ignore
export type EventWithTarget<event extends Event, target extends EventTarget> =
  Omit<event, 'currentTarget'> & { currentTarget: target }

// EventMaps ---------------------------------------------------------------------------------------

// prettier-ignore
type GetEventMap<target extends EventTarget> =
  // TypedEventTarget
  target extends { __eventMap?: infer eventMap } ? eventMap :

  // builtins
  target extends HTMLElement ? HTMLElementEventMap :
  target extends Element ? ElementEventMap :
  target extends Window ? WindowEventMap :
  target extends Document ? DocumentEventMap :
  target extends Worker ? WorkerEventMap :
  target extends ServiceWorker ? ServiceWorkerEventMap :
  target extends WebSocket ? WebSocketEventMap :
  target extends MessagePort ? MessagePortEventMap :

  // default
  GlobalEventHandlersEventMap & Record<string, Event>

// prettier-ignore
type GetEventType<target extends EventTarget> =
  target extends { __eventMap?: infer eventMap } ? keyof eventMap : // TypedEventTarget
  keyof GetEventMap<target>

// prettier-ignore
type GetEvent<target extends EventTarget, type extends GetEventType<target>> =
  EventWithTarget<GetEventMap<target>[type] & Event, target>

// TypedEventTarget --------------------------------------------------------------------------------

export class TypedEventTarget<EventMap> extends EventTarget {
  declare readonly __eventMap?: EventMap
}

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

// Interaction -------------------------------------------------------------------------------------

export type Interaction<E extends Event = Event> = {
  signal: AbortSignal
  target: EventTarget
  dispatchEvent(event: E): void
}
type InteractionFn<event extends Event> = (this: Interaction<event>) => unknown

export function createBinder<event extends Event>(
  interactionType: InteractionFn<event>,
  eventType: event['type'],
) {
  return function <target extends EventTarget = EventTarget>(
    listener: EventListenerWithSignal<EventWithTarget<event, target>>,
  ): EventDescriptor<target, [InteractionFn<event>, event['type']]> {
    return bind([interactionType, eventType], listener)
  }
}
