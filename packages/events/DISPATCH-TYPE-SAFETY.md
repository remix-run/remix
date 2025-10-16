# Type-Safe Event Dispatching in Remix Events

## The Challenge

We need to ensure that when an interaction dispatches an event:

1. The event type matches what the interaction expects
2. The event's `type` property matches the interaction's `name`
3. The API remains simple and ergonomic

## Proposed Solution

### Core Types

```typescript
// Events can implement TypedEvent for stronger typing
interface TypedEvent<Type extends string = string> extends Event {
  readonly type: Type
}

// InteractionHandle is generic over name and event type
interface InteractionHandle<Name extends string = string, E extends Event = Event> {
  readonly name: Name
  dispatch(event: E): void
}
```

### Three Patterns for Defining Interactions

#### 1. Simple Function Pattern (Good for basic cases)

```typescript
function ClickCounter(this: InteractionHandle<'rmx:clickcount', ClickCountEvent>) {
  return [
    bind('click', () => {
      this.dispatch(new ClickCountEvent(count))
    }),
  ]
}
ClickCounter.eventName = 'rmx:clickcount'
```

**Pros:**

- Simple and familiar
- Works with existing code

**Cons:**

- Manual typing required
- Event name defined in two places

#### 2. Helper Function Pattern (Recommended)

```typescript
const ClickCounter = defineInteraction('rmx:clickcount')<ClickCountEvent>(function () {
  return [
    bind('click', () => {
      this.dispatch(new ClickCountEvent(count))
    }),
  ]
})

// Or with event constructor for maximum safety
const ClickCounter = defineInteractionWithEvent(
  'rmx:clickcount',
  ClickCountEvent,
)(function () {
  return [
    bind('click', () => {
      this.dispatch(new ClickCountEvent(count))
    }),
  ]
})
```

**Pros:**

- Event name defined once
- Type inference works well
- Clean syntax

**Cons:**

- Requires helper functions

#### 3. Class Pattern (Good for complex interactions)

```typescript
class TempoInteraction extends Interaction<'rmx:tempo', TempoEvent> {
  readonly name = 'rmx:tempo'

  bind() {
    return [
      bind('pointerdown', () => {
        this.dispatch(new TempoEvent(bpm))
      }),
    ]
  }
}
```

**Pros:**

- Good for stateful interactions
- Clear structure
- Instance methods available

**Cons:**

- More boilerplate
- Needs conversion to function

## Implementation Details

### Event Type Enforcement

Events must declare their type as a literal string:

```typescript
class ClickCountEvent extends Event implements TypedEvent<'rmx:clickcount'> {
  readonly type = 'rmx:clickcount' // TypeScript enforces this matches the generic

  constructor(count: number) {
    super('rmx:clickcount') // Must match
  }
}
```

### Runtime Validation (Optional)

The dispatch function can include runtime checks:

```typescript
const dispatch = (event: Event) => {
  if (event.type !== name) {
    console.warn(`Event type "${event.type}" does not match interaction name "${name}"`)
  }
  target.dispatchEvent(event)
}
```

### Backwards Compatibility

The solution is backwards compatible:

- Existing untyped interactions continue to work
- Type safety is opt-in via generics
- No breaking changes to the API

## Benefits

1. **Compile-time Safety**: TypeScript prevents dispatching wrong event types
2. **Better IntelliSense**: Auto-completion for event properties
3. **Self-documenting**: Clear relationship between interactions and their events
4. **Flexible**: Multiple patterns to suit different use cases

## Migration Path

1. Keep existing code working as-is
2. Add `TypedEvent` interface to new events
3. Use helper functions for new interactions
4. Gradually migrate existing interactions as needed

## Example Migration

Before:

```typescript
function Tempo() {
  return [
    bind('pointerdown', () => {
      this.dispatch(new Event(this.name))
    }),
  ]
}
```

After:

```typescript
const Tempo = defineInteractionWithEvent(
  'rmx:tempo',
  TempoEvent,
)(function () {
  return [
    bind('pointerdown', () => {
      this.dispatch(new TempoEvent(bpm))
    }),
  ]
})
```
