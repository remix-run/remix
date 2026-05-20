# Creating Mixins

## What This Covers

How to author your own reusable host-element behavior with `createMixin`. Read this when the task
involves:

- Combining multiple low-level events or DOM hooks into one semantic mixin
- Dispatching custom DOM events from a host node
- Encapsulating imperative DOM setup that several components share
- Typing custom events on `HTMLElementEventMap` for use with `on(...)`

For the built-in mixins most code should use, see `mixins-styling-events.md`.

Use `createMixin` from `remix/ui` to author reusable host-element behavior.

Most app code should use built-in core mixins (`on`, `css`, `ref`, `link`, `attrs`) and animation
mixins from `remix/ui/animation`. Create custom mixins when combining multiple low-level events
into one semantic event, or when the pattern is reused across components.

## Core Semantics

1. A mixin handle is tied to one mounted host node lifecycle.
2. `insert` is the host-node availability point for imperative setup.
3. `remove` is teardown for that same lifecycle.
4. `queueTask` runs post-commit and receives `(node, signal)` for mixins.
5. Mixin render functions should stay pure; side effects belong in `insert`, `remove`, or queued
   work.

```tsx
import { createMixin } from 'remix/ui'

let myMixin = createMixin<HTMLElement>((handle) => {
  handle.addEventListener('insert', (event) => {
    // event.node is the mounted host node
  })

  handle.addEventListener('remove', () => {
    // Clean up listeners, timers, observers
  })

  return (props) => {
    handle.queueTask((node) => {
      // Post-commit work that needs the concrete host node
    })
    return <handle.element {...props} />
  }
})
```

## Patterns

### Pure prop transform

```tsx
let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
  <handle.element {...props} title={title} />
))
```

### Lifecycle-managed imperative setup

```tsx
let withFocus = createMixin<HTMLElement>((handle) => {
  handle.addEventListener('insert', (event) => {
    event.node.focus()
  })
  return (props) => <handle.element {...props} />
})
```

## Custom Event Mixins

Create event mixins when you combine multiple low-level events into one semantic custom event that
is reused across components.

1. Namespace custom event names (`myapp:*`) to avoid collisions.
2. Extend `Event` with the data consumers need.
3. Declare the event on `HTMLElementEventMap` for type safety with `on(...)`.
4. Dispatch from the host node inside the mixin.

```tsx
import { createMixin, on } from 'remix/ui'

export let dragReleaseType = 'myapp:drag-release' as const

declare global {
  interface HTMLElementEventMap {
    [dragReleaseType]: DragReleaseEvent
  }
}

export class DragReleaseEvent extends Event {
  velocityX: number
  velocityY: number
  constructor(init: { velocityX: number; velocityY: number }) {
    super(dragReleaseType, { bubbles: true, cancelable: true })
    this.velocityX = init.velocityX
    this.velocityY = init.velocityY
  }
}

export let dragRelease = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | undefined
  let tracking = false
  let velocityX = 0
  let velocityY = 0
  let lastX = 0
  let lastY = 0
  let lastT = 0

  handle.addEventListener('insert', (event) => {
    node = event.node
  })

  return () => (
    <handle.element
      mix={[
        on('pointerdown', (event) => {
          if (!event.isPrimary) return
          tracking = true
          lastX = event.clientX
          lastY = event.clientY
          lastT = event.timeStamp
          node?.setPointerCapture(event.pointerId)
        }),
        on('pointermove', (event) => {
          if (!tracking) return
          let dt = Math.max(1, event.timeStamp - lastT)
          velocityX = (event.clientX - lastX) / dt
          velocityY = (event.clientY - lastY) / dt
          lastX = event.clientX
          lastY = event.clientY
          lastT = event.timeStamp
        }),
        on('pointerup', () => {
          if (!tracking) return
          tracking = false
          node?.dispatchEvent(new DragReleaseEvent({ velocityX, velocityY }))
        }),
      ]}
    />
  )
})
```

Consume it:

```tsx
<div
  mix={[
    dragRelease(),
    on(dragReleaseType, (event) => {
      console.log('velocity:', event.velocityX, event.velocityY)
    }),
  ]}
/>
```
