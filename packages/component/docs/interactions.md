# Event Mixins

Build reusable event behavior with mixins that compose normal DOM events into semantic custom
events.

> **Note:** Most app code should stick with `on('click', ...)` and other native events. Reach for
> custom event mixins when the behavior is complex and reused in multiple places.

## When to Create an Event Mixin

Create one when:

- You combine multiple low-level events into one semantic event.
- The pattern is reused across components.
- You want one place for timing/gesture state.

Skip it when:

- Native events are already clear enough.
- The behavior is used once.

## Example: Drag Release Mixin

```tsx
import { createMixin, on } from 'remix/component'

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
          velocityX = 0
          velocityY = 0
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

Consume it like any other mixin/custom event:

```tsx
function DraggableCard() {
  return () => (
    <div
      mix={[
        dragRelease(),
        on(dragReleaseType, (event) => {
          console.log('released with velocity:', event.velocityX, event.velocityY)
        }),
      ]}
    />
  )
}
```

## Example: Tap Tempo Mixin

```tsx
import { createMixin, on } from 'remix/component'

export let tempoType = 'myapp:tempo' as const

declare global {
  interface HTMLElementEventMap {
    [tempoType]: TempoEvent
  }
}

export class TempoEvent extends Event {
  bpm: number
  constructor(bpm: number) {
    super(tempoType)
    this.bpm = bpm
  }
}

export let tempo = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | undefined
  let taps: number[] = []
  let resetTimer = 0

  handle.addEventListener('insert', (event) => {
    node = event.node
  })

  handle.addEventListener('remove', () => {
    clearTimeout(resetTimer)
    taps = []
  })

  function handleTap() {
    clearTimeout(resetTimer)
    taps.push(Date.now())
    taps = taps.filter((tap) => Date.now() - tap < 4000)
    if (taps.length < 4) {
      resetTimer = window.setTimeout(() => (taps = []), 4000)
      return
    }
    let intervals: number[] = []
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1])
    let averageMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    node?.dispatchEvent(new TempoEvent(Math.round(60000 / averageMs)))
    resetTimer = window.setTimeout(() => (taps = []), 4000)
  }

  return () => (
    <handle.element
      mix={[
        on('pointerdown', handleTap),
        on('keydown', (event) => {
          if (event.repeat) return
          if (event.key === 'Enter' || event.key === ' ') handleTap()
        }),
      ]}
    />
  )
})
```

## Best Practices

1. Namespace custom event names (`myapp:*`) to avoid collisions.
2. Keep state in the mixin setup scope, not in globals.
3. Dispatch typed custom events with the data consumers need.
4. Use `handle.addEventListener('remove', ...)` for timer/listener cleanup (GC will take care of scoped variables).

## See Also

- [Events](./events.md)
- [Mixins](./mixins.md)
