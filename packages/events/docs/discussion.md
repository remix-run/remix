# Remix Events Discussion: Why and What

Given that:

1. JavaScript runtimes have event targets everywhere: HTMLElement, Element, Window, Document, XMLHttpRequest, EventStream, NavigationHistoryEntry, Notification, OffscreenCanvas, PaymentRequest, Performance, ServiceWorker, RTCPeerConnection, AbortSignal, the list goes on.

2. Events are the primary source of state and behavior in a user interface and the targets that dispatch them are Elements.

3. Events can be re-entered from user interactions

This package provides light abstractions to make:

- Custom EventTarget sub-classes type safe
- Event consumption declarative and composable, simplifying component composition and state driven UI
- Defining your own declarative "interactions" that encapsulate state and events into semantic, reusable event bindings
- Dealing with reentry easy with AbortSignals

## Declarative Event Consumption

### Background

Components regularly wrap other components and need to keep their original props/events contract. Consider a `Link` component for working with pushState.

```tsx
function Link(props) {
  return (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault()
        clientRouter.navigate(props.href)
      }}
      onMouseEnter={(event) => {
        router.prefetch()
      }}
      onFocus={(event) => {
        router.prefetch()
      }}
    />
  )
}
```

This is fine until the consumer wants to add their own events:

```tsx
<Link
  onClick={(event) => {
    // won't be called
  }}
/>
```

So you add some code to call the consumer's events:

```tsx
function Link(props) {
  return (
    <a
      {...props}
      onClick={(event) => {
        if (props.onClick) {
          props.onClick(event)
        }
        event.preventDefault()
        clientRouter.navigate(props.href)
      }}
      onMouseEnter={(event) => {
        if (props.onMouseEnter) {
          props.onMouseEnter(event)
        }
        router.prefetch()
      }}
      onFocus={(event) => {
        if (props.onFocus) {
          props.onFocus(event)
        }
        router.prefetch()
      }}
    />
  )
}
```

But now what if the consumer wants to stop the Link's behavior? In React the common approach is to sort of hijack `event.preventDefault` semantics, and have consumers to call it to stop the Link's internal behavior:

```tsx
function Link(props) {
  return (
    <a
      {...props}
      onClick={(event) => {
        if (props.onClick) {
          props.onClick(event)
          if (event.defaultPrevented) {
            return
          }
        }
        event.preventDefault()
        clientRouter.navigate(props.href)
      }}
      onMouseEnter={(event) => {
        if (props.onMouseEnter) {
          props.onMouseEnter(event)
          if (event.defaultPrevented) {
            return
          }
        }
        router.prefetch()
      }}
      onFocus={(event) => {
        if (props.onFocus) {
          props.onFocus(event)
          if (event.defaultPrevented) {
            return
          }
        }
        router.prefetch()
      }}
    />
  )
}
```

```tsx
<Link
  onClick={(event) => {
    if (someCheck) {
      event.preventDefault()
    }
  }}
/>
```

So there are a couple of concerns here:

1. How do you "compose" consumer's events with internal component events?
2. How do consumers stop the internal events from running?

The friction for both comes from the fact that most component libraries' event APIs only allow for a single event on any given host element, so

- components need to manually combine multiple listeners (consumers and internal) into a single listener
- components only obvious option to prevent internal listeners is to hijack `event.preventDefault`

If components could define multiple events of the same type on a single element, this all gets much simpler.

### Multiple Events and Component Composition

Consider the Remix version of this Link component. It allows multiple events of the same type to be added to a single element, so the only consideration is merging `props.on`:

```tsx
function Link(props) {
  return (
    <a
      on={[
        ...props.on,
        dom.click((event) => {
          event.preventDefault()
          router.navigate(props.href)
        }),
        dom.focus(() => router.prefetch(props.href)),
        dom.mouseenter(() => router.prefetch(props.href)),
      ]}
    />
  )
}
```

Consumers can stop the internal listeners with the built-in `event.stopImmediatePropagation()`, `Link` doesn't need to do anything.

```tsx
<Link
  on={dom.click((event) => {
    if (someCheck) {
      event.stopImmediatePropagation()
    }
  })}
/>
```

This package provides the implementation that the Remix Component `on` prop uses.

### Event reconciliation

The Remix component model is built on declarative JSX elements that are "reconciled" between updates so that only the smallest change to the dom is required. Events are reconciled similarly, they are only removed/added when the types change, otherwise the listeners are simply updated in place.

```tsx
let container = createEventContainer(target)

// first set of events are added
container.on([
  bind('click', () => {
    console.log(1)
  }),
  bind('focus', () => {
    console.log(2)
  }),
  bind('mouseenter', () => {
    console.log(3)
  }),
])

// later only the listeners are updated internally, no removeEventListener/addEventListener thrashing
container.on([
  bind('click', () => {
    console.log(4)
  }),
  bind('focus', () => {
    console.log(5)
  }),
  bind('mouseenter', () => {
    console.log(6)
  }),
])
```

## Interactions

Component logic is often filled with state coordination between multiple events on an element. This state is never rendered, but is built up over time to eventually change some other, rendered state.

We'll illustrate with a component that shows a menu on "long press". Please note this is a naive implementation for illustrative purposes:

```tsx
function MyComponent(this: Remix.Handle) {
  let longPressed = false
  let longPressTimer: number

  let show = false
  const onLongPress = () => {
    show = true
    this.update()
  }

  return () => (
    <div
      on={[
        bind('pointerdown', (event, signal) => {
          clearTimeout(longPressTimer)
          longPressTimer = setTimeout(() => {
            longPressed = true
            onLongPress()
          }, 3000)
        }),
        bind('pointerleave', () => {
          clearTimeout(longPressTimer)
        }),
        bind('click', (event) => {
          if (longPressed) {
            event.preventDefault()
            longPressed = false
          } else {
            clearTimeout(longPressTimer)
          }
        }),
      ]}
    >
      <div>Some row item</div>
      {show && <ActionsPopover />}
    </div>
  )
}
```

