# Custom Interactions

Build reusable interaction patterns with the `@remix-run/interaction` package.

> **Note:** Custom interactions are rare in application code. Most apps should use the built-in interactions (`press`, `longPress`, `swipe`, etc.) and standard DOM events. Only create custom interactions when you need to encapsulate complex multi-event patterns that will be reused across your codebase.

## Built-in Interactions

The interaction package provides several ready-to-use interactions:

```tsx
import { press, pressDown, pressUp, longPress, pressCancel } from 'remix/interaction/press'
import { swipeStart, swipeMove, swipeEnd, swipeCancel } from 'remix/interaction/swipe'
import { arrowUp, arrowDown, arrowLeft, arrowRight, space } from 'remix/interaction/keys'
```

Use them like any event type:

```tsx
<button
  on={{
    [press]() {
      doAction()
    },
  }}
>
  Action
</button>
```

## When to Create Custom Interactions

Create a custom interaction when:

- You need to combine multiple low-level events into a semantic action
- The interaction pattern will be reused across multiple components
- You want to encapsulate complex state tracking (e.g., gesture recognition, tempo detection)

Don't create a custom interaction when:

- A built-in interaction already handles your use case
- The logic is simple enough to handle inline in an event handler
- The pattern is only used in one place

## Defining an Interaction

Use `defineInteraction` to create a reusable interaction:

```ts
import { defineInteraction, type Interaction } from 'remix/interaction'

// 1. Define the interaction with a unique namespaced type
export let dragRelease = defineInteraction('myapp:drag-release', DragRelease)

// 2. Declare the event type for TypeScript
declare global {
  interface HTMLElementEventMap {
    [dragRelease]: DragReleaseEvent
  }
}

// 3. Create a custom event class with relevant data
export class DragReleaseEvent extends Event {
  velocityX: number
  velocityY: number

  constructor(type: typeof dragRelease, init: { velocityX: number; velocityY: number }) {
    super(type, { bubbles: true, cancelable: true })
    this.velocityX = init.velocityX
    this.velocityY = init.velocityY
  }
}

// 4. Implement the interaction setup function
function DragRelease(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return

  let target = handle.target
  let isTracking = false
  let velocityX = 0
  let velocityY = 0

  handle.on(target, {
    pointerdown(event) {
      if (!event.isPrimary) return
      isTracking = true
      target.setPointerCapture(event.pointerId)
    },

    pointermove(event) {
      if (!isTracking) return
      // Track velocity...
    },

    pointerup(event) {
      if (!isTracking) return
      isTracking = false

      // Dispatch the custom event
      target.dispatchEvent(new DragReleaseEvent(dragRelease, { velocityX, velocityY }))
    },
  })
}
```

## The Interaction Handle

The setup function receives an `Interaction` handle with:

- **`handle.target`** - The element the interaction is attached to
- **`handle.signal`** - AbortSignal for cleanup when the interaction is disposed
- **`handle.on(target, listeners)`** - Add event listeners with automatic cleanup
- **`handle.raise(error)`** - Report errors to the parent error handler

```ts
function MyInteraction(handle: Interaction) {
  // Guard for specific element types if needed
  if (!(handle.target instanceof HTMLElement)) return

  let target = handle.target

  // Set up listeners - automatically cleaned up when signal aborts
  handle.on(target, {
    pointerdown(event) {
      // Handle event...
    },
  })

  // Listen to other targets (e.g., document for global events)
  handle.on(target.ownerDocument, {
    pointerup() {
      // Handle pointer released outside target...
    },
  })
}
```

## Consuming in Components

Use custom interactions just like built-in events:

```tsx
import { dragRelease } from './drag-release.ts'

function DraggableCard(handle: Handle) {
  return () => (
    <div
      on={{
        [dragRelease](event) {
          console.log('Released with velocity:', event.velocityX, event.velocityY)
        },
      }}
    >
      Drag me
    </div>
  )
}
```

## Example: Tap Tempo

A more complex example that tracks repeated taps to calculate BPM:

```ts
import { defineInteraction, type Interaction } from 'remix/interaction'

export let tempo = defineInteraction('myapp:tempo', Tempo)

declare global {
  interface HTMLElementEventMap {
    [tempo]: TempoEvent
  }
}

export class TempoEvent extends Event {
  bpm: number

  constructor(type: typeof tempo, bpm: number) {
    super(type)
    this.bpm = bpm
  }
}

function Tempo(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return

  let target = handle.target
  let taps: number[] = []
  let resetTimer = 0

  function handleTap() {
    clearTimeout(resetTimer)

    taps.push(Date.now())
    taps = taps.filter((tap) => Date.now() - tap < 4000)

    if (taps.length >= 4) {
      let intervals = []
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1])
      }
      let avgMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length
      let bpm = Math.round(60000 / avgMs)
      target.dispatchEvent(new TempoEvent(tempo, bpm))
    }

    resetTimer = window.setTimeout(() => {
      taps = []
    }, 4000)
  }

  handle.on(target, {
    pointerdown: handleTap,
    keydown(event) {
      if (event.repeat) return
      if (event.key === 'Enter' || event.key === ' ') {
        handleTap()
      }
    },
  })
}
```

## Best Practices

1. **Namespace your event types** - Use a prefix like `myapp:` to avoid collisions with built-in interactions
2. **Use cancelable events** - Set `cancelable: true` so consumers can call `event.preventDefault()`
3. **Include relevant data** - Add properties to your event class for data consumers need
4. **Guard element types** - Check `handle.target instanceof HTMLElement` if you need DOM-specific APIs
5. **Clean up automatically** - Use `handle.on()` instead of `addEventListener` for automatic cleanup

## See Also

- [Events](./events.md) - Event handling basics
- [Handle API](./handle.md) - `handle.on()` for global listeners in components
