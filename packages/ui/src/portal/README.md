# Portal

Render content outside its authored DOM ancestors while keeping its Remix component context and frame.

```tsx
import { Portal } from '@remix-run/ui/portal'
;<Portal container={container}>{children}</Portal>
```

`Portal` adds no positioning or stacking context. Component context is preserved, while keyboard navigation, DOM events and inherited styles follow the destination DOM.

`Portal` is a generic rendering utility. For focus management, use the corresponding component: `dialog.Portal`, `popover.Portal`, `menu.Portal`, `select.Portal`, and `combobox.Portal`. Follow each pattern's examples for the required structure.

## `Portal`

`children` mount in the owning document's body by default. Pass `container` to choose another element in the same document. Changing that container moves the portal host without remounting children. Parent updates propagate props and context, and child state survives updates. Unmounting disposes all descendants and removes the host.

Server rendering emits only a template marker. Children mount in the browser, so portaled content is absent from server-rendered HTML. Cross-document destinations are unsupported.

DOM event bubbling and CSS inheritance follow the destination, including form ownership and ancestor selectors. Keep forms and their controls together, or use explicit form associations. Put inherited theme variables and typography on the destination or the content itself. Component contexts, frame APIs, and render-error forwarding retain their logical ownership.
