# Remix Events

Enhanced events for any [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget).

- Semantic, reusable "Interactions" like `press`, `arrowUp`, etc.
- Declarative bindings designed for component composition
- Async listener reentry protection with AbortSignals
- Type safety on any EventTarget or sub class

## Background

Building interactive UIs often requires complex event patterns: press gestures, escape handling, outer-click, etc. Additionally a significant amount of application state is ephemeral among events until an eventual condition is met when the UI needs to update. These patterns typically involve:

- Managing timers and state across multiple events
- Coordinating between element, document, and window events
- Recreating common interaction patterns across projects and components

Remix Events simplifies, encapsulates, and composes these tasks into higher-level, reusable interactions.

Secondarily, Remix Events simplifies component composition by simply spreading consumer props into library components with no need to think about events of the same type between consumer and library.

## Installation

```bash
npm install @remix-run/events
```

## Basics

Add events to targets with `events` and `bind`:

```tsx
import { events, bind } from '@remix-run/events'

let button = document.createElement('button')

events(button).on([
  bind('click', (event) => {
    console.log('clicked', event.currentTarget)
  }),
  bind('focus', (event) => {
    console.log('focused', event.currentTarget)
  }),
])
```

This is equivalent to the following raw DOM implementation:

```tsx
let button = document.createElement('button')

button.addEventListener('click', (event) => {
  console.log('clicked', event.currentTarget)
})

button.addEventListener('focus', (event) => {
  console.log('clicked', event.currentTarget)
})
```

### `dom`

The `dom` export is a convenient, typed proxy object of all available `Element` events.

```tsx
import { events, dom } from '@remix-run/events'

let button = document.createElement('button')

events(button).on([
  dom.click((event) => {
    console.log('clicked', event.currentTarget)
  }),
  dom.focus((event) => {
    console.log('focused', event.currentTarget)
  }),
])
```

### Event Listener Options

All [addEventListener options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options) are passed through:

```tsx
events(document).on([
  dom.click(
    (event) => {
      console.log('captured clicked', event.target)
    },
    { capture: true },
  ),
])
```

### Event Semantics

Each item in the array maps to a call to `target.addEventListener`, so event semantics are identical to the raw version (because they are the same thing in the end).

For example, `event.stopImmediatePropagation()` will stop later events from firing.

```tsx
events(button).on([
  dom.click((event) => {
    console.log('first')
    event.stopImmediatePropagation()
  }),
  dom.click((event) => {
    // will not be called because of stopImmediatePropagation
    console.log('second')
  }),
])
```

## Arrays and Single Bindings

You can use arrays or single bindings.

```tsx
events(button).on([
  dom.click((event) => {
    console.log('clicked', event.currentTarget)
  }),
])

events(button).on(
  dom.click((event) => {
    console.log('clicked', event.currentTarget)
  }),
)
```

## Cleanup with AbortSignal

Pass an AbortSignal to `events` to manage cleanup.

```tsx
let controller = new AbortController()
let button = document.createElement('button')

events(button, controller.signal).on([
  dom.click((event) => {
    console.log('clicked', event.currentTarget)
  }),
])

// removes all event listeners
controller.abort()
```

### Individual Binding Signals

Individual bindings can be given a signal to manage cleanup separately from the container.

```tsx
let controller = new AbortController()
let button = document.createElement('button')

let focusController = new AbortController()

events(button, controller.signal).on([
  dom.focus(
    (event) => console.log('focused'),
    // has its own signal for cleanup
    { signal: focusController.signal },
  ),

  dom.click(() => console.log('clicked')),
])

// only cleans up focus handler
focusController.abort()
```

## Reentry Signals

Every event listener is passed an [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) that can be used to check reentry into the listener.

```tsx
let input = document.createElement('input')
let controller = new AbortController()

events(input).on([
  dom.input(async (event, signal) => {
    showLoading()
    let path = `/api/search?q=${event.currentTarget.value}`

    // pass the signal to fetch
    let result = await fetch(path, { signal })

    // if the signal is aborted, this code will not run
    showResults(result)
  }),
])
```

