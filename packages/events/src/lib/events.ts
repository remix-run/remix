import type { Autocomplete } from '../type-utils'

type EventListenerWithSignal<event extends Event> = (
  event: event,
  signal: AbortSignal,
) => void | Promise<void>

// prettier-ignore
export type EventDescriptor<
  target extends EventTarget,
  type extends GetEventType<target> | [InteractionFn<Event>, string],
> = {
  type: type extends string ? Autocomplete<type> : type
  listener: EventListenerWithSignal<
    type extends GetEventType<target> ? GetEvent<target, type> :
    type extends InteractionFn<infer event> ? event :
    never
  >
  options: AddEventListenerOptions
}

// prettier-ignore
export type DispatchedEvent<event extends Event, target extends EventTarget> =
  Omit<event, 'currentTarget'> & { currentTarget: target }

// events ------------------------------------------------------------------------------------------

// prettier-ignore
export type EventContainer<target extends EventTarget> = {
  on: <arg, type extends GetEventType<target> | [InteractionFn<Event>, string]>(arg:
    arg & { type: type } extends EventDescriptor<EventTarget, any> ? EventDescriptor<target, type> :
    arg extends Array<EventDescriptor<target, any>> ? arg :
    EventDescriptor<target, type>
  ) => void
  dispose: () => void
}

export function events<target extends EventTarget>(
  target: target,
  signal?: AbortSignal,
): EventContainer<target> {
  let controller = new AbortController()
  if (signal) {
    signal.addEventListener(
      'abort',
      () => controller.abort(new DOMException('1', 'EventContainer')),
      { once: true },
    )
  }

  let bindings: EventDescriptor<target, any>[] = []

  return {
    on: (nextDescriptors) => {
      // prettier-ignore
      let descriptors: Array<EventDescriptor<target, any>> =
        Array.isArray(nextDescriptors) ? nextDescriptors :
        nextDescriptors === undefined ? [] :
        [nextDescriptors]

      if (bindingsChanged(bindings, descriptors)) {
        controller.abort(new DOMException('bindings changed', 'EventContainer'))
        controller = new AbortController()
        bindings = addEventListeners(target, descriptors, controller.signal)
      } else {
        bindings = updateBindingsInPlace(bindings, descriptors, controller.signal)
      }
    },
    dispose: () => controller.abort(),
  }
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

function addEventListeners<target extends EventTarget>(
  target: target,
  descriptors: EventDescriptor<target, any>[],
  containerSignal: AbortSignal,
  bindings: EventDescriptor<target, any>[] = [],
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

// bind --------------------------------------------------------------------------------------------

// prettier-ignore
export function bind<target extends EventTarget, type extends GetEventType<target>>(
  type: Autocomplete<type>,
  listener: EventListenerWithSignal<GetEvent<target, type>>,
  options?: AddEventListenerOptions,
): EventDescriptor<target, type>

// prettier-ignore
export function bind<target extends EventTarget, event extends Event, type extends event['type']>(
  type: [InteractionFn<event>, type],
  listener: EventListenerWithSignal<DispatchedEvent<event, target>>,
  options?: AddEventListenerOptions,
): EventDescriptor<target, [InteractionFn<event>, type]>

export function bind(
  type: string | [InteractionFn<any>, string],
  listener: EventListenerWithSignal<any>,
  options: AddEventListenerOptions = {},
): EventDescriptor<any, any> {
  return { type, listener, options }
}

// EventMaps ---------------------------------------------------------------------------------------

// TODO: consider using https://github.com/alexreardon/bind-event-listener/blob/6cf23e4632d9c9112447a7530d7c8a43791cfcfa/src/types.ts#L5-L15
// so that we don't have to enumerate all the built-in EventMaps
// though @Andarist did say that maybe handwritten EventMap registry may be more robust long term

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
  DispatchedEvent<GetEventMap<target>[type] & Event, target>

// TypedEventTarget --------------------------------------------------------------------------------

export class TypedEventTarget<eventMap> extends EventTarget {
  declare readonly __eventMap?: eventMap
}

export interface TypedEventTarget<eventMap> {
  // typed
  addEventListener<type extends Extract<keyof eventMap, string>>(
    type: type,
    listener: TypedEventListener<eventMap>[type],
    options?: AddEventListenerOptions,
  ): void
  // base
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void

  // typed
  removeEventListener<type extends Extract<keyof eventMap, string>>(
    type: type,
    listener: TypedEventListener<eventMap>[type],
    options?: EventListenerOptions,
  ): void
  // base
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions,
  ): void
}
type TypedEventListener<eventMap> = {
  [key in keyof eventMap]: (event: eventMap[key]) => void
}

// Interaction -------------------------------------------------------------------------------------

export type Interaction<event extends Event = Event> = {
  signal: AbortSignal
  target: EventTarget
  dispatchEvent(event: event): void
}
type InteractionFn<event extends Event> = (this: Interaction<event>) => unknown

export function createBinder<event extends Event>(
  interactionType: InteractionFn<event>,
  eventType: event['type'],
) {
  return function <target extends EventTarget = EventTarget>(
    listener: EventListenerWithSignal<DispatchedEvent<event, target>>,
  ): EventDescriptor<target, [InteractionFn<event>, event['type']]> {
    return bind([interactionType, eventType], listener)
  }
}
