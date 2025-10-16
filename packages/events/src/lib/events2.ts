export type EventWithTarget<T = any, E = Event> = Omit<E, 'currentTarget'> & {
  currentTarget: T
}

export type EventListenerWithSignal<T extends EventTarget = EventTarget> = (
  event: EventWithTarget<T>,
  signal: AbortSignal,
) => void | Promise<void>

export type EventDescriptor<T extends EventTarget = EventTarget> = {
  type: string | Function
  listener: EventListenerWithSignal<T>
  options: AddEventListenerOptions
}

export interface EventContainer {
  on(descriptors: EventDescriptor | EventDescriptor[] | undefined): void
}

export interface Interaction<E extends Event = Event> {
  dispatchEvent(event: E): void
}

export function bind<T extends EventTarget = EventTarget>(
  type: EventDescriptor<T>['type'],
  listener: EventListenerWithSignal<T>,
  options: AddEventListenerOptions = {},
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

function addEventListeners(
  target: EventTarget,
  descriptors: EventDescriptor[],
  signal: AbortSignal,
) {
  for (let descriptor of descriptors) {
    if (typeof descriptor.type === 'function') {
      throw new Error('Not implemented')
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
