# Remix Events

Semantic, type-safe events for any EventTarget.

## Background

Building interactive UIs often requires complex event patterns: hover intent, press gestures, escape handling, outer-click, etc. These patterns typically involve:

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

Each item in the array adds calls `target.addEventListener`, so event semantics are identical to the raw version (because they are the same thing in the end).

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
        this.dispatch(event)
      }
    }),
  ]
}

export const enterKeyDown = createBinder(EnterKeyDown)
```

Usage:

```ts
import { enterKeyDown, EnterKeyDown } from './example/enter.ts'

let button = document.createElement('button')

events(button).on([
  bind(EnterKeyDown, (event) => {
    console.log('Enter key pressed')
  }),

  // equivalent to above:
  enterKeyDown((event) => {
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
        this.dispatch(event)
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
      this.dispatch(event)
    }
  })
}
```

## API

## events

```ts
events(target, initialDescriptors?: EventDescriptor<Target>[]): EventContainer | Cleanup
```

## EventHandle API

---

```tsx
function MyButton() {
  return (
    <button
      on={[
        dom.click((event) => {
          console.log('Clicked at', event.clientX, event.clientY)
        }),

        dom.keydown((event) => {
          if (event.key === 'Enter') {
            console.log('Enter pressed')
          }
        }),
      ]}
    >
      Click me
    </button>
  )
}
```

### Window and Document Events

Handle window and document events with `events` with the same API as the `on` prop.

```tsx
import type { Handle } from 'remix/component'
import { events, win, doc } from 'remix/events'

function App(this: Handle) {
  this.afterRender(() => {
    let cleanupWindow = events(window, [
      win.resize(() => {
        console.log('Window resized')
      }),
    ])

    let cleanupDocument = events(document, [
      doc.visibilitychange(() => {
        if (document.hidden) {
          pauseAnimations()
        } else {
          resumeAnimations()
        }
      }),

      doc.selectionchange(() => {
        let selection = document.getSelection()
        if (selection.toString().length > 0) {
          showFormattingToolbar()
        } else {
          hideFormattingToolbar()
        }
      }),
    ])

    return [cleanupWindow, cleanupDocument]
  })

  return () => {
    // ...
  }
}
```

If your handlers depend on render props, add handlers in the render scope, they will be updated efficiently.

```tsx
function KeyboardShortcuts() {
  // create an event container in setup
  let windowEvents = events(window)

  return (props) => {
    // add/update the handlers in render with container.on()
    windowEvents.on([
      win.keyup((event) => {
        if (event.key === 'Escape') {
          props.onClose()
        }
      }),
    ])

    return (
      <div>
        <h2>Available Keyboard Shortcuts</h2>
        {/*...*/}
      </div>
    )
  }
}
```

## Built-in Interactions

Interactions are stateful event handlers that compose multiple DOM events into higher-level user behaviors:

```tsx
import type { Handle } from 'remix/component'
import { press, outerPress, escape, hoverAim } from 'remix/interactions'

function ExampleModal(this: Handle) {
  let isOpen = false

  let openModal = () => {
    isOpen = true
    this.render()
  }

  let closeModal = () => {
    isOpen = false
    this.render()
  }

  return () => (
    <>
      <button
        // open on normalized "click" (mouse/keyboard/pen/touch)
        on={press(openModal)}
      >
        Open Modal
      </button>

      {isOpen && (
        <div
          on={[
            // close on "outer click"
            outerPress(closeModal),

            // close on keyboard escape key
            escape(closeModal),
          ]}
        >
          <div>
            <h2>Modal Content</h2>
            <p>This modal closes when you click outside or press escape!</p>
          </div>
        </div>
      )}
    </>
  )
}
```

### Available Interactions

- `press`, `pressDown`, `pressUp`, `pressMove`, `outerPress` - Normalized press across mouse, keyboard, touch, and pen input with hit/release boxes
- `escape` - Handle escape key presses
- And more...

## Creating Custom Interactions

Create your own stateful interactions with `createInteraction` and `events`:

Here's a music app interaction that tracks tap timing to calculate tempo in BPM. Users tap repeatedly and the interaction dispatches the average tempo:

The `tempoTap` interaction manages tap timing, interval calculations, and automatic reset logic with options:

```ts
import { createInteraction, dom } from 'remix/events'

