# component

A minimal component system built on JavaScript and DOM primitives. Write components that render on the server, stream to the browser, and hydrate only where you need interactivity.

For a walkthrough of building with these APIs, see the guides on [rendering UI](https://docs.remix.run/rendering-ui/), [interactivity](https://docs.remix.run/interactivity/), [streaming UI with frames](https://docs.remix.run/streaming-ui-with-frames/), and [animation](https://docs.remix.run/animation/).

## Features

- Components are plain closures. Setup runs once, render runs on every update, and `handle.update()` schedules renders explicitly
- Server rendering and streaming through `remix/component/server`
- Selective hydration with `clientEntry()`, so the rest of the page stays plain HTML
- `<Frame>` regions that stream in and reload independently
- Client navigation for ordinary links and forms through the Navigation API, with prefetching
- Composable `mix` behaviors: `on`, `ref`, `link`, `attrs`, `css`, and your own `createMixin()` mixins
- Scoped `css()` styles with nesting and cascade layers

## Installation

```sh
npm i remix
```

### JSX Configuration

Point TypeScript's JSX transform at `remix/component` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "remix/component"
  }
}
```

The transform imports from `remix/component/jsx-runtime`. Without JSX, build the same elements with `createElement(type, props, ...children)`.

## Usage

Pages render on the server, and only the components marked with `clientEntry()` hydrate in the browser. A route action renders a page with the [`render()` middleware](../render-middleware/README.md):

```tsx
// app/actions/controller.tsx
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'

export default createController(routes, {
  actions: {
    home(context) {
      return context.render(<HomePage />)
    },
  },
})
```

The page is an ordinary component. Everything except `LikeButton` is sent as static HTML:

```tsx
// app/actions/home-page.tsx
import { Document } from './document.tsx'
import { LikeButton } from './public/like-button.tsx'

export function HomePage() {
  return () => (
    <Document title="Home">
      <h1>Welcome</h1>
      <LikeButton initialLikes={3} />
    </Document>
  )
}
```

`LikeButton` keeps local state in setup scope and calls `handle.update()` to render again:

```tsx
// app/actions/public/like-button.tsx
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

const buttonStyle = css({
  padding: '8px 12px',
  borderRadius: '6px',
  '&:hover': { background: '#f3f0ff' },
})

export const LikeButton = clientEntry(
  import.meta.url,
  function LikeButton(handle: Handle<{ initialLikes: number }>) {
    let likes = handle.props.initialLikes

    return () => (
      <button
        type="button"
        mix={[
          buttonStyle,
          on('click', () => {
            likes++
            handle.update()
          }),
        ]}
      >
        {likes} likes
      </button>
    )
  },
)
```

A browser entry, loaded by the document, calls `run()` to hydrate each client entry:

```ts
// app/actions/public/entry.ts
import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
})

await app.ready()
```

To render HTML yourself instead of through the middleware, use `renderToStream()` from [`remix/component/server`](./server/README.md).

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

## Host Elements

Lowercase JSX tags render host elements. Props become attributes, with a few conveniences:

- HTML attribute names such as `class` and `for` work, and so do the DOM property names `className` and `htmlFor`. These examples use the HTML names.
- `style` accepts an object of camelCase properties. Numbers get a `px` unit, except for unitless properties such as `opacity` and `zIndex`, and custom properties such as `'--accent'` are set as written.
- Boolean attributes render when `true` and are omitted when `false`. ARIA attributes render `true` and `false` as strings.
- `<>…</>`, or `Fragment`, groups children without adding an element.

```tsx
<label for="volume" class="field" style={{ marginBlock: 8, '--accent': '#6d28d9' }}>
  Volume
</label>
```

### Raw HTML

Host raw-HTML props (`innerHTML` and iframe `srcDoc` / `srcdoc`) require an explicit value created with `unsafeHTML(...)`:

```tsx
import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'

