BREAKING CHANGE: Popovers, menus, selects, and comboboxes now render ordinary DOM elements instead of native top-layer popovers. Use the matching `popover.Portal`, `menu.Portal`, `select.Portal`, or `combobox.Portal` to escape clipping or transformed ancestors, and replace `:popover-open` motion styles with `[data-state="open"]`. Native `beforetoggle` and `toggle` events no longer fire; use the controlled open state and queued DOM work instead.

Every popup surface now requires its matching boundary component: `popover.SurfaceContext`, `menu.PopoverContext`, `select.PopoverContext`, or `combobox.PopoverContext`. This applies to inline and portaled surfaces, including closed popups and popups outside dialogs. Each wrapper must belong to the same pattern instance as the surface mixin. Missing or mismatched wrappers throw an error. Keep the boundary component inside the corresponding Portal so its focus guards render beside the surface. These Portal components preserve the popup's declaration position in keyboard and accessibility navigation, prevent a second visit at the destination, and coordinate navigation with an enclosing dialog. Menu Tab exits close the popup and continue through the form. Combobox keeps focus on its input while navigating options.

These examples add the corresponding Portal component to render outside clipping ancestors. You can omit the Portal when the surface can remain inline, but its matching boundary component is still required.

Popovers:

```diff
 import * as popover from '@remix-run/ui/popover'

 <popover.Context>
   <button mix={popover.anchor({ placement: 'bottom-start' })}>Open popover</button>
-  <div mix={popover.surface({ open, onHide })}>Content</div>
+  <popover.Portal>
+    <popover.SurfaceContext>
+      <div mix={popover.surface({ open, onHide })}>Content</div>
+    </popover.SurfaceContext>
+  </popover.Portal>
 </popover.Context>

 const surfaceStyle = css({
-  '&:popover-open': { opacity: 1 },
+  '&[data-state="open"]': { opacity: 1 },
 })
```

Menus:

```diff
 import * as menu from '@remix-run/ui/menu'

 <menu.Context label="Menu">
   <button mix={menu.trigger()}>Open menu</button>
-  <div mix={menu.popover()}>
-    <div mix={menu.list()}>{/* Items */}</div>
-  </div>
+  <menu.Portal>
+    <menu.PopoverContext>
+      <div mix={menu.popover()}>
+        <div mix={menu.list()}>{/* Items */}</div>
+      </div>
+    </menu.PopoverContext>
+  </menu.Portal>
 </menu.Context>
```

Selects no longer need a separate `popover.Context`. Replace it with `select.PopoverContext` at the surface's DOM destination:

```diff
-import * as popover from '@remix-run/ui/popover'
 import * as select from '@remix-run/ui/select'

 <select.Context defaultLabel="Choose">
   <button mix={select.trigger()} />
-  <popover.Context>
-    <div mix={select.popover()}>
-      <div mix={select.list()}>{/* Options */}</div>
-    </div>
-  </popover.Context>
+  <select.Portal>
+    <select.PopoverContext>
+      <div mix={select.popover()}>
+        <div mix={select.list()}>{/* Options */}</div>
+      </div>
+    </select.PopoverContext>
+  </select.Portal>
 </select.Context>
```

Comboboxes:

```diff
 import * as combobox from '@remix-run/ui/combobox'

 <combobox.Context>
   <input aria-label="Combobox" mix={combobox.input()} />
-  <div mix={combobox.popover()}>
-    <div mix={combobox.list()}>{/* Options */}</div>
-  </div>
+  <combobox.Portal>
+    <combobox.PopoverContext>
+      <div mix={combobox.popover()}>
+        <div mix={combobox.list()}>{/* Options */}</div>
+      </div>
+    </combobox.PopoverContext>
+  </combobox.Portal>
 </combobox.Context>
```

Portals use the `Portal` component from `remix/component` and preserve component context and frame. Changing the container remounts the content and resets its local state. DOM events, form ownership, and inherited styles follow the destination. Portaled children mount in the browser and are absent from server HTML. Dialogs and popovers share visual stacking and keyboard dismissal order; set `--rmx-layer-base` on the document root to offset that stack relative to application chrome. Ordinary external overlays can use `z-index`, but do not automatically join modal focus and dismissal ownership.

The `data-open` attribute remains while exit animations finish, preserving visual order and blocking dismissal of lower layers until the closing popup is hidden. Page scrolling remains locked until exit animations finish.

`popover.Portal`, `menu.Portal`, `select.Portal`, and `combobox.Portal` accept `children` and a same-document `container`. Declare them outside shadow roots and use containers outside shadow roots. The `Portal` component from `remix/component` is a rendering utility whose keyboard navigation follows the destination DOM. Use the corresponding Portal component listed above for coordinated popup focus navigation.
