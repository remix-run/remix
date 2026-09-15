# Creating Mixins

Read only when an app needs reusable host behavior that existing `remix/ui` mixins or first-party primitives do not provide. For one element's events, styles, or ref callback, use [built-in mixins](mixins-styling-events.md) instead.

Detailed mixin authoring is not fully covered by installed README mirrors. Check the installed `remix/ui` exports/types for the current `createMixin` contract before extending this pattern.

## Keep the Host Contract Intact

- A mixin handle belongs to a mounted host lifecycle. Use `insert` for node-dependent setup and the lifecycle signal/removal event for cleanup.
- Return `<handle.element {...props} />` when forwarding host props. Mixins can patch attributes and compose nested `mix`; they do not own or replace the host's children.
- Keep render callbacks free of DOM effects. Mixin `queueTask` runs after commit and receives `(node, signal)`, unlike the component task callback.
- When returning a render function with arguments, mixin arguments precede the final current-host-props argument. Read current arguments for updates instead of freezing them at insertion.
- Keep the descriptor factory at module scope so its identity is stable. Put route-specific mixins with their owner; share only when multiple consumers need them.

For example, observe host size and dispatch a typed application event:

```tsx
import { createMixin, on } from 'remix/ui'

class SizeChangeEvent extends Event {
  rect: DOMRectReadOnly

  constructor(rect: DOMRectReadOnly) {
    super('app:size-change', { bubbles: true })
    this.rect = rect
  }
}

declare global {
  interface HTMLElementEventMap {
    'app:size-change': SizeChangeEvent
  }
}

const observeSize = createMixin<HTMLElement>((handle) => {
  handle.addEventListener('insert', (event) => {
    let node = event.node
    let observer = new ResizeObserver((entries) => {
      let entry = entries[0]
      if (entry) node.dispatchEvent(new SizeChangeEvent(entry.contentRect))
    })
    observer.observe(node)
    handle.signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  })

  return (props) => <handle.element {...props} />
})

export function MeasuredRegion() {
  return () => (
    <div mix={[observeSize(), on('app:size-change', (event) => console.log(event.rect.width))]} />
  )
}
```

Namespace custom events and declare their types on `HTMLElementEventMap` for `on(...)` consumers. Choose bubbling/cancelability deliberately; do not present pointer-only behavior as a complete keyboard-accessible interaction. Prefer the native element or an existing primitive whenever it already expresses the behavior.

Verify insertion, updates, removal, cleanup, and composition with another mixin in a browser test. Gesture mixins also need cancellation and interrupted-interaction coverage; do not copy an incomplete drag handler as a production interaction.
