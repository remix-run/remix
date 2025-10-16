import {
  TypedEvent,
  InteractionHandle,
  defineInteraction,
  defineInteractionWithEvent,
  Interaction,
  bind,
  events,
} from './events2-integrated.ts'

// ============================================================
// Example 1: Simple function-based interaction
// ============================================================

// Define the event type
class ClickCountEvent extends Event implements TypedEvent<'rmx:clickcount'> {
  readonly type = 'rmx:clickcount'
  readonly count: number

  constructor(count: number) {
    super('rmx:clickcount', { bubbles: true })
    this.count = count
  }
}

// Option A: Manual typing
function ClickCounter1(this: InteractionHandle<'rmx:clickcount', ClickCountEvent>) {
  let count = 0
  return [
    bind('click', () => {
      count++
      this.dispatch(new ClickCountEvent(count))

      // @ts-expect-error - Wrong event type
      this.dispatch(new Event('other'))

      // @ts-expect-error - Wrong event name
      this.dispatch(new Event('rmx:clickcount'))
    }),
  ]
}
ClickCounter1.eventName = 'rmx:clickcount'

// Option B: Using defineInteraction helper
const ClickCounter2 = defineInteraction('rmx:clickcount')<ClickCountEvent>(function () {
  let count = 0
  return [
    bind('click', () => {
      count++
      this.dispatch(new ClickCountEvent(count))
    }),
  ]
})

// Option C: Using defineInteractionWithEvent (most type-safe)
const ClickCounter3 = defineInteractionWithEvent(
  'rmx:clickcount',
  ClickCountEvent,
)(function () {
  let count = 0
  return [
    bind('click', () => {
      count++
      this.dispatch(new ClickCountEvent(count))
    }),
  ]
})

// ============================================================
// Example 2: Class-based interaction
// ============================================================

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
  private lastTap = 0

  bind() {
    return [
      bind('pointerdown', () => {
        const now = Date.now()
        if (this.lastTap > 0) {
          const bpm = Math.round(60000 / (now - this.lastTap))
          this.dispatch(new TempoEvent(bpm))
        }
        this.lastTap = now
      }),
      bind('keydown', (event) => {
        if (event.key === 'Enter' && this.lastTap > 0) {
          const now = Date.now()
          const bpm = Math.round(60000 / (now - this.lastTap))
          this.dispatch(new TempoEvent(bpm))
        }
      }),
    ]
  }
}

// ============================================================
// Example 3: Generic interaction that works with standard events
// ============================================================

const FocusTracker = defineInteraction('rmx:focus')<FocusEvent>(function () {
  return [
    bind('focusin', () => {
      // Can dispatch any FocusEvent with the correct type
      this.dispatch(new FocusEvent('rmx:focus', { bubbles: true }))
    }),
    bind('focusout', () => {
      this.dispatch(new FocusEvent('rmx:focus', { bubbles: true }))
    }),
  ]
})

// ============================================================
// Example 4: Complex event with runtime validation
// ============================================================

class ValidationEvent extends Event implements TypedEvent<'rmx:validation'> {
  readonly type = 'rmx:validation'
  readonly field: string
  readonly valid: boolean
  readonly errors: string[]

  constructor(field: string, valid: boolean, errors: string[] = []) {
    super('rmx:validation', { bubbles: true })
    this.field = field
    this.valid = valid
    this.errors = errors
  }
}

const FormValidator = defineInteractionWithEvent(
  'rmx:validation',
  ValidationEvent,
)(function () {
  return [
    bind('input', (event) => {
      const input = event.currentTarget as HTMLInputElement
      const field = input.name

      // Validation logic
      const errors: string[] = []
      if (input.required && !input.value) {
        errors.push('Field is required')
      }
      if (input.type === 'email' && !input.value.includes('@')) {
        errors.push('Invalid email format')
      }

      this.dispatch(new ValidationEvent(field, errors.length === 0, errors))
    }),
  ]
})

// ============================================================
// Usage examples
// ============================================================

// Setting up interactions on an element
const button = document.createElement('button')
const container = events(button)

// All of these work with type safety
container.on([
  bind(ClickCounter1, (event) => {
    // event is typed as ClickCountEvent
    console.log('Click count:', event.count)
  }),

  bind(ClickCounter2, (event) => {
    console.log('Click count:', event.count)
  }),

  bind(TempoInteraction.prototype.toFunction(), (event) => {
    // event is typed as TempoEvent
    console.log('Tempo:', event.tempo, 'BPM')
  }),

  bind(FormValidator, (event) => {
    // event is typed as ValidationEvent
    if (!event.valid) {
      console.log(`Field ${event.field} has errors:`, event.errors)
    }
  }),
])

// ============================================================
// Error examples (these would cause TypeScript errors)
// ============================================================

// @ts-expect-error - Can't use wrong event type in interaction
const BadInteraction1 = defineInteraction('rmx:bad')<ClickCountEvent>(function () {
  return [
    bind('click', () => {
      // Error: ClickCountEvent has type 'rmx:clickcount', not 'rmx:bad'
      this.dispatch(new ClickCountEvent(1))
    }),
  ]
})

// @ts-expect-error - Can't dispatch wrong event type
const BadInteraction2 = defineInteractionWithEvent(
  'rmx:tempo',
  TempoEvent,
)(function () {
  return [
    bind('click', () => {
      // Error: Expected TempoEvent, got ClickCountEvent
      this.dispatch(new ClickCountEvent(1))
    }),
  ]
})
