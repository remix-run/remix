export type EventWithTarget<T = any, E = Event> = Omit<E, 'currentTarget'> & {
  currentTarget: T
}

export type InteractionFunction = Function & { eventType?: string }

export type EventListenerWithSignal<T extends EventTarget = EventTarget> = (
  event: EventWithTarget<T>,
  signal: AbortSignal,
) => void | Promise<void>

export type EventDescriptor<T extends EventTarget = EventTarget> = {
  type: string | InteractionFunction
  listener: EventListenerWithSignal<T>
  options: AddEventListenerOptions
}

export type HostDescriptor<T extends EventTarget = EventTarget> = Omit<
  EventDescriptor<T>,
  'type'
> & { type: string }

export type InteractionDescriptor<T extends EventTarget = EventTarget> = Omit<
  EventDescriptor<T>,
  'type'
> & { type: InteractionFunction }

export interface EventContainer {
  on(descriptors: EventDescriptor | EventDescriptor[] | undefined): void
}

export interface InteractionHandle<D = unknown> {
  type: string
  dispatch(init?: CustomEventInit<D>): void
}

// Helper type to extract the detail type from an interaction function
export type ExtractInteractionDetail<T> = T extends (
  this: InteractionHandle<infer D>,
  ...args: any[]
) => any
  ? D
  : never

export type InferEventType<T extends EventTarget, Type> = Type extends (
  this: InteractionHandle<infer D>,
  ...args: any[]
) => any
  ? EventWithTarget<T, CustomEvent<D>>
  : EventWithTarget<T>

export function bind<
  T extends EventTarget = EventTarget,
  F extends InteractionFunction = InteractionFunction,
>(
  type: F,
  listener: (event: InferEventType<T, F>, signal: AbortSignal) => void | Promise<void>,
  options?: AddEventListenerOptions,
): EventDescriptor<T>
export function bind<T extends EventTarget = EventTarget>(
  type: string,
  listener: EventListenerWithSignal<T>,
  options?: AddEventListenerOptions,
): EventDescriptor<T>
export function bind<T extends EventTarget = EventTarget>(
  type: EventDescriptor<T>['type'],
  listener: EventListenerWithSignal<T>,
  options: EventDescriptor<T>['options'] = {},
): EventDescriptor<T> {
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

let interactionEventNames = new WeakMap<Function, string>()
let interactionEventNamesIndex = 0

function addEventListeners(
  target: EventTarget,
  descriptors: EventDescriptor[],
  signal: AbortSignal,
) {
  for (let descriptor of descriptors) {
    if (typeof descriptor.type === 'function') {
      let type = descriptor.type.eventType
      if (!type) {
        type = `rmx:${++interactionEventNamesIndex}`
        interactionEventNames.set(descriptor.type, type)
      }
      let handle: InteractionHandle = {
        type: type,
        dispatch: (init) => {
          target.dispatchEvent(new CustomEvent(type, init))
        },
      }
      let childDescriptors = descriptor.type.call(handle)
      let interactionDescriptor = { ...descriptor, type: type }
      addEventListeners(target, [...childDescriptors, interactionDescriptor], signal)
      continue
    }

    let options = { signal, ...descriptor.options }
    target.addEventListener(descriptor.type, withSignal(descriptor.listener, signal), options)
  }
}

function withSignal(listener: EventDescriptor['listener'], containerSignal: AbortSignal) {
  let controller = new AbortController()

  containerSignal.addEventListener('abort', () => controller.abort(), { once: true })

  return (event: EventWithTarget) => {
    controller.abort(new DOMException('', 'EventReentry'))
    controller = new AbortController()
    listener(event, controller.signal)
  }
}
