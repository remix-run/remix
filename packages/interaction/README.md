# interaction

Enhanced events and custom interactions for any [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget).

## Features

- **Declarative Bindings** - Event bindings with plain objects
- **Semantic Interactions** - Reusable "interactions" like `longPress` and `arrowDown`
- **Async Support** - Listeners with reentry protection via [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- **Type Safety** - Type-safe listeners and custom `EventTarget` subclasses with `TypedEventTarget`

## Installation

```sh
npm i remix
```

## Getting Started

### Adding event listeners

Use `on(target, listeners)` to add one or more listeners. Each listener receives `(event, signal)` where `signal` is aborted on reentry.

```ts
import { on } from 'remix/interaction'

let inputElement = document.createElement('input')

on(inputElement, {
  input: (event, signal) => {
    console.log('current value', event.currentTarget.value)
  },
})
```

Listeners can be arrays. They run in order and preserve normal DOM semantics (including `stopImmediatePropagation`).

```ts
import { on } from 'remix/interaction'

on(inputElement, {
  input: [
    (event) => {
      console.log('first')
    },
    {
      capture: true,
      listener(event) {
        // capture phase
      },
    },
    {
      once: true,
      listener(event) {
        console.log('only once')
      },
    },
  ],
})
```

### Built-in Interactions

Builtin interactions are higher‑level, semantic event types (e.g., `press`, `longPress`, arrow keys) exported as string constants. Consume them just like native events by using computed keys in your listener map. When you bind one, the necessary underlying host events are set up automatically.

```tsx
import { on } from 'remix/interaction'
import { press, longPress } from 'remix/interaction/press'

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
import { on } from 'remix/interaction'

on(button, {
  click: {
    capture: true,
    listener(event) {
      console.log('capture phase')
    },
  },
  focus: {
    once: true,
    listener(event) {
      console.log('focused once')
    },
  },
})
```

### Updating listeners efficiently

Use `createContainer` when you need to update listeners in place (e.g., in a component system). The container diffs and updates existing bindings without unnecessary `removeEventListener`/`addEventListener` churn.

```ts
import { createContainer } from 'remix/interaction'

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
import { on, createContainer } from 'remix/interaction'

// Using the function returned from on()
let dispose = on(button, { click: () => {} })
dispose()

// Containers
let container = createContainer(window)
container.set({ resize: () => {} })
container.dispose()

// Use a signal
let eventsController = new AbortController()
let container = createContainer(window, {
  signal: eventsController.signal,
})
container.set({ resize: () => {} })
eventsController.abort()
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
import { defineInteraction, on, type Interaction } from 'remix/interaction'

// Provide type safety for consumers
declare global {
  interface HTMLElementEventMap {
    [keydownEnter]: KeyboardEvent
  }
}

function KeydownEnter(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return

  handle.on(handle.target, {
    keydown(event) {
      if (event.key === 'Enter') {
        handle.target.dispatchEvent(new KeyboardEvent(keydownEnter, { key: 'Enter' }))
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

Use `TypedEventTarget<eventMap>` to get type-safe `addEventListener` and integrate with this library's `on` helpers.

```ts
import { TypedEventTarget, on } from 'remix/interaction'

interface DrummerEventMap {
  kick: DrummerEvent
  snare: DrummerEvent
  hat: DrummerEvent
}

class DrummerEvent extends Event {
  constructor(type: keyof DrummerEventMap) {
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

// native API is NOT typed
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

## Demos

To run the demos:

```sh
pnpm run demos
```

The [`demos` directory](https://github.com/remix-run/remix/tree/main/packages/interaction/demos) contains working demos:

- [`demos/async`](https://github.com/remix-run/remix/tree/main/packages/interaction/demos/async) - Async listeners with abort signal
- [`demos/basic`](https://github.com/remix-run/remix/tree/main/packages/interaction/demos/basic) - Basic event handling
- [`demos/form`](https://github.com/remix-run/remix/tree/main/packages/interaction/demos/form) - Form event handling
- [`demos/keys`](https://github.com/remix-run/remix/tree/main/packages/interaction/demos/keys) - Keyboard interactions
- [`demos/popover`](https://github.com/remix-run/remix/tree/main/packages/interaction/demos/popover) - Popover interactions
- [`demos/press`](https://github.com/remix-run/remix/tree/main/packages/interaction/demos/press) - Press and long press interactions

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
