// Proposed implementation that provides type safety for dispatch

export type EventWithTarget<T = any, E = Event> = Omit<E, 'currentTarget'> & {
  currentTarget: T
}

// Events must declare their type as a literal string
export interface TypedEvent<Type extends string = string> extends Event {
  readonly type: Type
}

// Interaction functions can optionally declare their event name
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

// Updated InteractionHandle to be generic over event name and event type
export interface InteractionHandle<
  Name extends string = string,
  E extends TypedEvent<Name> = TypedEvent<Name>,
> {
  readonly name: Name
  dispatch(event: E): void
}

// Helper type to extract the event name from an interaction function
export type InteractionName<T> = T extends InteractionFunction & { eventName: infer N }
  ? N extends string
    ? N
    : string
  : string

// Helper to define typed interactions
export function defineInteraction<Name extends string, E extends TypedEvent<Name>>(
  name: Name,
  fn: (this: InteractionHandle<Name, E>) => EventDescriptor[],
): InteractionFunction {
  fn.eventName = name
  return fn
}

// For class-based interactions
export abstract class Interaction<
  Name extends string = string,
  E extends TypedEvent<Name> = TypedEvent<Name>,
> {
  abstract readonly name: Name

  protected dispatch(event: E): void {
    // This will be bound to the actual dispatch function
    throw new Error('dispatch must be called within a bound interaction')
  }

  abstract bind(): EventDescriptor[]
}

// Example usage:

// 1. Simple typed event
class ClickCountEvent extends Event implements TypedEvent<'rmx:clickcount'> {
  readonly type = 'rmx:clickcount'
  readonly count: number

  constructor(count: number) {
    super('rmx:clickcount', { bubbles: true })
    this.count = count
  }
}

// 2. Function-based interaction with type safety
const ClickCounter = defineInteraction(
  'rmx:clickcount',
  function (this: InteractionHandle<'rmx:clickcount', ClickCountEvent>) {
    let count = 0
    return [
      bind('click', () => {
        count++
        this.dispatch(new ClickCountEvent(count))

        // @ts-expect-error - Wrong event type
        this.dispatch(new Event('other'))
      }),
    ]
  },
)

// 3. Class-based interaction
class TempoEvent extends Event implements TypedEvent<'rmx:tempo'> {
  readonly type = 'rmx:tempo'
  readonly tempo: number

  constructor(tempo: number) {
    super('rmx:tempo', { bubbles: false })
    this.tempo = tempo
  }
}

class TempoInteraction extends Interaction<'rmx:tempo', TempoEvent> {
  readonly name = 'rmx:tempo'

  bind() {
    let lastTap = 0
    return [
      bind('pointerdown', () => {
        const now = Date.now()
        if (lastTap > 0) {
          const bpm = Math.round(60000 / (now - lastTap))
          this.dispatch(new TempoEvent(bpm))
        }
        lastTap = now
      }),
    ]
  }
}

// 4. For interactions that don't need custom events
function SimpleInteraction(this: InteractionHandle<'rmx:simple'>) {
  return [
    bind('click', () => {
      // Can only dispatch events with type 'rmx:simple'
      this.dispatch(new Event('rmx:simple'))
    }),
  ]
}
SimpleInteraction.eventName = 'rmx:simple'

// The bind function remains the same
export function bind<T extends EventTarget = EventTarget>(
  type: EventDescriptor<T>['type'],
  listener: EventDescriptor<T>['listener'],
  options: EventDescriptor<T>['options'] = {},
): EventDescriptor<T> {
  return { type, listener, options }
}