function ArticleBody(handle: Handle<{ html: string }>) {
  return () => <article innerHTML={unsafeHTML(handle.props.html)} />
}
```

When `innerHTML` is set, the element's `children` are ignored. `unsafeHTML()` is an authorization boundary and does not sanitize input; only pass trusted or already-sanitized HTML.

## Handle

| Member                   | Use                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `handle.props`           | The current props. The object stays the same across renders, and its values are replaced before each render.                             |
| `handle.update()`        | Schedules a render. Returns a promise that resolves with an [`AbortSignal`](#abort-signals) after the update commits.                    |
| `handle.queueTask(task)` | Runs `task` after the next commit, passing it an [`AbortSignal`](#abort-signals). See [Queued Tasks](#queued-tasks).                     |
| `handle.signal`          | Aborted when the component is removed. Use it to clean up work started in setup.                                                         |
| `handle.id`              | A stable ID for the instance, for `for`, `aria-controls`, and similar attributes.                                                        |
| `handle.context`         | Provides values to descendants and reads values from ancestors. See [Context](#context).                                                 |
| `handle.frame`           | The [frame](#frame-handles) that contains the component. Call `handle.frame.reload()` to fetch its content again.                        |
| `handle.frames`          | `handle.frames.top` is the root frame, and `handle.frames.get(name)` finds a mounted frame by name. See [Frame Handles](#frame-handles). |

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
          <button
            type="button"
            mix={[
              ref((node) => (closeButton = node)),
              on('click', () => {
                open = false
                handle.update()
              }),
            ]}
          >
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

When `userId` changes, the next render aborts the previous request and queues one for the new ID. Any other render while a request is in flight also aborts it, and that render queues it again, so only the latest request for the current `userId` completes. Catch errors inside async tasks, as described in [Abort Signals](#abort-signals).

For a one-time load that should ignore later prop changes, queue the task from setup instead of render, and pass `handle.signal` to `fetch()`. A task queued from setup runs once after the first render, and `handle.signal` is only aborted when the component is removed, so later renders don't cancel the request.

### Abort Signals

Each signal covers a different lifetime. Pass the narrowest one to `fetch()` and other cancellable work:

| Signal                                   | Aborted when                                           |
| ---------------------------------------- | ------------------------------------------------------ |
| The second argument to an `on()` handler | The same handler runs again, or its element is removed |
| The argument to a queued task            | The component renders again, or is removed             |
| The signal resolved by `handle.update()` | The component renders again, or is removed             |
| `handle.signal`                          | The component is removed                               |

Remix doesn't handle a rejected async event handler or queued task, and aborting a `fetch()` rejects it. Catch errors inside async work, and check `signal.aborted` before using a result.

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

A provider can share a model object instead of a plain value. Set it once, and let consumers subscribe to its changes, so only the components that listen render again:

```tsx
import { TypedEventTarget } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

class Cart extends TypedEventTarget<{ change: Event }> {
  count = 0

  add() {
    this.count++
    this.dispatchEvent(new Event('change'))
  }
}

function CartProvider(handle: Handle<{ children?: RemixNode }, Cart>) {
  handle.context.set(new Cart())
  return () => handle.props.children
}

