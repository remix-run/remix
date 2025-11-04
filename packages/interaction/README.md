# Remix Interaction

Enhanced events for any [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget).

- Declarative event bindings with plain objects
- Semantic, reusable "interactions" like `longPress` and `arrowDown`
- Async listeners with reentry protection via [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- Type-safe listeners and custom `EventTarget` subclasses with `TypedEventTarget`

## Installation

```sh
npm install @remix-run/interaction
```

## Getting Started

### Adding event listeners

Use `on(target, listeners)` to add one or more listeners. Each listener receives `(event, signal)` where `signal` is aborted on reentry.

```ts
import { on } from '@remix-run/interaction'

let inputElement = document.createElement('input')

on(inputElement, {
  input: (event, signal) => {
    console.log('current value', event.currentTarget.value)
  },
})
```

Listeners can be arrays. They run in order and preserve normal DOM semantics (including `stopImmediatePropagation`).

```ts
import { on, capture, listenWith } from '@remix-run/interaction'

on(inputElement, {
  input: [
    (event) => {
      console.log('first')
    },
    capture((event) => {
      // capture phase
    }),
    listenWith({ once: true }, (event) => {
      console.log('only once')
    }),
  ],
})
```

### Built-in Interactions

Builtin interactions are higher‑level, semantic event types (e.g., `press`, `longPress`, arrow keys) exported as string constants. Consume them just like native events by using computed keys in your listener map. When you bind one, the necessary underlying host events are set up automatically.

```tsx
import { on } from '@remix-run/interaction'
import { press, longPress } from '@remix-run/interaction/press'

on(listItem, {
  [press](event) {
    navigateTo(listItem.href)
  },

  [longPress](event) {
    event.preventDefault() // prevents `press`
    showActions()
  },
})
```

Import builtins from their modules (for example, `@remix-run/interaction/press`, `@remix-run/interaction/keys`). Some interactions may coordinate with others (for example, calling `event.preventDefault()` in one listener can prevent a related interaction from firing).

You can also [create your own interactions](#custom-interactions).

### Async listeners and reentry protection

The `signal` is aborted when the same listener is re-entered (for example, a user types quickly and triggers `input` repeatedly). Pass it to async APIs or check it manually to avoid stale work.

```ts
on(inputElement, {
  async input(event, signal) {
    showSearchSpinner()

    // Abortable fetch
    let res = await fetch(`/search?q=${event.currentTarget.value}`, { signal })
    let results = await res.json()
    updateResults(results)
  },
})
```

For APIs that don't accept a signal:

```ts
on(inputElement, {
  async input(event, signal) {
    showSearchSpinner()
    let results = await someSearch(event.currentTarget.value)
    if (signal.aborted) return
    updateResults(results)
  },
})
```

### Event listener options

All DOM [`AddEventListenerOptions`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options) are supported via descriptors:

```ts
import { on, listenWith, capture } from '@remix-run/interaction'

on(button, {
  click: capture((event) => {
    console.log('capture phase')
  }),
  focus: listenWith({ once: true }, (event) => {
    console.log('focused once')
  }),
})
```

### Updating listeners efficiently

Use `createContainer(target, signal?)` when you need to update listeners in place (e.g., in a component system). The container diffs and updates existing bindings without unnecessary `removeEventListener`/`addEventListener` churn.

```ts
import { createContainer } from '@remix-run/interaction'

let container = createContainer(form)

let formData = new FormData()

container.set({
  change(event) {
    formData = new FormData(event.currentTarget)
  },
  async submit(event, signal) {
    event.preventDefault()
    await fetch('/save', { method: 'POST', body: formData, signal })
  },
})

// later – only the minimal necessary changes are rebound
container.set({
  change(event) {
    console.log('different listener')
  },
  submit(event, signal) {
    console.log('different listener')
  },
})
```

### Disposing listeners

`on` returns a dispose function. Containers expose `dispose()`. You can also pass an external `AbortSignal`.

```ts
import { on, createContainer } from '@remix-run/interaction'

// Using the function returned from on()
let dispose = on(button, { click: () => {} })
dispose()

// Using an external AbortSignal
let controller = new AbortController()
on(button, controller.signal, { click: () => {} })
controller.abort() // removes all listeners added via that call

// Containers
let container = createContainer(window)
container.set({ resize: () => {} })
container.dispose()
```

### Stop propagation semantics

All DOM semantics are preserved.

```ts
on(button, {
  click: [
    (event) => {
      event.stopImmediatePropagation()
    },
    () => {
      // not called
    },
  ],
})
```

## Custom Interactions

Define semantic interactions that can dispatch custom events and be reused declaratively.

```ts
import { defineInteraction, on } from '@remix-run/interaction'

// Provide type safety for consumers
declare global {
  interface HTMLElementEventMap {
    [keydownEnter]: KeyboardEvent
  }
}

function KeydownEnter(target: EventTarget, signal: AbortSignal) {
  if (!(target instanceof HTMLElement)) return

  on(target, signal, {
    keydown(event) {
      if (event.key === 'Enter') {
        target.dispatchEvent(new KeyboardEvent(keydownEnter, { key: 'Enter' }))
      }
    },
  })
}

// define the interaction type and setup function
const keydownEnter = defineInteraction('keydown:enter', KeydownEnter)

// usage
let button = document.createElement('button')
on(button, {
  [keydownEnter](event) {
    console.log('Enter key pressed')
  },
})
```

Notes:

- An interaction is initialized at most once per target, even if multiple listeners bind the same interaction type.

## Typed Event Targets

Use `TypedEventTarget<eventMap>` to get type-safe `addEventListener` and integrate with this library’s `on` helpers.

```ts
import { TypedEventTarget, on } from '@remix-run/interaction'

interface DrummerEventMap {
  kick: DrummerEvent
  snare: DrummerEvent
  hat: DrummerEvent
}

class DrummerEvent extends Event {
  constructor(type: DrummerEvent['type']) {
    super(type)
  }
}

class Drummer extends TypedEventTarget<DrummerEventMap> {
  kick() {
    // ...
    this.dispatchEvent(new DrummerEvent('kick'))
  }
}

let drummer = new Drummer()

// native API is typed
drummer.addEventListener('kick', (event) => {
  // event is DrummerEvent
})

// type safe with on()
on(drummer, {
  kick: (event) => {
    // event is Dispatched<DrummerEvent, Drummer>
  },
})
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
