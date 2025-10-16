// Integration of type-safe dispatch into existing implementation

export type EventWithTarget<T = any, E = Event> = Omit<E, 'currentTarget'> & {
  currentTarget: T
}

// Events can optionally implement TypedEvent for stronger typing
export interface TypedEvent<Type extends string = string> extends Event {
  readonly type: Type
}

export type InteractionFunction = Function & { eventName?: string }

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

// Make InteractionHandle generic over the event name and type
export interface InteractionHandle<Name extends string = string, E extends Event = Event> {
  readonly name: Name
  dispatch(event: E): void
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
      let name = descriptor.type.eventName
      if (!name) {
        name = `rmx:${++interactionEventNamesIndex}`
        interactionEventNames.set(descriptor.type, name)
      }

      // Create a type-safe dispatch function
      const dispatch = (event: Event) => {
        // Runtime validation (optional)
        if (event.type !== name) {
          console.warn(`Event type "${event.type}" does not match interaction name "${name}"`)
        }
        target.dispatchEvent(event)
      }

      // Call the interaction function with typed handle
      let childDescriptors = descriptor.type.call({
        name,
        dispatch,
      })

      let interactionDescriptor = { ...descriptor, type: name }
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

// ============================================================
// Helper utilities for better developer experience
// ============================================================

// Helper to create interaction functions with proper typing
export function defineInteraction<Name extends string>(
  name: Name,
): <E extends Event = Event>(
  fn: (this: InteractionHandle<Name, E>) => EventDescriptor[],
) => InteractionFunction {
  return (fn) => {
    fn.eventName = name
    return fn
  }
}

// Alternative: define interaction with event constructor
export function defineInteractionWithEvent<Name extends string, E extends TypedEvent<Name>>(
  name: Name,
  _eventConstructor: new (...args: any[]) => E,
): (fn: (this: InteractionHandle<Name, E>) => EventDescriptor[]) => InteractionFunction {
  return (fn) => {
    fn.eventName = name
    return fn
  }
}

// Base class for class-based interactions
export abstract class Interaction<Name extends string = string, E extends Event = Event>
  implements InteractionHandle<Name, E>
{
  abstract readonly name: Name

  protected dispatch!: (event: E) => void

  abstract bind(): EventDescriptor[]

  // Convert class to interaction function
  toFunction(): InteractionFunction {
    const fn = function (this: InteractionHandle<Name, E>) {
      const instance = new (this.constructor as any)()
      instance.dispatch = this.dispatch
      return instance.bind()
    }.bind(this)

    fn.eventName = this.name
    return fn
  }
}