Note the amount of component code to coordinate the long press that ultimately just results in `show` being toggled. Like components, Remix "interactions" give you a place to encapsulate, compose, and share this kind of behavior.

Interactions look exactly like components except they:

- return event bindings instead of elements
- dispatch events instead of `this.update()`

Let's turn this long press into its own interaction:

```tsx
// Interaction definition
function LongPress(this: Interaction<PointerEvent>) {
  let longPressed = false
  let longPressTimer: number

  return [
    bind('pointerdown', (event, signal) => {
      clearTimeout(longPressTimer)
      longPressTimer = setTimeout(() => {
        longPressed = true
        this.dispatchEvent(new PointerEvent('long-press'))
      }, 3000)
    }),
    bind('pointerleave', () => {
      clearTimeout(longPressTimer)
    }),
    bind('click', (event) => {
      if (longPressed) {
        event.preventDefault()
        longPressed = false
      } else {
        clearTimeout(longPressTimer)
      }
    }),
  ]
}

// create event binder for consumption
export let longPress = createInteractionBinder(LongPress, 'long-press')
```

Now we can use it like any other event:

```tsx
import { LongPress } from './long-press.ts'

function MyComponent(this: Remix.Handle) {
  let show = false
  return () => (
    <div
      on={longPress((event) => {
        //             ^? PointerEvent
        show = true
        this.update()
      })}
    >
      <div>Some row item</div>
      {show && <ActionsPopover />}
    </div>
  )
}
```

Note that all the logic and state is gone from the component. Additionally, any element can now use 'long-press'.

The `createInteractionBinder` isn't required, but it cleans up some boilerplate. Here's how to use interactions with `bind` directly.

```tsx
<div
  on={bind([LongPress, 'long-press'], (event) => {
    console.log(event)
  })}
/>
```

## Typed EventTargets

### Background

The platform's EventTargets are typesafe, you receive:

- Hints for event types in `addEventListener`
- Typesafe `event` objects in listeners

For example:

```tsx
let button = document.createElement('button')

button.addEventListener(
  'click',
  // ^ hints here
  // v type safety here
  (event) => {
    // ^? PointerEvent
  },
)
```

Each event type maps to an event class: `"click"` maps to `PointerEvent` while "keydown" maps to `KeyboardEvent`:

```tsx
button.addEventListener('keydown', (event) => {
  console.log(event instanceof KeyboardEvent)
})
```

The HTMLElement map is over 100 entries long! Service workers have just three so it's a simpler example to illustrate:

```ts
interface ServiceWorkerContainerEventMap {
  controllerchange: Event
  message: MessageEvent
  messageerror: MessageEvent
}
```

Depending on the type you're listening to on the left you'll receive an event instance on the right.

```tsx
navigator.serviceWorker.addEventListener('message', (event) => {
  console.log(event instanceof MessageEvent)
})
```

You can extend EventTarget with your own logic, like a web audio wrapper to play the drums:

```tsx
// extend event target
class Drummer extends EventTarget {
  play() {
    // work with the web audio API
    this.dispatchEvent(new DrummerEvent('play'))
  }
}

// Can even extend Event with your own event sub class
class DrummerEvent extends Event {
  constructor(public type: keyof DrummerEventMap) {
    super(type)
  }
}

// create an instance
let drummer = new Drummer()

// add a listener
drummer.addEventListener('play', (event) => {
  console.log(event instanceof DrummerEvent) // true
})
```

EventTarget subclasses are a great place to put business logic and dispatch events for UIs to update. However, you don't get any type safety like the built-in event targets.

### `TypedEventTarget`

This class allows you to define your own EventTarget subclasses with the same type safety as the built-ins.

```tsx
import { TypedEventTarget } from '@remix-run/events'

// 1. Define your event target's event map
interface DrummerEventMap {
  play: DrummerEvent
  kick: DrummerEvent
  snare: DrummerEvent
  hat: DrummerEvent
}

class DrummerEvent extends Event {
  // 2. Use it to restrict the types when create a DrummerEvent with `keyof`
  constructor(public type: keyof DrummerEventMap) {
    super(type)
  }
}

// 3. Define your EventTarget subclass with the event map
class Drummer extends TypedEventTarget<DrummerEventMap> {
  play() {
    // eventually dispatch your events
    this.dispatchEvent(new DrummerEvent('play'))
  }
}
```

By using `TypedEventTarget`, consumers will now receive all the same type safety as built-in EventTargets:

```tsx
let drummer = new Drummer()

drummer.addEventListener(
  'play',
  // ^ type hints here
  // v type safety here
  (event) => {
    // ^? DrummerEvent
    console.log(event instanceof DrummerEvent)
  },
)
```

Nothing is different about the runtime. You can simply swap out for a regular EventTarget subclass and the only difference is you lose the types:

```tsx
class Drummer extends EventTarget {
  play() {
    this.dispatchEvent(new DrummerEvent('play'))
  }
}
let drummer = new Drummer()
// no type hints
drummer.addEventListener('play', (event) => {
  console.log(event instanceof DrummerEvent) // still true, but typescript doesn't know
})
```

All event targets can be consumed with `events(target)` as well.

```tsx
events(drummer).on([
  bind('play', (event) => {
    //           ^? DrummerEvent
    console.log('playing')
  }),
])
```
