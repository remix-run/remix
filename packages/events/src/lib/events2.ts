export type EventWithTarget<T = any, E = Event> = Omit<E, 'currentTarget'> & {
  currentTarget: T
}

export type EventDescriptor<T extends EventTarget = EventTarget> = {
  type: string | Function
  listener: (event: EventWithTarget<T>, signal: AbortSignal) => void | Promise<void>
  options: AddEventListenerOptions
}

export interface EventContainer {
  on(descriptors: EventDescriptor | EventDescriptor[] | undefined): void
}

export function bind<T extends EventTarget = EventTarget>(
  type: EventDescriptor<T>['type'],
  listener: EventDescriptor<T>['listener'],
  options: EventDescriptor<T>['options'] = {},
): EventDescriptor<T> {
  return { type, listener, options }
}

export function events(target: EventTarget, signal?: AbortSignal): EventContainer {
  signal = signal ?? new AbortController().signal
  return {
    on: (descriptors) => {
      if (!descriptors) {
        descriptors = []
      }
      if (!Array.isArray(descriptors)) {
        descriptors = [descriptors]
      }
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
    if (descriptor.type instanceof Function) {
      throw new Error('not implemented')
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