function CartCount(handle: Handle) {
  let cart = handle.context.get(CartProvider)
  cart.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return () => <span>{cart.count} items</span>
}
```

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

`key` exists only in the component tree and isn't rendered to HTML. To keep server-rendered siblings matched to the same live elements when a frame reloads, add a `data-rmx-key` attribute. See [Preserving Client-Owned DOM](#preserving-client-owned-dom).

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
- Catch errors inside async handlers. See [Abort Signals](#abort-signals).
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
- Keys are emitted as written and follow native CSS nesting, so a key without `&` applies to descendants. `':hover'` matches hovered descendants, while `'&:hover'` matches the element itself.
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

For ordinary exit animations, use [`animateExit`](https://github.com/remix-run/remix/blob/main/packages/ui/src/animation/README.md) from `@remix-run/ui/animation`, part of the separate `@remix-run/ui` package. Custom mixins can use the same underlying lifecycle API when they need control over teardown:

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

- `beforeRemove` fires while the node is still in the DOM. Call `event.persistNode(callback)` synchronously from the listener. Making the listener itself `async`, returning a promise, or calling `preventDefault()` doesn't defer removal.
- The callback can be async. Remix removes the host once every registered callback settles. A thrown error or rejected promise ends that callback's hold without blocking the others, so handle errors inside the callback if they matter.
- The callback's signal is aborted when the pending removal is canceled or the host is torn down. The signal doesn't stop your work by itself. Check it before starting, and use it to cancel unfinished animations.
- If a host with the same key and type returns under the same parent before removal finishes, Remix reuses the persisted node and dispatches `reclaimed` instead of `remove`. Persistence works without a key, but reclaiming needs one.
- Without reclaiming, `beforeRemove` fires, the callbacks settle, then Remix removes the host and dispatches `remove`.
- Persist the outermost element being removed. Persisting a descendant doesn't keep a removed ancestor's subtree mounted, and tearing down an ancestor can abort a descendant's pending removal.

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

`clientEntry(entryId, component)` marks a component that hydrates in the browser, as `LikeButton` does in [Usage](#usage). On the server it renders like any other component. Remix wraps its output in `<!-- rmx:h:... -->` comments and serializes its props into a `<script type="application/json" id="rmx-data">` tag. In the browser, [`run()`](#client-runtime) loads the component's module and hydrates the existing DOM in place.

### Entry IDs

An entry ID has the form `moduleUrl#ExportName`. When it has no `#ExportName`, as with `import.meta.url`, Remix uses the component function's name, so give the function the same name as its export. Rendering throws when it can't determine an export name.

The `render()` middleware and `renderToStream()` resolve entry IDs to the public module URLs the browser loads. Pass `resolveClientEntry` to map source modules to built assets. See [`remix/component/server`](./server/README.md).

### Serializable Props

Client entry props cross from the server to the browser, so they must be serializable:

- strings, numbers, booleans, `null`, and `undefined`
- plain objects and arrays of serializable values
- JSX elements, including `<Frame>` elements, which are serialized as frame descriptors

Functions and class instances are rejected by the types. Pass plain data, route URLs, and other browser-safe values instead of database records or request objects.

### How Hydration Works