export let tempoTap = createInteraction('tempoTap', ({ target, dispatch }, options = {}) => {
  let taps = []
  let minTaps = options.minTaps ?? 4
  let maxInterval = options.maxInterval ?? 2000 // Reset if gap too long
  let resetTimer: number

  // event handler for both touchstart and mousedown
  let handleTap = () => {
    let now = Date.now()

    // Clear reset timer
    clearTimeout(resetTimer)

    // Add this tap
    taps.push(now)

    // Keep only recent taps within max interval
    taps = taps.filter((tap) => now - tap < maxInterval)

    // Need at least minTaps to calculate tempo
    if (taps.length >= minTaps) {
      // Calculate intervals between taps
      let intervals = []
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1])
      }

      // Average interval in milliseconds
      let avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

      // Convert to BPM (beats per minute)
      let bpm = Math.round(60000 / avgInterval)

      // dispatch the event with the tempo
      dispatch({ detail: { tempo: bpm } })
    }

    // Reset if no taps for a while
    resetTimer = setTimeout(() => {
      taps = []
    }, maxInterval)
  }

  let cleanup = events(target, [
    dom.mousedown((event) => handleTap()),
    dom.touchstart((event) => handleTap()),
  ])

  // return cleanup functions
  return [cleanup, () => clearTimeout(resetTimer)]
})
```

Complex timing logic, state management, and cleanup are encapsulated in a reusable `tempoTap` interaction, allowing components to only manage the state relevant to rendering.

```tsx
import { tempoTap } from './tempoTap.ts'

function TempoTapper(this: Handle) {
  let tempo = 120

  return () => (
    <div>
      <h2>Tap to Set Tempo</h2>

      <button
        on={tempoTap(
          (event) => {
            tempo = event.detail.tempo
            this.render()
          },
          { minTaps: 3 },
        )}
      >
        Tap for Tempo
      </button>

      <p>
        Current Tempo: <strong>{tempo} BPM</strong>
      </p>
    </div>
  )
}
```

## Event Composition & preventDefault

Events compose like middleware. When an event handler calls `preventDefault()`, later handlers of the same event type are skipped:

```tsx
function Link(this: Handle, { href, on, children }) {
  return () => (
    <a
      href={href}
      on={[
        // Consumer's events run first
        ...on,

        // Our navigation logic runs only if not prevented
        dom.click((event) => {
          event.preventDefault()
          window.history.pushState(null, '', href)
          updatePage()
        }),
      ]}
    >
      {children}
    </a>
  )
}

// Usage - consumer can prevent default navigation
function App() {
  return (
    <SmartLink
      href="/about"
      on={[
        dom.click((event) => {
          if (shouldPreventNavigation()) {
            event.preventDefault() // Stops the navigation logic
          }
        }),
      ]}
    >
      About Us
    </SmartLink>
  )
}
```

This makes component composition intuitive: consumer handlers run first and can prevent component behavior automatically, no coordination boilerplate needed.

## Beyond DOM Events

Remix Events works with any `EventTarget`, including WebSockets and XMLHttpRequest:

```tsx
import { events, ws } from 'remix/events'

let socket = new WebSocket('wss://api.example.com')

events(socket, [
  ws.open(() => console.log('Connected')),
  ws.message((event) => console.log('Message:', event.data)),
  ws.close((event) => console.log('Disconnected:', event.code)),
  retry(() => {}),
  slow(() => {}),
  recover(() => {}),
])
```
