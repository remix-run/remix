// Approach 1: Event classes with static eventName
// This approach uses the event class to define both the name and shape

interface EventWithName extends Event {
  type: string
}

interface EventConstructorWithName<T extends EventWithName> {
  eventName: string
  new (...args: any[]): T
}

interface InteractionHandle1<E extends EventConstructorWithName<any>> {
  name: E['eventName']
  dispatch(event: InstanceType<E>): void
}

// Usage:
class TempoEvent1 extends Event {
  static readonly eventName = 'rmx:tempo' as const
  readonly tempo: number

  constructor(tempo: number) {
    super(TempoEvent1.eventName, { bubbles: false })
    this.tempo = tempo
  }
}

function Tempo1(this: InteractionHandle1<typeof TempoEvent1>) {
  return [
    bind('pointerdown', () => {
      // Type safe: must be TempoEvent1 instance
      this.dispatch(new TempoEvent1(120))

      // @ts-expect-error - wrong event type
      this.dispatch(new Event('other'))
    }),
  ]
}

// ============================================================

// Approach 2: Branded event types with name literal
// This uses TypeScript's literal types and branded types

interface BrandedEvent<Name extends string> extends Event {
  readonly type: Name
  readonly __brand: Name
}

interface InteractionHandle2<Name extends string, E extends BrandedEvent<Name>> {
  name: Name
  dispatch(event: E): void
}

class TempoEvent2 extends Event implements BrandedEvent<'rmx:tempo'> {
  readonly type: 'rmx:tempo'
  readonly __brand: 'rmx:tempo'
  readonly tempo: number

  constructor(tempo: number) {
    super('rmx:tempo', { bubbles: false })
    this.type = 'rmx:tempo'
    this.__brand = 'rmx:tempo'
    this.tempo = tempo
  }
}

function Tempo2(this: InteractionHandle2<'rmx:tempo', TempoEvent2>) {
  return [
    bind('pointerdown', () => {
      this.dispatch(new TempoEvent2(120))

      // @ts-expect-error - wrong event name
      this.dispatch(new Event('other'))
    }),
  ]
}

// ============================================================

// Approach 3: Factory pattern with type inference
// The interaction handle provides a factory for creating events

interface InteractionHandle3<Name extends string, Args extends any[], E extends Event> {
  name: Name
  createEvent(...args: Args): E
  dispatch(event: E): void
}

// Helper to create typed interaction handles
function createInteractionHandle<Name extends string, Args extends any[], E extends Event>(
  name: Name,
  eventFactory: (name: Name, ...args: Args) => E,
): InteractionHandle3<Name, Args, E> {
  return {
    name,
    createEvent: (...args: Args) => eventFactory(name, ...args),
    dispatch: (event: E) => {
      if (event.type !== name) {
        throw new Error(`Event type "${event.type}" does not match interaction name "${name}"`)
      }
      // dispatch logic here
    },
  }
}

class TempoEvent3 extends Event {
  readonly tempo: number

  constructor(name: string, tempo: number) {
    super(name, { bubbles: false })
    this.tempo = tempo
  }
}

function Tempo3(this: InteractionHandle3<'rmx:tempo', [tempo: number], TempoEvent3>) {
  return [
    bind('pointerdown', () => {
      // Use the factory method which ensures correct name
      const event = this.createEvent(120)
      this.dispatch(event)

      // Or directly create with the name
      this.dispatch(new TempoEvent3(this.name, 120))
    }),
  ]
}

// ============================================================

// Approach 4: Simpler constraint-based approach
// Just ensure the event type matches the name

interface NamedEvent<Name extends string = string> extends Event {
  readonly type: Name
}

interface InteractionHandle4<Name extends string, E extends NamedEvent<Name>> {
  name: Name
  dispatch(event: E): void
}

class TempoEvent4 extends Event implements NamedEvent<'rmx:tempo'> {
  readonly type: 'rmx:tempo'
  readonly tempo: number

  constructor(tempo: number) {
    super('rmx:tempo', { bubbles: false })
    // TypeScript will enforce this due to the implements clause
    this.type = 'rmx:tempo'
    this.tempo = tempo
  }
}

function Tempo4(this: InteractionHandle4<'rmx:tempo', TempoEvent4>) {
  return [
    bind('pointerdown', () => {
      this.dispatch(new TempoEvent4(120))

      // @ts-expect-error - Event doesn't implement NamedEvent<'rmx:tempo'>
      this.dispatch(new Event('rmx:tempo'))
    }),
  ]
}

// ============================================================

// Approach 5: Class-based interactions with method constraints
// For class-based interactions

abstract class Interaction<Name extends string, E extends NamedEvent<Name>> {
  abstract readonly name: Name

  dispatch(event: E): void {
    // Runtime check could be added here
    if (event.type !== this.name) {
      throw new Error(`Event type "${event.type}" does not match interaction name "${this.name}"`)
    }
    // Actual dispatch logic
  }

  abstract bind(): EventDescriptor[]
}

class TempoInteraction extends Interaction<'rmx:tempo', TempoEvent4> {
  readonly name = 'rmx:tempo' as const

  bind() {
    return [
      bind('pointerdown', () => {
        this.dispatch(new TempoEvent4(120))
      }),
    ]
  }
}

export type { InteractionHandle1, InteractionHandle2, InteractionHandle3, InteractionHandle4 }