- Each client entry hydrates on its own. A client entry inside another one can read its ancestor's context, but sibling client entries don't share context.
- Remix adopts the server-rendered DOM in place. It patches mismatched attributes and adds missing ones, but leaves extra attributes alone. When an element's type doesn't match, Remix skips one node to look for a match, then recreates the element.
- Client entries inside a `data-rmx-preserve-dom` element hydrate normally, but stop receiving new server props on frame reloads. See [Preserving Client-Owned DOM](#preserving-client-owned-dom).

## Client Runtime

`run()` starts the browser runtime. It hydrates every client entry in the document by calling `loadModule` for each component module, and handles [frame resolution](#resolving-frames), [navigation](#navigation), and [prefetching](#prefetching). Call it once from your browser entry:

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
| `resolveFrame`               | Fetches frame content for navigations and reloads. See [Resolving Frames](#resolving-frames).                                                                                  |
| `prefetch`                   | Replaces the default prefetch for `data-rmx-prefetch` links and `prefetch()` calls. See [Prefetching](#prefetching).                                                           |

The returned runtime emits `error` events for component errors, and has these members:

| Member          | Use                                                                                 |
| --------------- | ----------------------------------------------------------------------------------- |
| `app.ready()`   | Resolves after the document finishes hydrating.                                     |
| `app.flush()`   | Applies pending component updates synchronously, mainly for tests and integrations. |
| `app.dispose()` | Stops the runtime's listeners and disposes the top-level frame.                     |
| `app.frames`    | The top-level and named frames, like [`handle.frames`](#frame-handles).             |

### Loading Modules

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

The initial document and HTML returned by `resolveFrame` are trusted application content. They can select client-entry modules and contribute import maps, styles, and nested frames. Only return HTML from sources the application trusts to run code in the current page. The default resolver restricts requests and redirects to the document origin, but Remix does not sanitize the returned HTML and same-origin user-generated content is not implicitly safe.

Remix passes each serialized module specifier unchanged to `loadModule`. The loader controls how it resolves that specifier, so client entries can use CDN URLs, development server URLs, or bare specifiers resolved through import maps or a custom loader. With `import(moduleUrl)`, relative specifiers resolve from the module containing that import, subject to the document's import map. Applications that restrict module sources should enforce that policy in their loader before importing code.

### Client-Only Roots

`createRoot(container)` renders a component tree into an element without server-rendered HTML, for UI that only exists in the browser, such as a widget mounted into a third-party page:

```tsx
import { createRoot } from 'remix/component'

import { SupportWidget } from './support-widget.tsx'

let root = createRoot(document.getElementById('support-widget')!)
root.render(<SupportWidget />)

window.addEventListener('pagehide', () => root.dispose(), { once: true })
```

| Member              | Use                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root.render(node)` | Renders a tree, reusing existing DOM and component instances. The first render hydrates any content already in the container. Pass `null` to remove the tree. |
| `root.reconcile()`  | Renders the most recently supplied tree again.                                                                                                                |
| `root.flush()`      | Applies pending DOM work and tasks synchronously, mainly for tests and integrations.                                                                          |
| `root.dispose()`    | Removes the tree and releases its listeners and component resources.                                                                                          |
| `error` event       | Dispatched when a component render or queued task fails.                                                                                                      |

`createRangeRoot([start, end])` works the same way, but owns only the nodes between two sibling boundary nodes instead of a whole container.

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

A frame goes through four stages:

1. **Server render:** Frame content is resolved through `renderToStream`'s `resolveFrame` option and streamed into the HTML. Frame metadata is stored in the `rmx-data` script.
2. **Client boot:** `run()` discovers frame boundaries, hydrates the client entries inside them, and watches any frames still streaming.
3. **Reload:** `frame.reload()` fetches the frame's `src`, reconciles the new content into the DOM, and passes updated props to the client entries inside it.
4. **Dispose:** When a frame is removed, such as by a parent render, its client entries are cleaned up and nested frames are disposed recursively.

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

### Frame Handles

Components reach frames through `handle.frame`, the frame that contains the component, and `handle.frames`. Each frame handle has these members:

| Member                   | Use                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `frame.src`              | The source the next reload uses. Assigning it alone doesn't load content or change history.                                               |
| `frame.reload(options?)` | Fetches the frame's source through the resolver and reconciles the result. See [Reloading Frames](#reloading-frames).                     |
| `frame.replace(content)` | Renders trusted HTML, a byte stream, or a Remix node directly, without calling the resolver or changing the source. HTML isn't sanitized. |
| `reloadStart` event      | Dispatched when a direct or ancestor-driven reload starts.                                                                                |
| `reloadComplete` event   | Dispatched when reload processing ends, including after cancellation or failure.                                                          |

Use `handle.frames.top` when a nested component needs to reload the whole page instead of only its nearest frame:

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

### Reloading Frames

`frame.reload()` fetches the frame's source again. Pass options to reload another source or send a request body without changing browser history:

```tsx
// Inside an event handler
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
// `form` is the form element, and `saveButton` is its submit button
if (form.reportValidity()) {
  await handle.frame.reload({
    src: form.action,
    method: form.method,
    encType: form.enctype,
    body: new FormData(form, saveButton),
  })
}
```

### Resolving Frames

`run()` installs a default frame resolver. It's used for `<Frame>` elements first rendered in the browser, `frame.reload()` calls, link navigations, and form navigations. Pending frames from the server response are filled in by the streamed HTML, not the resolver. A normal browser document load doesn't use the resolver either.

The default resolver sends `X-Remix-Frame: true` for every request, including top-frame navigation and reloads. Named frames also send `X-Remix-Target`. Top-frame and unnamed frame requests omit the target, so give a frame a name when its route needs to tell it apart. The route decides whether to return a full document or a fragment.

The default resolver omits `X-Remix-Top-Frame-Src`. When `render()` middleware handles these requests, the server-rendered `handle.frames.top.src` defaults to the requested frame's URL. Same-origin subrequests created by a `render()` middleware render carry its top-frame source to nested renders. If frame content depends on the containing page, include that context explicitly in the frame's `src`.

The default resolver is a short `fetch()` call ([source](https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/run.ts)), so a custom resolver can start from a copy of it. It also follows these rules:

- GET form values are already encoded in `src`. `application/x-www-form-urlencoded` submissions use `URLSearchParams`, `text/plain` submissions use CRLF-delimited text, and `multipart/form-data` submissions use `FormData`.
- It accepts `2xx` responses, and `3xx` or `4xx` responses whose `Content-Type` includes `text/html`, ignoring case. It rejects other `3xx` or `4xx` responses and all `5xx` responses with an error containing their status and status text.
- It uses the `same-origin` Fetch mode, so cross-origin sources and redirects fail, even when the destination allows CORS.

Pass a custom `resolveFrame` to `run()` when the server requires additional headers, another body encoding, or a different response policy. A custom resolver can return frame content directly, or return the fetched `Response` with any status to render its body. Returning the response lets Remix stream it. When `fetch()` followed a redirect, frames other than the top frame render the response without changing either URL.

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

## Navigation

The runtime represents the current document as `app.frames.top` and intercepts eligible same-origin links and forms through the browser's Navigation API. Those navigations fetch HTML with the frame resolver and update the existing document in place instead of loading a new document. This applies even when the page only uses `clientEntry()` and doesn't render an explicit `<Frame>`.

Frame navigation requires both `window.navigation` and `NavigateEvent.sourceElement`. Browsers missing either capability use document navigation for links, forms, and `navigate()`. Hydration and explicit frame reloads still work.

### Links and Forms

Links and forms remain ordinary HTML elements before the runtime starts. These attributes change how the runtime handles them:

| Attribute                        | Effect                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-rmx-target="name"`         | Loads the destination into the named frame instead of the whole page. The address bar still moves to `href`, and an unmatched name falls back to document navigation. |
| `data-rmx-src="url"`             | Fetches a different same-origin URL for the targeted frame, while `href` or `action` stays the browser destination.                                                   |
| `data-rmx-document`              | Leaves the navigation to the browser as a full document load.                                                                                                         |
| `data-rmx-history`               | `push` or `replace`. Controls how the navigation updates history, and can override the automatic replacement used for non-GET form submissions to the current URL.    |
| `data-rmx-reset-scroll="manual"` | Disables the automatic scroll reset.                                                                                                                                  |
| `data-rmx-reset-focus="manual"`  | Disables the automatic focus reset.                                                                                                                                   |
| `data-rmx-prefetch`              | `intent` or `viewport`. Starts loading the destination early. See [Prefetching](#prefetching).                                                                        |

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

### Navigating from Code

Call `navigate(href, options?)` to navigate from a script, and add the `link(href, options?)` mixin to make an element that isn't an anchor behave like a link:

```tsx
import { link, navigate, on } from 'remix/component'
import type { Handle } from 'remix/component'

function AlbumCard(handle: Handle<{ href: string; title: string }>) {
  return () => (
    <article mix={link(handle.props.href)}>
      <h2>{handle.props.title}</h2>
    </article>
  )
}

function SortSelect(handle: Handle<{ hrefs: Record<string, string> }>) {
  return () => (
    <select
      aria-label="Sort albums"
      mix={on('change', (event) => {
        navigate(handle.props.hrefs[event.currentTarget.value], { history: 'replace' })
      })}
    >
      <option value="title">Title</option>
      <option value="year">Year</option>
    </select>
  )
}
```

- Both accept the same options: `target` and `src` to load a named frame, `history` (`'push'` or `'replace'`), and `resetScroll` and `resetFocus`. They match the `data-rmx-*` attributes above.
- `navigate()` returns a promise that settles when the Navigation API transition finishes. Invalid or cross-origin destinations, and targets that don't match a mounted frame, fall back to document navigation.
- On anchors and `<area>` elements, `link()` sets `href` and the matching `data-rmx-*` attributes. On other elements it adds `role="link"`, makes the element focusable, sets `type="button"` on buttons, handles Enter, and opens the destination in a new tab for Ctrl-click, Cmd-click, and middle clicks.

### Opting Out

To keep every link and form as a document navigation while still hydrating client entries and using explicit frames, register a listener before calling `run()`:

```ts
window.navigation?.addEventListener('navigate', (e) => e.stopImmediatePropagation())
```

This prevents Remix from intercepting Navigation API events. Explicit frame reloads such as `handle.frame.reload()` still use the frame resolver.

### Prefetching

Add `data-rmx-prefetch="intent"` to a link to start loading its page when the visitor hovers, focuses, or presses it. Use `data-rmx-prefetch="viewport"` to start loading when the link enters the viewport. For other triggers, such as prefetching a search result as the visitor types, call `prefetch(src, { target })` from `remix/component`.

- Intent prefetching starts after the pointer or keyboard focus rests on the link for 100ms, or immediately when the link is pressed. Viewport prefetching happens once while the link stays mounted with the same source and target.
- Prefetching sends the same headers as a frame navigation, including `X-Remix-Target` for named frames, so it matches the request that follows.
- Remix skips links with `data-rmx-document`, `download`, or a `target` other than `_self`, and named-frame links whose frame isn't mounted. Automatic prefetching is also skipped when the browser reports Save-Data or a `slow-2g` or `2g` connection. Imperative `prefetch()` calls ignore that check.

Remix reads the prefetched HTML without running it and finds the page's JavaScript, CSS, and declared image and font preloads, including those inside nested frames. It adds `<link rel="prefetch">` hints for assets the current page doesn't already have. The hints don't run scripts, apply styles, or follow module imports. Declare important images and fonts on the destination page to include them:

```html
<link rel="preload" as="image" href="/images/product-hero.jpg" />
<link rel="preload" as="font" href="/fonts/body.woff2" type="font/woff2" crossorigin />
```

Include `crossorigin` on font preloads, even for same-origin URLs, to match CSS font requests. Remix doesn't scan `<img>` elements or CSS `@font-face` rules.

The prefetched HTML itself is discarded. The navigation fetches it again through the frame resolver and the browser HTTP cache, so reusing the response requires caching headers such as `Cache-Control: private, max-age=30`. Asset hints still help when the HTML is `no-store`, because assets have their own cache policies. Servers that return different HTML for different frame targets should include `X-Remix-Target` in `Vary`.

To reuse uncacheable HTML in memory, pass `prefetch` and `resolveFrame` to `run()`. Remix still decides when and which links to prefetch. This example holds each prefetched response for the next GET request with the same source and target. The app provides `loadModule` and a `fetchFrame(src, options)` helper that handles frame headers, submissions, cancellation, and response handling, and it owns the lifetime and invalidation of any responses it keeps:

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

## Single-Page Applications

When every route runs in the browser and returns a component tree instead of an HTTP response, use `render()` and `run()` from [`remix/spa`](../spa/README.md). Routes keep the router's standard `Request` to `Response` contract, and the runtime reuses frame navigation for links, forms, history traversal, redirects, cancellation, and `data-rmx-target`.

## Related Packages

- [`remix/component/server`](./server/README.md) - Server rendering with `renderToStream()` and `renderToString()`, including client entry and frame resolution
- [`remix/component/test`](./test/README.md) - Render and interact with components in tests
- [`render-middleware`](../render-middleware/README.md) - `context.render()` for route actions, with frame and client entry asset resolution
- [`fetch-router`](../fetch-router/README.md) - The router that serves pages and frame requests
- [`assets`](../assets/README.md) - Serves and builds client entry modules, import maps, and preloads
- [`spa`](../spa/README.md) - Browser-only routing on the component runtime
- [`multiple-import-maps-polyfill`](../multiple-import-maps-polyfill/README.md) - Loads client entries that depend on import maps added at runtime
- [`component-hmr`](../component-hmr/README.md) - Hot module replacement for components
- [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui) - Accessible primitives and animation mixins built on this runtime

## Related Work

- [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) - The browser API behind link and form navigation
- [CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting) and [cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) - The CSS features behind `css()`
- [Turbo Frames](https://turbo.hotwired.dev/handbook/frames) and [htmx](https://htmx.org/) - Server-rendered HTML fragments swapped into the page
- [Astro islands](https://docs.astro.build/en/concepts/islands/) - Partial hydration of interactive components

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
