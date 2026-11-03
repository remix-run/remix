# Portal

Render overlay content outside clipping or transformed ancestors while keeping its Remix component context and frame.

```tsx
import { Portal } from '@remix-run/ui/portal'
import * as dialog from '@remix-run/ui/dialog'

function Preferences() {
  return () => (
    <dialog.Context>
      <button mix={dialog.trigger()}>Preferences</button>
      <Portal>
        <div mix={dialog.backdrop()} />
        <section aria-label="Preferences" mix={dialog.surface()}>
          <button mix={dialog.close()}>Done</button>
        </section>
      </Portal>
    </dialog.Context>
  )
}
```

Apply your panel styles to the section and backdrop. `Portal` adds no positioning or stacking context. Dialog and popover mixins manage their own layer order.

## `Portal`

`children` mount in the owning document's body by default. Pass `container` to choose another element in the same document. Changing that container moves the portal host without remounting children. Parent updates propagate props and context, and child state survives updates. Unmounting disposes all descendants and removes the host.

Server rendering emits only a template marker. Children mount in the browser, so portaled content is absent from server-rendered HTML. Cross-document destinations are unsupported.

DOM event bubbling and CSS inheritance follow the destination, including form ownership and ancestor selectors. Keep forms and their controls together, or use explicit form associations. Put inherited theme variables and typography on the destination or the content itself. Component contexts, frame APIs, and render-error forwarding retain their logical ownership.
