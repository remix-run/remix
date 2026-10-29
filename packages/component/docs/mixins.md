# Mixins

## Setup and render

```tsx
import { createMixin, on } from 'remix/component'

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

Use `<handle.element {...props} />` to return host props, with your overrides after the spread.

Mixins run in order, so each one sees the props produced by earlier mixins. Keep setup functions at module scope and keep mixin ordering stable: changing the setup function at a slot disposes that mixin and sets up its replacement.

Setup and render run during server rendering by default, so put DOM access in lifecycle listeners or queued tasks, which run in the browser.

## Browser-only mixins

With `{ ssr: false }`, the browser initializes the mixin as usual, including during hydration. Options are read when the factory is created.

Only use this option when skipping the mixin leaves correct server HTML. Keep server rendering enabled for mixins that supply initial attributes, ARIA props, styles, or nested mixins that affect the HTML. A server-rendered mixin can still return browser-only mixins; the server skips those nested mixins too.

The module containing the mixin and the arguments passed to its factory still run on the server. `ssr: false` skips mixin setup and render; it does not remove the module from the server bundle.

The built-in `on` and `ref` mixins use this option because their work only runs in the browser.

## Lifecycle events

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

## Deferring removal with `persistNode`

For ordinary exit animations, use `animateExit` from `@remix-run/ui/animation`. Custom mixins can use the same underlying lifecycle API when they need control over teardown:

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

## Built-in mixins

- `ref(callback)` does not rerun the callback on every render or keyed reclamation.
- `attrs(defaults)` supplies defaults only for props whose current value is `undefined`.
