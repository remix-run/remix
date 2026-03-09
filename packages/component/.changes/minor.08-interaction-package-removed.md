BREAKING CHANGE: the `@remix-run/interaction` package has been removed.

`handle.on(...)` APIs were also removed from component and mixin handles.

Before/after migration:

**Interaction package APIs:**

- Before: `defineInteraction(...)`, `createContainer(...)`, `on(target, listeners)` from `@remix-run/interaction`.
- After: use component APIs (`createMixin(...)`, `on(...)`, `addEventListeners(...)`) from `@remix-run/component`.

```ts
// Before
import { on } from '@remix-run/interaction'

let dispose = on(window, {
  resize() {
    console.log('resized')
  },
})

// After
import { addEventListeners } from '@remix-run/component'

let controller = new AbortController()
addEventListeners(window, controller.signal, {
  resize() {
    console.log('resized')
  },
})
```

**Component handle API:**

- Before: `handle.on(target, listeners)`.
- After: `addEventListeners(target, handle.signal, listeners)`.

```tsx
// Before
function KeyboardTracker(handle: Handle) {
  handle.on(document, {
    keydown(event) {
      console.log(event.key)
    },
  })
  return () => null
}

// After
import { addEventListeners } from '@remix-run/component'

function KeyboardTracker(handle: Handle) {
  addEventListeners(document, handle.signal, {
    keydown(event) {
      console.log(event.key)
    },
  })
  return () => null
}
```

**Custom interaction patterns:**

- Before: `defineInteraction(...)` + interaction setup function.
- After: event mixins (`createMixin(...)`) that compose `on(...)` listeners and dispatch typed custom events.

```tsx
// Before
import { defineInteraction, type Interaction } from '@remix-run/interaction'

export let tempo = defineInteraction('my:tempo', Tempo)

function Tempo(handle: Interaction) {
  handle.on(handle.target, {
    click() {
      handle.target.dispatchEvent(new TempoEvent(bmp))
    },
  })
}

// App consumption (before, JSX)
function TempoButtonBefore() {
  return () => (
    <button
      on={{
        [tempo](event) {
          console.log(event.bpm)
        },
      }}
    />
  )
}

// After
import { createMixin, on } from '@remix-run/component'

export let tempo = 'my:tempo' as const

export let tempoEvents = createMixin<HTMLElement>((handle) => {
  return () => (
    <handle.element
      mix={[
        on('click', (event) => {
          event.currentTarget.dispatchEvent(new TempoEvent(bpm))
        }),
      ]}
    />
  )
})

// App consumption (after)
function TempoButton() {
  return () => (
    <button
      mix={[
        tempoEvents(),
        on(tempo, (event) => {
          console.log(event.detail.bpm)
        }),
      ]}
    />
  )
}
```

**TypedEventTarget**

`TypedEventTarget` is now exported from `@remix-run/component`.