For APIs that don't accept a signal, you can check `signal.aborted` after async code to avoid running code in the stale listener execution.

```tsx
events(input).on([
  dom.input(async (event, signal) => {
    showLoading()
    let result = await someSDK.search(event.currentTarget.value)
    // manually check for aborted signal and exit early
    if (signal.aborted) return
    showResults(result)
  }),
])
```

When the `events` signal is aborted, all event listener signals are also aborted.

```tsx
let controller = new AbortController()

events(input, controller.signal).on([
  dom.input(async (event, signal) => {
    showLoading()
    let result = await fetch(path, { signal })
    showResults(result)
  }),
])

controller.abort() // aborts the dom.input listener signal
```

## Interactions

Interactions are to events as Components are to elements. They are functions that encapsulate state and events into a higher level "interaction".

```tsx
import { type EventHandle, createBinder, bind } from '@remix-run/events'

// An Interaction that dispatches on keydown of "Enter"
export function EnterKeyDown(this: EventHandle) {
  return [
    dom.keydown((event) => {
      if (event.key === 'Enter') {
        this.dispatchEvent(new KeyboardEvent('keydown:enter', { key: 'Enter' }))
      }
    }),
  ]
}

export const enterKeyDown = createInteractionBinder(EnterKeyDown, 'keydown:enter')
```

Usage:

```ts
import { enterKeyDown, EnterKeyDown } from './example/enter.ts'

let button = document.createElement('button')

events(button).on([
  enterKeyDown((event) => {
    console.log('Enter key pressed')
  }),

  // equivalent to above but manual
  bind([EnterKeyDown, 'keydown:enter'], (event) => {
    console.log('Enter key pressed')
  }),
])
```

### Typed Dispatch

Define the type of event dispatched with the EventHandle generic:

```tsx
export function EnterKeyDown(this: EventHandle<KeyboardEvent>) {
  return [
    dom.keydown((event) => {
      if (event.key === 'Enter') {
        this.dispatchEvent(new KeyboardEvent('keydown:enter', { key: 'Enter' }))
      }
    }),
  ]
}
```

### Stateful Interactions

Interactions can manage state in their closure:

```tsx
function TripleClick(this: EventHandle) {
  let count = 0
  let timeout: number

  return dom.click((event, signal) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (signal.aborted) return
      count = 0
    }, 500)

    if (++count === 3) {
      count = 0
      this.dispatchEvent(new PointerEvent('triple-click'))
    }
  })
}
```

```tsx
class TempoEvent extends Event {
  constructor(
    public type: 'tempo-change' | 'tempo-reset',
    public tempo: number,
  ) {
    super(type, { bubbles: false })
  }
}

export function Tempo(this: InteractionHandle<TempoEvent>) {
  let taps: number[] = []
  let resetTimer: number
  let tempo = 0

  this.signal.addEventListener('abort', () => {
    clearTimeout(resetTimer)
  })

  let calculateTempo = () => {
    // ...
  }

  let handleTap = () => {
    taps.push(Date.now())
    tempo = calculateTempo()
    this.dispatchEvent(new TempoEvent('tempo:change', tempo))
    resetTimer = window.setTimeout(() => {
      taps = []
      this.dispatchEvent(new TempoEvent('tempo:reset', tempo))
    }, 4000)
  }

  return [
    dom.pointerdown(handleTap),
    dom.keydown((event) => {
      if (event.key === 'Enter') {
        handleTap()
      }
    }),
  ]
}
```

```tsx
function App() {
  return (
    <form
      on={bind('submit', (event) => {
        console.log('submitted')
      })}
    >
      <button
        on={[
          bind('click', (event) => {
            console.log('clicked')
          }),
          bind('focus', () => {}),
          bind('pointerdown', () => {}),
        ]}
      />
    </form>
  )
}

function App() {
  return (
    <form
      on={dom.submit((event) => {
        console.log('submitted')
      })}
    >
      <button
        on={[
          dom.click((event) => {
            console.log('clicked')
          }),
          dom.focus(() => {}),
          dom.pointerdown(() => {}),
        ]}
      />
    </form>
  )
}
```
