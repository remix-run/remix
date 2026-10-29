# component

A minimal component system built on JavaScript and DOM primitives. Write components that render on
the server, stream to the browser, and hydrate only where you need interactivity.

## Features

- Component runtime APIs for rendering, hydration, link and form frame navigation, and JSX
- Server rendering APIs for streaming component trees and frames
- `mix` composition with event, ref, and CSS helpers
- Lower-level utilities for events, refs, attributes, and rendering lifecycle

## Installation

```sh
npm i remix
```

## Usage

Components receive a handle and return a render function. Local state stays in ordinary JavaScript
variables, and `handle.update()` explicitly schedules another render:

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function Counter(handle: Handle<{ initialCount?: number }>) {
  let count = handle.props.initialCount ?? 0

  return () => (
    <button
      type="button"
      mix={on('click', () => {
        count++
        void handle.update()
      })}
    >
      Count: {count}
    </button>
  )
}
```

## Components

A component is a function that receives a `handle` and returns a render function. The outer function is the setup scope. It runs once per component instance, so variables declared there persist for the instance's lifetime. The render function runs on the first render and again on every update:

```tsx
import type { Handle } from 'remix/component'

function Price(handle: Handle<{ amount: number; currency: string }>) {
  // Setup: runs once per instance
  let format = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: handle.props.currency,
  })

  // Render: runs on the first render and on every update
  return () => <span>{format.format(handle.props.amount)}</span>
}
```

Values read from `handle.props` during setup are the initial props. `Price` keeps its first `currency` even if the parent later passes a different one, while `amount` updates because render reads it. Read props inside render, or inside callbacks, whenever the component should follow changes.

### Lifecycle

1. **First render:** The runtime calls the component function with a handle whose `props` are already set, then calls the returned render function. After the result is committed to the DOM, tasks queued with `handle.queueTask()` run.
2. **Updates:** The runtime replaces the values on `handle.props` and calls the render function again. Setup does not run again. Tasks queued during the update run after the commit.
3. **Removal:** `handle.signal` is aborted, so listeners registered with `{ signal: handle.signal }` are removed. Queued tasks that haven't run yet still run, with an aborted signal.

During server rendering, setup and render run, but `handle.update()` throws and `handle.queueTask()` does nothing. Start timers, read the DOM, and do other browser-only work in queued tasks, event handlers, or mixin lifecycle events.

## Handle

| Member                   | Use                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handle.props`           | The current props. The object stays the same across renders, and its values are replaced before each render.                                                                                   |
| `handle.update()`        | Schedules a render. Returns a promise that resolves with an `AbortSignal` after the update commits. The signal is aborted when the component renders again or is removed.                      |
| `handle.queueTask(task)` | Runs `task` after the next commit. The task receives an `AbortSignal` that is aborted when the component renders again or is removed.                                                          |
| `handle.signal`          | Aborted when the component is removed. Use it to clean up work started in setup.                                                                                                               |
| `handle.id`              | A stable ID for the instance, for `htmlFor`, `aria-controls`, and similar attributes.                                                                                                          |
| `handle.context`         | Provides values to descendants and reads values from ancestors. See [Context](#context).                                                                                                       |
| `handle.frame`           | The nearest [frame](#frames). Call `handle.frame.reload()` to fetch its content again.                                                                                                         |
| `handle.frames`          | `handle.frames.top` is the root frame of the runtime tree. `handle.frames.get(name)` finds a mounted frame by its `name` prop, or returns `undefined` when no frame with that name is mounted. |

### Updates

Call `handle.update()` from event handlers, queued tasks, timers, and subscriptions. Calling it during setup warns and skips the extra render, because the first render follows setup anyway. Calling it during render throws. When render discovers work that should happen after the commit, queue it with [`handle.queueTask()`](#queued-tasks).

Await `handle.update()` when the next step needs the updated DOM:

```tsx
import { on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

function Disclosure(handle: Handle) {
  let open = false
  let closeButton: HTMLButtonElement

  return () => (
    <div>
      <button
        type="button"
        mix={on('click', async () => {
          open = true
          await handle.update()
          closeButton.focus()
        })}
      >
        Show details
      </button>
      {open && (
        <div role="region">
          <button type="button" mix={ref((node) => (closeButton = node))}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
```

### Queued Tasks

`handle.queueTask(task)` runs `task` after the next commit, once the rendered output is in the DOM. Use it for work that render discovers but can't do itself, such as loading data for a prop, measuring layout, or moving focus. Queued tasks never run during server rendering.

The task receives an `AbortSignal` that is aborted when the component renders again or is removed. A task queued from render is queued again on every render, so guard it with the prop value it depends on. Otherwise the task's own `handle.update()` renders again and queues the work again:

```tsx
import type { Handle } from 'remix/component'

function UserCard(handle: Handle<{ userId: string }>) {
  let user: { name: string } | undefined
  let error: string | undefined
  let loadedId: string | undefined

  return () => {
    let { userId } = handle.props
    let loading = userId !== loadedId

    if (loading) {
      handle.queueTask(async (signal) => {
        try {
          let response = await fetch(`/api/users/${userId}`, { signal })
          let data = await response.json()
          if (signal.aborted) return
          user = data
          error = undefined
        } catch (caught) {
          if (signal.aborted) return
          error = caught instanceof Error ? caught.message : 'Failed to load user'
        }
        loadedId = userId
        handle.update()
      })
    }

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>
    return <p>{user?.name}</p>
  }
}
```

When `userId` changes, the next render aborts the previous request and queues one for the new ID. Any other render while a request is in flight also aborts it, and that render queues it again, so only the latest request for the current `userId` completes. Catch errors inside async tasks. Remix doesn't handle a rejected task, and aborting a `fetch()` rejects it.

For a one-time load that should ignore later prop changes, queue the task from setup instead of render, and pass `handle.signal` to `fetch()`. A task queued from setup runs once after the first render, and `handle.signal` is only aborted when the component is removed, so later renders don't cancel the request.

### Abort Signals

Each signal covers a different lifetime. Pass the narrowest one to `fetch()` and other cancellable work:

| Signal                                   | Aborted when                                           |
| ---------------------------------------- | ------------------------------------------------------ |
| The second argument to an `on()` handler | The same handler runs again, or its element is removed |
| The argument to a queued task            | The component renders again, or is removed             |
| The signal resolved by `handle.update()` | The component renders again, or is removed             |
| `handle.signal`                          | The component is removed                               |

### Context

A provider declares its context type as the second `Handle` type parameter and calls `handle.context.set(value)`. Descendants read the value with `handle.context.get(Provider)`:

```tsx
import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

function Settings(handle: Handle<{ children?: RemixNode }, { compact: boolean }>) {
  let compact = false
  handle.context.set({ compact })

  return () => (
    <div>
      <button
        type="button"
        mix={on('click', () => {
          compact = !compact
          handle.context.set({ compact })
          handle.update()
        })}
      >
        Toggle density
      </button>
      {handle.props.children}
    </div>
  )
}

function Row(handle: Handle<{ label: string }>) {
  return () => {
    let { compact } = handle.context.get(Settings)
    return <li style={{ padding: compact ? '2px' : '8px' }}>{handle.props.label}</li>
  }
}
```

- Context is keyed by the provider component itself. `get(Settings)` reads the nearest ancestor rendered by exactly `Settings`, so a nested `Settings` shadows an outer one, and different providers never collide.
- `set()` replaces the value but doesn't schedule a render. Call `handle.update()` on the provider when descendants should render with the new value.
- Read context inside render when the provider replaces its value. A value read during setup stays the value from that setup call. A stable object that the provider never replaces, such as a `TypedEventTarget` from `remix/component`, can be read once in setup and subscribed to.
- At runtime, `get()` returns `undefined` when no matching provider is an ancestor.

When several public components should provide the same logical scope, render one shared provider from each of them, so descendants read a single provider type regardless of which component wraps them:

```tsx
import type { Handle, RemixNode } from 'remix/component'

function MenuScope(handle: Handle<{ children?: RemixNode }, { id: string }>) {
  handle.context.set({ id: handle.id })
  return () => handle.props.children
}

function MenuRoot(handle: Handle<{ children?: RemixNode }>) {
  return () => <MenuScope>{handle.props.children}</MenuScope>
}

function MenuGroup(handle: Handle<{ children?: RemixNode }>) {
  return () => <MenuScope>{handle.props.children}</MenuScope>
}

function MenuTrigger(handle: Handle) {
  let scope = handle.context.get(MenuScope)
  return () => <button aria-controls={scope.id}>Open</button>
}
```

### Frames From Components

`handle.frame` is the frame that contains the component. Use `handle.frames.top` when a nested component needs to reload the whole page instead of only its nearest frame:

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function RefreshAllButton(handle: Handle) {
  return () => (
    <button
      type="button"
      mix={on('click', async () => {
        await handle.frames.top.reload()
      })}
    >
      Refresh everything
    </button>
  )
}
```

`handle.frames.get(name)` finds a mounted frame by name. If several mounted frames share a name, it returns the most recently mounted one.

## Keys

Give list items a `key` when a list can be reordered, filtered, or added to. Elements and components with matching keys are moved instead of recreated, so they keep:

- their DOM nodes
- component state in setup scope
- focus and text selection
- input values the user has typed

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function ReorderableList(handle: Handle) {
  let items = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
    { id: 'c', label: 'Item C' },
  ]

  return () => (
    <div>
      <button
        type="button"
        mix={on('click', () => {
          items = [...items].reverse()
          handle.update()
        })}
      >
        Reverse list
      </button>
      {items.map((item) => (
        <div key={item.id}>
          <input type="text" defaultValue={item.label} />
        </div>
      ))}
    </div>
  )
}
```

Keys can be strings, numbers, or bigints, and must be unique among siblings. Use stable IDs from your data. An array index works only if the list never reorders, and a value created during render, such as `Math.random()`, makes every render look like a new item.

## Events

`on(type, handler, capture?)` is a mixin that attaches a DOM event listener to its host. The event type is checked against the host element, and `event.currentTarget` is typed as that element:

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function AlbumSearch(handle: Handle<{ searchHref: string }>) {
  let results: string[] = []
  let error: string | undefined

  return () => (
    <div>
      <input
        type="search"
        aria-label="Search albums"
        mix={on('input', async (event, signal) => {
          let url = new URL(handle.props.searchHref, window.location.href)
          url.searchParams.set('query', event.currentTarget.value)

          try {
            let response = await fetch(url, { signal })
            let data: { results: string[] } = await response.json()
            if (signal.aborted) return
            results = data.results
            error = undefined
          } catch {
            if (signal.aborted) return
            error = 'Search failed'
          }
          handle.update()
        })}
      />
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {results.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </div>
  )
}
```

- The handler's second argument is an `AbortSignal` that is aborted when the same handler runs again or its element is removed. Pass it to `fetch()` so a newer event cancels the older work.
- Remix doesn't handle a rejected async handler, and aborting a `fetch()` rejects it. Catch errors inside async handlers and check `signal.aborted` before using the result.
- Passing a new handler function on every render doesn't re-add the listener. Remix calls the latest handler and only rebinds when the event type or capture flag changes.
- Pass `true` as the third argument to listen during the capture phase.
- Several `on()` mixins for the same event run in `mix` order, so `event.stopImmediatePropagation()` in one handler skips the handlers after it.
- `on()` does nothing during server rendering.

To listen for your own events with full types, declare them on `HTMLElementEventMap`. See [Custom Events](#custom-events).

## Styling

`css(...)` turns a style object into a generated class and applies it through `mix`. The object mirrors CSS nesting:

```tsx
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

const toggleStyle = css({
  display: 'inline-flex',
  gap: '6px',
  padding: '8px 12px',
  border: '1px solid #d6d6d6',
  borderRadius: '6px',
  background: 'white',
  '&:hover': {
    borderColor: '#6d28d9',
  },
  '&[aria-pressed="true"]': {
    background: '#6d28d9',
    color: 'white',
  },
  '&::after': {
    content: '"✓"',
    visibility: 'hidden',
  },
  '&[aria-pressed="true"]::after': {
    visibility: 'visible',
  },
  '.label': {
    fontWeight: 600,
  },
  '@media (max-width: 40rem)': {
    padding: '12px 16px',
  },
})

function FavoriteToggle(handle: Handle) {
  let pressed = false

  return () => (
    <button
      type="button"
      aria-pressed={pressed}
      mix={[
        toggleStyle,
        on('click', () => {
          pressed = !pressed
          handle.update()
        }),
      ]}
    >
      <span class="label">Favorite</span>
    </button>
  )
}
```

### Nested Selectors

- `&` refers to the element itself, as in `'&:hover'`, `'&::before'`, `'&[aria-pressed="true"]'`, and `'& h2'`.
- Class names nest directly. `'.label'` styles descendants with the `label` class.
- Nested keys must start with `&`, `.`, `:`, `[`, or `@`. A bare element selector such as `h2` isn't treated as a selector, so write `'& h2'`.
- `@media`, `@supports`, and other at-rules can nest at any level.

Prefer state selectors such as `'&:hover .label'` or `'&[aria-expanded="true"]'` over tracking hover or focus in JavaScript and rendering again. The browser applies them without a render, and they work before the page hydrates.

### Dynamic Values

Each distinct style object becomes its own class and rule. Use `css(...)` for styles that come from a small set of states, and the `style` prop for values that change continuously, such as progress, coordinates, or transforms:

```tsx
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

const barStyle = css({ height: '4px', background: '#6d28d9', transformOrigin: 'left' })

function ProgressBar(handle: Handle<{ value: number }>) {
  return () => <div mix={barStyle} style={{ transform: `scaleX(${handle.props.value})` }} />
}
```

During server rendering, Remix collects the generated rules, deduplicates them, and puts them in `<style data-rmx-style>` tags in the document head, so server-rendered pages are styled before any JavaScript loads.

### Combining Styles

`mix` can hold several `css(...)` styles, and each one keeps its own class. When two of them set the same property, their order in `mix` does not decide which one wins. Each class takes its place in the cascade the first time it's added to the page, so the winner depends on which style rendered first:

```tsx
import { css } from 'remix/component'

const buttonStyle = css({ background: 'gray' })
const dangerStyle = css({ background: 'red' })

function DeleteButton() {
  // The background depends on which style the page inserted first, not on this order
  return () => <button mix={[buttonStyle, dangerStyle]}>Delete</button>
}
```

Combine styles that set different properties, such as layout and appearance. For variants, put the variant in one style behind a selector, or pass different values to a single `css(...)` call:

```tsx
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

const buttonStyle = css({
  background: 'gray',
  '&[data-variant="danger"]': {
    background: 'red',
  },
})

function Button(handle: Handle<{ label: string; variant?: 'danger' }>) {
  return () => (
    <button data-variant={handle.props.variant} mix={buttonStyle}>
      {handle.props.label}
    </button>
  )
}
```

### Cascade Layers

The component runtime emits generated `css(...)` rules under the `rmx` cascade layer. Each generated class gets its own sublayer, so a class such as `rmxc-k4a9f` is emitted as `@layer rmx.rmxc-k4a9f { ... }`. That keeps each class's place in the cascade the same across every root and frame on the page.

Unlayered CSS outranks layered CSS, so use explicit layer order when mixing generated styles with global styles. Put layers that should lose to generated styles before `rmx`:

```css
@layer base, rmx;

@layer base {
  button,
  input,
  textarea,
  select {
    font: inherit;
    margin: 0;
    padding: 0;
  }
}
```

For imported stylesheets, assign the layer in the import when your build supports it:

```css
@layer base, rmx;
@import './base.css' layer(base);
```

## Mixins

Mixins add behavior, attributes, and styles to a single host element through the `mix` prop. Pass one mixin, or an array that runs in order:

```tsx
<button type="button" mix={[buttonStyle, on('click', save)]}>
  Save
</button>
```

Remix includes these mixins, and [`createMixin()`](#custom-mixins) creates your own:

| Mixin                         | Use                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on(type, handler, capture?)` | Attaches an event listener. See [Events](#events).                                                                                                                                                      |
| `ref(callback)`               | Calls `callback(node, signal)` when the element is inserted and aborts `signal` when it's removed. It doesn't run again on later renders, or when a keyed element is reclaimed before removal finishes. |
| `attrs(defaults)`             | Supplies default props. Each default applies only while the element's own value for that prop is `undefined`.                                                                                           |
| `link(href, options?)`        | Adds client navigation to an element, with link semantics for elements that aren't anchors.                                                                                                             |
| `css(styles)`                 | Applies a generated class. See [Styling](#styling).                                                                                                                                                     |

### Custom Mixins

`createMixin(setup, options?)` creates a mixin factory. `setup` runs once per mixin slot on a host, and can return a render function that receives the factory's arguments followed by the host's current props:

```tsx
import { createMixin, on } from 'remix/component'

const clickCount = createMixin<HTMLElement, [label: string]>((handle) => {
  let count = 0

  return (label) => (
    <handle.element
      aria-label={`${label}: ${count} clicks`}
      mix={on('click', () => {
        count++
        handle.update()
      })}
    />
  )
})

function SaveButton() {
  return () => (
    <button type="button" mix={clickCount('Save')}>
      Save
    </button>
  )
}
```

- Return `<handle.element />` with the props to add or override. They're merged over the host's current props, so there's no need to spread them. Return `handle.element` itself to leave the props unchanged.
- Mixins run in order, and each one sees the props produced by the mixins before it.
- Create mixin factories at module scope, and keep the order of mixins stable. Changing the setup function in a slot disposes that mixin and sets up its replacement.
- Setup and render run during server rendering by default. Put DOM access in lifecycle listeners or `handle.queueTask()`, which only run in the browser.

The mixin handle has its own API:

| Member                    | Use                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `handle.element`          | The host element to return from render, to forward props, patch attributes, or add nested mixins. |
| `handle.update()`         | Renders the host's mixins again without rendering the owner component.                            |
| `handle.queueTask(task)`  | Runs `task(node, signal)` after pending DOM updates and commit callbacks.                         |
| `handle.signal`           | Aborted when this mixin slot is disposed, even if the host stays mounted.                         |
| `handle.id`               | An ID shared by the mixins bound to this host.                                                    |
| `handle.context`          | Reads context provided by an ancestor component.                                                  |
| `handle.frame`            | The frame containing the host.                                                                    |
| `handle.addEventListener` | Registers [lifecycle event](#lifecycle-events) listeners.                                         |

### Browser-Only Mixins

For behavior that doesn't affect server HTML, pass `{ ssr: false }` to skip setup and render on the server. The browser still initializes the mixin as usual, including during hydration:

```tsx
import { createMixin } from 'remix/component'

const focusOnInsert = createMixin<HTMLElement>(
  (handle) => {
    handle.addEventListener('insert', ({ node }) => node.focus())
  },
  { ssr: false },
)
```

- Only use `ssr: false` when skipping the mixin still leaves correct server HTML. Keep server rendering for mixins that supply initial attributes, ARIA props, styles, or nested mixins that affect the HTML. A server-rendered mixin can still return browser-only mixins, and the server skips those too.
- Options are read when the factory is created.
- The module containing the mixin, and the arguments passed to its factory, still run on the server. `ssr: false` skips setup and render, not the module.
- The built-in `on` and `ref` mixins use this option, because their work only runs in the browser.

### Lifecycle Events

Register lifecycle listeners in the setup function:

```tsx
import { createMixin } from 'remix/component'

const observeSize = createMixin<HTMLElement>((handle) => {
  let observer: ResizeObserver | undefined

  handle.addEventListener('insert', (event) => {
    observer = new ResizeObserver(([entry]) => {
      console.log(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(event.node)
  })

  handle.addEventListener('remove', () => {
    observer?.disconnect()
  })
})
```

| Event          | When it fires                                                                                                          | Event fields                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `insert`       | After the mixin binds to its host, in the commit phase. This also runs when adding a mixin to an already-mounted host. | `node`, `parent`, optional `key` |
| `beforeUpdate` | Before DOM changes in the host's update scope. Use it to measure the previous layout.                                  | `node`                           |
| `commit`       | After DOM changes in the host's update scope. Use it to measure the new layout.                                        | `node`                           |
| `beforeRemove` | When host removal begins, while a mixin can still defer it.                                                            | `persistNode(callback)`          |
| `reclaimed`    | When a persisted keyed host returns before removal completes.                                                          | `node`, `parent`, optional `key` |
| `remove`       | When the mixin is disposed. This also runs when the mixin is removed or replaced while its host stays mounted.         | Standard `Event` fields          |

`beforeUpdate` and `commit` concern the containing update scope, so they can run when another element's update affects this host's layout. They are not a notification that this mixin's arguments changed.

`beforeRemove` and `remove` have different jobs. Register work that delays host removal in `beforeRemove`. Release resources in `remove`, which marks final disposal of the mixin slot. It is a cleanup notification, not a guarantee that the host has already been detached. Removing only a mixin from `mix` does not remove its host or provide a `persistNode` opportunity.

### Deferring Removal with `persistNode`

For ordinary exit animations, use [`animateExit`](https://github.com/remix-run/remix/blob/main/packages/ui/src/animation/README.md) from `@remix-run/ui/animation`. Custom mixins can use the same underlying lifecycle API when they need control over teardown:

```tsx
import { createMixin } from 'remix/component'

const fadeOut = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement

  handle.addEventListener('insert', (event) => {
    node = event.node
  })

  handle.addEventListener('beforeRemove', (event) => {
    event.persistNode(async (signal) => {
      if (signal.aborted) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      let animation = node.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 150,
        fill: 'forwards',
      })
      let cancel = () => animation.cancel()
      signal.addEventListener('abort', cancel, { once: true })

      try {
        await animation.finished
      } finally {
        signal.removeEventListener('abort', cancel)
        animation.cancel()
      }
    })
  })
})

function Notice() {
  return () => (
    <p key="notice" mix={fadeOut()}>
      Settings saved.
    </p>
  )
}
```

When a later render removes the paragraph, `beforeRemove` fires while the node is still present. A thrown error or rejected promise from one callback does not prevent the other callbacks from running. Handle or report errors inside your callback if they matter to your application.

The event only accepts a callback. Making the `beforeRemove` listener itself `async`, returning a promise from it, or calling `preventDefault()` does not defer removal.

If the same keyed host type returns under the same DOM parent before teardown finishes, Remix can reuse the persisted DOM node. An abort signal does not cancel a promise or animation by itself.

Without reclamation, `beforeRemove` runs first, then the teardown callbacks settle, and Remix finishes host removal and dispatches `remove` for cleanup. Persistence does not require a key, but reclamation does. Persist the outermost element being removed: persisting a descendant does not keep a removed ancestor's subtree mounted. Ancestor teardown can abort a descendant's pending removal work.

### Custom Events

An event mixin turns several low-level events into one semantic event. Define an event class, declare its type on `HTMLElementEventMap` so `on()` can type it, and dispatch it from the host:

```tsx
import { createMixin, on } from 'remix/component'

export const dragReleaseType = 'myapp:drag-release' as const

declare global {
  interface HTMLElementEventMap {
    [dragReleaseType]: DragReleaseEvent
  }
}

export class DragReleaseEvent extends Event {
  velocityX: number
  velocityY: number

  constructor(init: { velocityX: number; velocityY: number }) {
    super(dragReleaseType, { bubbles: true })
    this.velocityX = init.velocityX
    this.velocityY = init.velocityY
  }
}

export const dragRelease = createMixin<HTMLElement>((handle) => {
  let tracking = false
  let velocityX = 0
  let velocityY = 0
  let lastX = 0
  let lastY = 0
  let lastTime = 0

  return () => (
    <handle.element
      mix={[
        on('pointerdown', (event) => {
          if (!event.isPrimary) return
          tracking = true
          lastX = event.clientX
          lastY = event.clientY
          lastTime = event.timeStamp
          velocityX = 0
          velocityY = 0
          event.currentTarget.setPointerCapture(event.pointerId)
        }),
        on('pointermove', (event) => {
          if (!tracking) return
          // Velocity in pixels per second
          let elapsed = Math.max(1, event.timeStamp - lastTime) / 1000
          velocityX = (event.clientX - lastX) / elapsed
          velocityY = (event.clientY - lastY) / elapsed
          lastX = event.clientX
          lastY = event.clientY
          lastTime = event.timeStamp
        }),
        on('pointerup', (event) => {
          if (!tracking) return
          tracking = false
          event.currentTarget.dispatchEvent(new DragReleaseEvent({ velocityX, velocityY }))
        }),
      ]}
    />
  )
})
```

Consumers listen for it like any DOM event:

```tsx
<div
  mix={[
    dragRelease(),
    on(dragReleaseType, (event) => {
      console.log(event.velocityX, event.velocityY)
    }),
  ]}
/>
```

- Namespace event names, such as `myapp:drag-release`, to avoid collisions.
- Put the data consumers need on the event object.
- Keep state the gesture needs in setup scope, and clean up timers and global listeners in a `remove` listener.

## Client Entries

`clientEntry(entryId, component)` marks a component that hydrates in the browser. On the server it renders like any other component. Remix wraps its output in `<!-- rmx:h:... -->` comments and serializes its props into a `<script type="application/json" id="rmx-data">` tag. In the browser, `run()` loads the component's module and hydrates the existing DOM in place:

```tsx
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

export const LikeButton = clientEntry(
  import.meta.url,
  function LikeButton(handle: Handle<{ initialLikes: number }>) {
    let likes = handle.props.initialLikes

    return () => (
      <button
        type="button"
        mix={on('click', () => {
          likes++
          handle.update()
        })}
      >
        {likes} likes
      </button>
    )
  },
)
```

### Entry IDs

An entry ID has the form `moduleUrl#ExportName`. When it has no `#ExportName`, as with `import.meta.url`, Remix uses the component function's name, so give the function the same name as its export. Rendering throws when it can't determine an export name.

The `render()` middleware and `renderToStream()` resolve entry IDs to the public module URLs the browser loads. Pass `resolveClientEntry` to map source modules to built assets. See [`remix/component/server`](./server/README.md).

### Serializable Props

Client entry props cross from the server to the browser, so they must be serializable:

- strings, numbers, booleans, `null`, and `undefined`
- plain objects and arrays of serializable values
- JSX elements, including `<Frame>` elements, which are serialized as frame descriptors

Functions and class instances are rejected by the types. Pass plain data, route URLs, and other browser-safe values instead of database records or request objects.

### Booting with run()

`run()` hydrates every client entry in the document by calling `loadModule` for each component module:

```tsx
import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
})

app.addEventListener('error', (event) => {
  console.error(event.error)
})

await app.ready()
```

| Option                       | Use                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loadModule`                 | Required. Loads a client entry's module and returns the named export. Remix passes each module specifier unchanged.                                                            |
| `processClientEntryPreloads` | Receives module preloads discovered in frame responses before they're added to the document. Return the URLs that should stay as native `<link rel="modulepreload">` elements. |
| `resolveFrame`               | Fetches frame content for navigations and reloads. See [Frame Navigation](#frames).                                                                                            |
| `prefetch`                   | Replaces the default prefetch for `data-rmx-prefetch` links and `prefetch()` calls. See [Frame Navigation](#frames).                                                           |

The returned runtime emits `error` events for component errors, and has these members:

| Member          | Use                                                                                 |
| --------------- | ----------------------------------------------------------------------------------- |
| `app.ready()`   | Resolves after the document finishes hydrating.                                     |
| `app.flush()`   | Applies pending component updates synchronously, mainly for tests and integrations. |
| `app.dispose()` | Stops the runtime's listeners and disposes the top-level frame.                     |
| `app.frames`    | The top-level and named frames, like [`handle.frames`](#frames-from-components).    |

Client entries introduced after the initial document may depend on import maps added at runtime. When targeting browsers without native support for multiple import maps, use `remix/multiple-import-maps-polyfill` to load these modules and process their preloads:

```tsx
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await importModule(moduleUrl)
    let Component = module[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})
```

### How Hydration Works

- Each client entry hydrates on its own. A client entry inside another one can read its ancestor's context, but sibling client entries don't share context.
- Remix adopts the server-rendered DOM in place. It patches mismatched attributes and adds missing ones, but leaves extra attributes alone. When an element's type doesn't match, Remix skips one node to look for a match, then recreates the element.
- Client entries inside a [`data-rmx-preserve-dom`](#preserving-client-owned-dom) element hydrate during the initial boot, but later frame reloads don't patch new server props through the preserved element.

### Trusted Content and Module Loading

The initial document and HTML returned by `resolveFrame` are trusted application content. They can select client-entry modules and contribute import maps, styles, and nested frames. Only return HTML from sources the application trusts to run code in the current page. The default resolver restricts requests and redirects to the document origin, but Remix does not sanitize the returned HTML and same-origin user-generated content is not implicitly safe.

Remix passes each serialized module specifier unchanged to `loadModule`. The loader controls how it resolves that specifier, so client entries can use CDN URLs, development server URLs, or bare specifiers resolved through import maps or a custom loader. With `import(moduleUrl)`, relative specifiers resolve from the module containing that import, subject to the document's import map. Applications that restrict module sources should enforce that policy in their loader before importing code. The runtime's check that the returned export is a function happens after loading; it checks the component shape, not whether the module is trusted.

## Frames

`<Frame>` renders the HTML of another route into the current page. Without a `fallback`, the frame blocks until its content resolves. With one, the fallback renders first and the frame's content streams in when it's ready:

```tsx
import { Frame } from 'remix/component'
import type { Handle } from 'remix/component'

function AlbumPage(handle: Handle<{ albumId: string }>) {
  return () => (
    <main>
      <h1>Album</h1>
      <Frame
        name="recommendations"
        src={`/albums/${handle.props.albumId}/recommendations`}
        fallback={<p>Loading recommendations…</p>}
      />
    </main>
  )
}
```

| Prop       | Use                                                                               |
| ---------- | --------------------------------------------------------------------------------- |
| `src`      | Required. The URL whose HTML the frame renders and reloads.                       |
| `name`     | Lets links, forms, and `handle.frames.get(name)` target the frame.                |
| `fallback` | Content to render while the frame is pending.                                     |
| `on`       | Event handlers for events dispatched from the frame element, keyed by event type. |

Frame content is itself rendered with `renderToStream`, so frames can contain other frames and client entries. The hydration data from nested frames is merged into the parent response automatically.

Components reach frames through [`handle.frame` and `handle.frames`](#frames-from-components). Each frame handle has these members:

| Member                   | Use                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `frame.src`              | The source the next reload uses. Assigning it alone doesn't load content or change history.                                               |
| `frame.reload(options?)` | Fetches the frame's source through the resolver and reconciles the result. See [Reloading Frames](#reloading-frames).                     |
| `frame.replace(content)` | Renders trusted HTML, a byte stream, or a Remix node directly, without calling the resolver or changing the source. HTML isn't sanitized. |
| `reloadStart` event      | Dispatched when a direct or ancestor-driven reload starts.                                                                                |
| `reloadComplete` event   | Dispatched when reload processing ends, including after cancellation or failure.                                                          |

### Nested Frames

Frames can nest. Each frame owns its own region of the DOM and hydrates its client entries independently:

```tsx
import { Frame } from 'remix/component'

function App() {
  return () => <Frame src="/outer" fallback={<div>Loading outer...</div>} />
}

// The /outer route renders:
function OuterFrame() {
  return () => (
    <div>
      <h2>Outer</h2>
      <Frame src="/inner" fallback={<div>Loading inner...</div>} />
    </div>
  )
}
```

Nested frames stream independently. The outer frame can resolve and render while the inner frame is still loading.

### Resolving Frames in the Browser

`run()` installs a default frame resolver. It's used for `<Frame>` elements first rendered in the browser, `frame.reload()` calls, link navigations, and form navigations. Pending frames from the server response are filled in by the streamed HTML, not the resolver. A normal browser document load doesn't use the resolver either.

The default resolver sends `X-Remix-Frame: true` for every request, including top-frame navigation and reloads. Named frames also send `X-Remix-Target`. Top-frame and unnamed frame requests omit the target, so give a frame a name when its route needs to tell it apart. The route decides whether to return a full document or a fragment.

The default resolver omits `X-Remix-Top-Frame-Src`. When `render()` middleware handles these requests, the server-rendered `handle.frames.top.src` defaults to the requested frame's URL. Same-origin subrequests created by a `render()` middleware render carry its top-frame source to nested renders. If frame content depends on the containing page, include that context explicitly in the frame's `src`.

The default resolver is equivalent to:

```js
async function resolveFrame(src, options) {
  let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
  if (options?.target != null) headers.set('X-Remix-Target', options.target)

  let { body, encType } = getRequestBody(options)
  if (encType) headers.set('Content-Type', encType)
  let requestInit = {
    body,
    headers,
    method: options?.method,
    mode: 'same-origin',
    signal: options?.signal,
  }
  let response = await fetch(src, requestInit)

  let isHtml = response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
  if (response.status >= 500 || (response.status >= 300 && !isHtml)) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
  }

  return response
}

function getRequestBody(options) {
  let formData = options?.formData
  if (!formData) return {}
  if (['get', 'head'].includes((options?.method ?? 'get').toLowerCase())) return {}

  let encType = options?.encType?.toLowerCase()

  if (encType === 'multipart/form-data') return { body: formData }

  if (encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name)
      value = normalizeLineBreaks(typeof value === 'string' ? value : value.name)
      body += `${name}=${value}\r\n`
    }
    return { body: new Blob([body], { type: 'text/plain' }), encType: 'text/plain' }
  }

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(
      normalizeLineBreaks(name),
      normalizeLineBreaks(typeof value === 'string' ? value : value.name),
    )
  }
  return { body, encType: 'application/x-www-form-urlencoded' }
}

function normalizeLineBreaks(value) {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}
```

- GET form values are already encoded in `src`. `application/x-www-form-urlencoded` submissions use `URLSearchParams`, `text/plain` submissions use CRLF-delimited text, and `multipart/form-data` submissions use `FormData`.
- It accepts `2xx` responses, and `3xx` or `4xx` responses whose `Content-Type` includes `text/html`, ignoring case. It rejects other `3xx` or `4xx` responses and all `5xx` responses with an error containing their status and status text.
- It uses the `same-origin` Fetch mode, so cross-origin sources and redirects fail, even when the destination allows CORS.

Pass a custom `resolveFrame` to `run()` when the server requires additional headers, another body encoding, or a different response policy. A custom resolver can return frame content directly, or return the fetched `Response` with any status to render its body. Returning the response lets Remix stream it. When `fetch()` followed a redirect, frames other than the top frame render the response without changing either URL.

### Link and Form Navigation

The runtime represents the current document as `app.frames.top` and intercepts eligible same-origin links and forms through the browser's Navigation API. Those navigations fetch HTML with the frame resolver and update the existing document in place instead of loading a new document. This applies even when the page only uses `clientEntry()` and doesn't render an explicit `<Frame>`.

Frame navigation requires both `window.navigation` and `NavigateEvent.sourceElement`. Browsers missing either capability use document navigation for links, forms, and `navigate()`. Hydration and explicit frame reloads still work.

Links and forms remain ordinary HTML elements before the runtime starts. These attributes change how the runtime handles them:

| Attribute                        | Effect                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data-rmx-target="name"`         | Reloads the named frame instead of navigating the page.                                                                                                            |
| `data-rmx-src="url"`             | Fetches a different same-origin URL for the targeted frame, while `href` or `action` stays the browser destination.                                                |
| `data-rmx-document`              | Leaves the navigation to the browser as a full document load.                                                                                                      |
| `data-rmx-history`               | `push` or `replace`. Controls how the navigation updates history, and can override the automatic replacement used for non-GET form submissions to the current URL. |
| `data-rmx-reset-scroll="manual"` | Disables the automatic scroll reset.                                                                                                                               |
| `data-rmx-reset-focus="manual"`  | Disables the automatic focus reset.                                                                                                                                |
| `data-rmx-prefetch`              | `intent` or `viewport`. Starts loading the destination early. See [Prefetching](#prefetching).                                                                     |

```tsx
import { Frame } from 'remix/component'

function AccountPage() {
  return () => (
    <>
      <Frame name="account" src="/account/edit" />
      <form action="/account/edit" method="post" data-rmx-target="account">
        <label for="display-name">Display name</label>
        <input id="display-name" name="displayName" required />
        <button type="submit">Save</button>
      </form>
    </>
  )
}
```

- Every `data-rmx-src` override must resolve to the document origin, using `document.baseURI` for relative URLs.
- Browsers ignore `data-rmx-history` without the client runtime and use their normal history behavior.
- Scroll and focus controls accept the Navigation API values `"after-transition"` (the default) and `"manual"`. The equivalent options for `navigate()` and `link()` are `resetScroll: 'manual'` and `resetFocus: 'manual'`. Boolean options and `"true"`/`"false"` attribute values are still supported, where `true` means `"after-transition"` and `false` means `"manual"`.

Forms keep native behavior:

- Constraint validation still runs before submission.
- Submitter overrides such as `formmethod`, `formenctype`, and `formtarget` take precedence over the form's attributes.
- Cross-origin submissions, `method="dialog"`, and `target="_blank"` are left to the browser.
- GET form values arrive in `src`. Non-GET forms pass `formData`, `method`, and `encType` to the resolver.
- Non-GET `FormData` is used only for the active request and isn't kept in history.

To keep every link and form as a document navigation while still hydrating client entries and using explicit frames, register a listener before calling `run()`:

```ts
window.navigation?.addEventListener('navigate', (e) => e.stopImmediatePropagation())
```

This prevents Remix from intercepting Navigation API events. Explicit frame reloads such as `handle.frame.reload()` still use the frame resolver.

### Reloading Frames

`frame.reload()` fetches the frame's source again. Pass options to reload another source or send a request body without changing browser history:

```tsx
await handle.frame.reload({ src: '/account/edit' })

let body = new FormData()
body.set('displayName', 'Ada')
await handle.frame.reload({
  src: '/account/edit',
  method: 'post',
  body,
})
```

- `src` becomes the source for later reloads.
- Pass `FormData` as `body` to submit fields. Omitting `body` sends no request body, including on later reloads after a POST.
- The method defaults to GET. For GET reloads, the fields replace the source's query. Repeated fields and the URL fragment are preserved, and the resulting URL becomes the source for later reloads.
- POST defaults to `application/x-www-form-urlencoded`. Use `encType` to select `multipart/form-data` or `text/plain`. For `multipart/form-data`, Fetch generates the boundary. URL-encoded and plain-text submissions use file names in place of file contents and normalize line breaks to CRLF.
- Methods and encodings are case-insensitive, and unsupported values use the defaults.
- Each reload makes one resolver request. Custom resolvers receive the requested `src`, `method`, and `signal`, plus `formData` and a normalized `encType` for POST.
- Redirect responses render their final content without changing the frame's requested source or the browser URL.
- A newer reload cancels earlier client work for that frame, including pending requests and streamed content. Cancelling client work can't undo a mutation the server has already performed.

Reloads don't run constraint validation or dispatch a submit event. To reload with a form's values, validate and build the form data yourself:

```tsx
if (form.reportValidity()) {
  await handle.frame.reload({
    src: form.action,
    method: form.method,
    encType: form.enctype,
    body: new FormData(form, saveButton),
  })
}
```

### Prefetching

Add `data-rmx-prefetch="intent"` to a link to start loading its page when the visitor hovers, focuses, or presses it. Use `data-rmx-prefetch="viewport"` to start loading when the link enters the viewport. Remix fetches the page's HTML to discover JavaScript, CSS, and explicit image and font preloads, and adds prefetch hints for those assets. Navigation uses the default resolver and the browser HTTP cache, and even uncacheable HTML can reveal cacheable assets.

Use the imperative `prefetch()` API from `remix/component` for other triggers, such as prefetching a search result as the visitor types. Call `prefetch(src, { target: 'details' })` to prefetch content for a named frame.

**When prefetching starts:**

- Intent prefetching starts when the visitor rests the pointer or keyboard focus on the link for 100ms, or presses it. A press starts prefetching immediately, including touch and pen presses.
- Hover and focus are tracked independently. Moving between children of a link, pressing it after its prefetch starts, or focusing it while it's hovered doesn't repeat the prefetch. Leaving the link with both the pointer and focus ends that interaction, and returning can prefetch again.
- Viewport links prefetch once while mounted with the same normalized frame source and target. Leaving and reentering the viewport, hovering, focusing, or pressing them doesn't repeat the prefetch. Changing the requested source or target makes a link eligible again. Changing only a fragment, or changing `href` while a named frame's source override stays the same, doesn't. Removing and later mounting a link also makes it eligible again.
- Remix uses one `IntersectionObserver` and one `MutationObserver` to track links, including links added by streaming, frame navigation, or client rendering. Disposing the runtime disconnects both. Browsers without `IntersectionObserver` skip viewport prefetching but keep intent and imperative prefetching.

**What's skipped:**

- Links with `data-rmx-document`, `download`, or a `target` other than `_self`. Both the destination and any `data-rmx-src` override must resolve to the document origin.
- Automatic prefetching when the browser reports Save-Data or an effective connection type of `slow-2g` or `2g`. This check runs when a trigger fires and doesn't cancel prefetches already in progress. Browsers without `navigator.connection` prefetch normally. Imperative `prefetch()` calls ignore these settings.
- Named-frame links whose frame isn't mounted. Prefetching uses the selected frame's source and sends its target, matching the eventual frame request. Without a nonempty target, a `data-rmx-src` override is ignored and `href` is prefetched.

**What's fetched:**

By default, Remix fetches the frame source with GET, a `priority: 'low'` hint, and the same `Accept: text/html` and `X-Remix-Frame: true` headers as a frame navigation, plus `X-Remix-Target` for named frames. It reads the response into an inert template and discovers explicit JavaScript and CSS URLs and `<link rel="preload" as="image|font" href="…">` declarations, including resources inside nested frame templates. It adds ordinary `<link rel="prefetch" as="script|style|image|font">` hints for assets that aren't already active in the document. These hints don't run scripts, apply styles, install import maps, or follow module dependencies. They stay connected through frame navigation and are removed on load, error, or runtime disposal.

Declare important destination images and fonts with preload links to include them in discovery:

```html
<link rel="preload" as="image" href="/images/product-hero.jpg" />
<link rel="preload" as="font" href="/fonts/body.woff2" type="font/woff2" crossorigin />
```

Image and font preload links must have an explicit `href` and a matching `media` condition, if specified. Include `crossorigin` on font preloads, even for same-origin URLs, to match CSS font requests. Remix keeps that setting on the prefetch hint. It skips image declarations with `imagesrcset`, because ordinary prefetch hints can't select a responsive image candidate. It doesn't scan `<img>` elements or parse CSS `@font-face` rules.

**Caching:**

The fetched HTML is discarded. Navigation uses the normal frame resolver and browser HTTP cache. Matching fresh responses can be reused, `no-cache` responses revalidate, and `no-store` responses are fetched again. Asset discovery still works for `no-store` HTML because assets have their own cache policies. Reusing responses requires appropriate HTTP caching headers, such as `Cache-Control: private, max-age=30`, and matching request variants selected by `Vary`.

Remix deduplicates pending HTML discovery by source and target, and asset hints across frame requests, but keeps no cache of completed responses. Servers that return different HTML for different frame targets should include `X-Remix-Target` in `Vary` when making those responses cacheable. An early navigation starts its normal fetch independently of discovery, and request sharing is up to the browser. Asset prefetches are hints and may be deferred or ignored. Browsers without link-prefetch support skip asset hints but still fetch HTML. Discovery waits for the full HTML body and doesn't follow JavaScript imports, CSS imports, or CSS images and fonts.

To reuse uncacheable HTML in memory, pass `prefetch` and `resolveFrame` to `run()`. Remix still decides when and which links to prefetch. This example holds each prefetched response for the next GET request with the same source and target. The app provides `fetchFrame(src, options)` to handle frame headers, submissions, cancellation, and response handling, and owns the lifetime and invalidation of any responses it keeps:

```ts
import { run } from 'remix/component'

let prefetched = new Map<string, Promise<Response>>()

function frameKey(src: string, target?: string) {
  let url = new URL(src, document.baseURI)
  url.hash = ''
  return JSON.stringify([url.href, target])
}

run({
  loadModule,
  prefetch(src, options) {
    prefetched.set(frameKey(src, options?.target), fetchFrame(src, options))
  },
  resolveFrame(src, options) {
    let isGet = !options?.method || options.method.toUpperCase() === 'GET'
    let response = isGet ? prefetched.get(frameKey(src, options?.target)) : undefined
    prefetched.clear()
    return response ?? fetchFrame(src, options)
  },
})
```

### Preserving Client-Owned DOM

Use `data-rmx-preserve-dom` on the smallest element whose live DOM should belong to client code after the initial render, such as a custom element or third-party widget:

```tsx
<pagefind-ui data-rmx-key="search" data-rmx-preserve-dom>
  <button type="button">Search</button>
</pagefind-ui>
```

- The runtime still renders the element's children during server rendering and hydrates any initial client entries inside it. The attribute only affects later frame reloads. When incoming frame HTML has `data-rmx-preserve-dom` on a matched element, the runtime keeps that element's current attributes and children instead of applying incoming changes below it.
- Add `data-rmx-key` when the element can move among siblings, so reloads match the same live element before falling back to matching by position.
- Avoid wrapping Remix-owned UI that should keep receiving server-driven frame updates. A client entry inside `data-rmx-preserve-dom` hydrates from the initial HTML, but later frame reloads won't patch new server-rendered children or props through the preserved element. Put the client entry outside the preserved element when it needs future frame data, or put `data-rmx-preserve-dom` inside the client entry around only the imperative DOM.

### Preserving Client-Owned Attributes

Use `data-rmx-preserve-attrs` when client code owns only specific attributes, such as a theme set on `<html>`:

```html
<html lang="en" data-rmx-preserve-attrs="data-theme"></html>
```

- On frame reloads, the space-separated attribute names in the incoming HTML keep their live values, or their absence. Other attributes and children reconcile normally.
- Each listed attribute is preserved as a whole, so listing `class` keeps all of its current tokens without merging server classes.
- Removing a name from the incoming list returns that attribute to normal reconciliation immediately. An empty or omitted list uses normal reconciliation.
- It works on any matched element, but doesn't prevent removal or replacement, and doesn't preserve descendants. Initial rendering and hydration are unchanged.

### Frame Lifecycle

1. **Server render:** Frame content is resolved through `renderToStream`'s `resolveFrame` option and streamed into the HTML. Frame metadata is stored in the `rmx-data` script.
2. **Client boot:** `run()` discovers frame boundaries, hydrates the client entries inside them, and watches any frames still streaming.
3. **Reload:** `frame.reload()` fetches the frame's `src`, reconciles the new content into the DOM, and passes updated props to the client entries inside it.
4. **Dispose:** When a frame is removed, such as by a parent render, its client entries are cleaned up and nested frames are disposed recursively.

## Single-page Applications

Use `render` and `run` from `remix/spa` when every route runs in the browser and returns a component
tree instead of an HTTP response body. The render middleware keeps the router's standard `Request`
to `Response` contract while associating the response with a node for the top frame to render:

```tsx
import { createRouter } from 'remix/router'
import { render, run } from 'remix/spa'

let router = createRouter({ middleware: [render()] })

router.get('/', ({ render }) => render(<h1>Home</h1>))
router.get('/about', ({ render }) => render(<h1>About</h1>))

function LoadingPage() {
  return () => <p role="status">Loading…</p>
}

let app = run(router, { fallback: <LoadingPage /> })
await app.ready()
```

The optional `fallback` is a live Remix node displayed while the initial route loads.
`app.ready()` resolves after the initial URL has replaced it with the routed node. The runtime then
reuses frame navigation for same-origin links, forms, history traversal, redirects, cancellation,
and `rmx-target`.

## Raw HTML with unsafeHTML

Host raw-HTML props (`innerHTML` and iframe `srcDoc` / `srcdoc`) require an explicit value created with `unsafeHTML(...)`:

```tsx
import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'

function ArticleBody(handle: Handle<{ html: string }>) {
  return () => <article innerHTML={unsafeHTML(handle.props.html)} />
}
```

When `innerHTML` is set, the element's `children` are ignored. `unsafeHTML()` is an authorization boundary and does not sanitize input; only pass trusted or already-sanitized HTML.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
