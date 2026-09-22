# Mixins

Mixins attach reusable behavior and props to the host element you render. Use `createMixin` for behavior that needs its own state, DOM lifecycle, or composition with other mixins.

## Setup and render

```tsx
import { createMixin, on } from 'remix/ui'

const clickCount = createMixin<HTMLElement, [label: string]>((handle) => {
  let count = 0

  return (label, props) => (
    <handle.element
      {...props}
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

The setup function runs once for each mixin slot on a host. Its second argument is the host tag name, such as `'button'`. The returned render function receives the arguments passed to the factory, followed by the current host props. Calling `handle.update()` reruns the host's mixins without rerendering its owner component.

Use `<handle.element {...props} />` to return host props, with your overrides after the spread. Return `handle.element` when no props need changing, or return other mixin descriptors to compose their behavior. A mixin cannot replace the host's children or raw HTML props.

Mixins run in order, so each one sees the props produced by earlier mixins. `mix` accepts a descriptor, nested arrays, and falsy entries such as `enabled && behavior()`. The runtime flattens arrays and ignores falsy entries. Keep setup functions at module scope and keep mixin ordering stable: changing the setup function at a slot disposes that mixin and sets up its replacement.

Setup and render also run during server rendering. Put DOM access in lifecycle listeners or queued tasks, which run in the browser.

## The mixin handle

`MixinHandle` is available as a type from `remix/ui`. It differs from the handle passed to a component:

| Member                   | Use                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `element`                | Forward or patch host props and compose nested `mix` values.                                                                                                |
| `update()`               | Schedule a host update. The returned promise resolves after the update with the host runtime's lifetime signal.                                             |
| `queueTask(callback)`    | Run work after pending DOM updates and commit callbacks. The callback receives the bound node and its runtime lifetime signal.                              |
| `signal`                 | Clean up work when this mixin slot is disposed, including when the host remains mounted. Read it during setup or render and capture it for later callbacks. |
| `context.get(Component)` | Read context provided by an ancestor component.                                                                                                             |
| `frame`                  | Access the containing frame.                                                                                                                                |
| `id`                     | Identify the host's mixin runtime. Mixins on the same host share this ID.                                                                                   |

The signals passed to `queueTask` and returned by `update` belong to the host runtime. `handle.signal` belongs to the individual mixin slot, and the signal passed to `persistNode` belongs to a pending removal. Use the signal for the lifetime of the work you are doing.

## Lifecycle events

Register lifecycle listeners in the setup function:

```tsx
import { createMixin } from 'remix/ui'

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

## Deferring removal with `persistNode`

For ordinary exit animations, use `animateExit` from `remix/ui/animation`. Custom mixins can use the same underlying lifecycle API when they need control over teardown:

```tsx
import { createMixin } from 'remix/ui'

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

When a later render removes the paragraph, `beforeRemove` fires while the node is still present. Call `event.persistNode(callback)` synchronously inside that listener. Remix runs the callback asynchronously and keeps the node until every registered callback settles. Returning `void` finishes that callback immediately. A thrown error or rejected promise also finishes that callback, and does not prevent the other callbacks from running or hold the node forever. Handle or report errors inside your callback if they matter to your application.

The event only accepts a callback. Making the `beforeRemove` listener itself `async`, returning a promise from it, or calling `preventDefault()` does not defer removal.

If the same keyed host type returns under the same DOM parent before teardown finishes, Remix can reuse the persisted DOM node. It aborts the teardown signal and emits `reclaimed`, without another `insert` or a `remove` event for the retained mixin. The old callback may still settle later, but it cannot remove the reclaimed node. Check `signal.aborted` before starting work and listen for `abort` to cancel work already in progress. An abort signal does not cancel a promise or animation by itself.

Without reclamation, `beforeRemove` runs first, then the teardown callbacks settle, and Remix finishes host removal and dispatches `remove` for cleanup. Persistence does not require a key, but reclamation does. Persist the outermost element being removed: persisting a descendant does not keep a removed ancestor's subtree mounted. Ancestor teardown can abort a descendant's pending removal work.

## Built-in mixins

- `on(type, listener, options?)` attaches an event listener with an abort signal for interrupted work.
- `ref(callback)` provides the host after insertion and an abort signal for cleanup. The callback does not rerun on every render or keyed reclamation.
- `attrs(defaults)` supplies defaults only for props whose current value is `undefined`.
- `link(href, options?)` adds navigation behavior and link semantics.
- `css(styles)` applies generated styles through `mix`.

See [Event Mixins](https://github.com/remix-run/remix/blob/main/packages/ui/docs/interactions.md) for custom event composition and [Animation](https://github.com/remix-run/remix/blob/main/packages/ui/src/animation/README.md) for entrance, exit, and layout helpers.
