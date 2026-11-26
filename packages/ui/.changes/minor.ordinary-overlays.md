BREAKING CHANGE: Popovers, menus, selects, and comboboxes now render ordinary DOM elements instead of native top-layer popovers. Use the matching Portal component to escape clipping ancestors, and wrap each popup surface in its matching context component, as shown below. The context is required for inline rendering too.

Replace `:popover-open` styles with `[data-state="open"]`. Use `[data-open]` for styles that should remain during exit animations. Native `beforetoggle` and `toggle` events no longer fire.

Place the surface context inside the Portal. Omit the Portal when the surface can remain inline.

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

Selects no longer need a separate `popover.Context`. Replace it with `select.PopoverContext` around the popup surface:

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

DOM events, form ownership, and inherited styles follow the Portal destination.

Popups no longer appear above other content automatically. If your app uses `z-index`, set `--rmx-layer-base` on the document root to keep dialogs and popups above that content. For example, for app content using `z-index: 100`:

```diff
 :root {
+  --rmx-layer-base: 100;
 }
```
