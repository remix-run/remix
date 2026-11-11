BREAKING CHANGE: Popovers, menus, selects, and comboboxes now render ordinary DOM elements instead of native top-layer popovers. Use `Portal` from `@remix-run/ui/portal` to escape clipping or transformed ancestors, and replace `:popover-open` motion styles with `[data-state="open"]`. Native `beforetoggle` and `toggle` events no longer fire; use the controlled open state and queued DOM work instead.

```diff
 import * as popover from '@remix-run/ui/popover'
+import { Portal } from '@remix-run/ui/portal'

-<div mix={popover.surface({ open, onHide })}>Content</div>
+<Portal>
+  <div mix={popover.surface({ open, onHide })}>Content</div>
+</Portal>

 const surfaceStyle = css({
-  '&:popover-open': { opacity: 1 },
+  '&[data-state="open"]': { opacity: 1 },
 })
```

Portals preserve component context, frame, and state. DOM events, form ownership, and inherited styles follow the destination. Portaled children mount in the browser and are absent from server HTML. Dialogs and popovers share visual stacking and keyboard dismissal order; set `--rmx-layer-base` on the document root to offset that stack relative to application chrome. Ordinary external overlays can use `z-index`, but do not automatically join modal focus and dismissal ownership.

The `data-open` attribute remains while exit animations finish, preserving visual order and blocking dismissal of lower layers until the closing popup is hidden.
