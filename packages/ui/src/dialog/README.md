# Dialog

Custom dialogs with controlled or uncontrolled state, nested dismissal, focus management, and app-owned markup and styles.

## Usage

```tsx
import * as dialog from '@remix-run/ui/dialog'
import { Portal } from '@remix-run/ui/portal'

function Profile() {
  return () => (
    <dialog.Context>
      <button mix={dialog.trigger()}>Edit profile</button>
      <Portal>
        <div mix={dialog.backdrop()} />
        <section mix={dialog.surface()}>
          <h2 mix={dialog.title()}>Edit profile</h2>
          <p mix={dialog.description()}>Choose the name shown on your profile.</p>
          <label>
            Display name
            <input name="name" mix={dialog.focusOnShow()} />
          </label>
          <button mix={dialog.close()}>Done</button>
        </section>
      </Portal>
    </dialog.Context>
  )
}
```

Style the surface and optional backdrop yourself. Both render ordinary DOM elements with fixed positioning. Wrap them in `Portal` to escape clipping and transformed ancestors while preserving their component context. The default destination is the document body. Inline rendering is also supported when the authored ancestors permit it.

The backdrop covers its containing viewport. Give the surface its own placement, dimensions, background, and spacing. For a centered panel, use `inset: 0`, `margin: auto`, a bounded width, and `height: max-content`. Set a viewport-relative maximum height and `overflow: auto` for long content. Put inherited theme variables and typography on the portal destination or the surface itself.

## Parts and state

- `dialog.Context` scopes one surface, optional backdrop, and any number of triggers. `defaultOpen` sets initial uncontrolled state. Supply `open` and update it in `onOpenChange(open, event)` for controlled state.
- `dialog.trigger()` adapts a native button. It toggles the dialog and records the opener for focus return. Disabled and `aria-disabled="true"` buttons do not toggle. Its default type is `button`.
- `dialog.surface({ initialFocus, finalFocus })` adapts an element with `role="dialog"`, a programmatic focus target, and accessible labeling. Supply `role="alertdialog"` for an alert dialog. Keep the surface rendered while it closes if you want exit motion.
- `dialog.backdrop()` registers an optional element below the surface. Put it beside the surface, inside the same context.
- `dialog.close()` adapts a native button to request closing. Its default type is `button`; use normal form submission and controlled state when closing depends on a successful save.
- `dialog.title()` and `dialog.description()` associate a heading and description with the surface. Explicit `aria-label`, `aria-labelledby`, and `aria-describedby` on the surface take precedence. Always provide an accessible name.
- `dialog.focusOnShow()` registers an initial focus target. Without one, opening focuses the first tabbable element or the surface. Touch opening defaults to the surface to avoid opening a virtual keyboard.
- `dialog.focusOnHide()` registers a focus return target. Otherwise, closing returns focus to the opener or the previously focused element.

The surface's focus options accept an element or a callback returning one. `false` disables the dialog's automatic focus movement. Use `focusOnShow()` or `initialFocus` for focus on every opening; an `autofocus` attribute follows ordinary document insertion behavior. Application focus calls remain app-owned. `true`, `null`, and `undefined` use the default. Callbacks run when focus moves, so targets can change while the dialog is open.

`Context` accepts these interaction options:

| Option                | Default | Behavior                                                                                                                           |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `modal`               | `true`  | Traps focus, hides background content from assistive technology, blocks outside interaction, and locks page scrolling.             |
| `modal="trap-focus"`  |         | Traps focus and hides background content from assistive technology, while allowing outside pointer interaction and page scrolling. |
| `modal={false}`       |         | Allows focus and pointer interaction outside. Focus departure requests closing.                                                    |
| `closeOnEscape`       | `true`  | Escape requests closing the topmost open layer.                                                                                    |
| `closeOnOutsideClick` | `true`  | Outside clicks request closing. Also controls focus-departure dismissal in non-modal mode.                                         |

`onOpenChange` receives a cancelable `DialogChangeEvent` with `open`, `reason`, and `sourceEvent`. Reasons are `trigger`, `close`, `escape-key`, `outside-click`, `focus-out`, and `programmatic`. Call `event.preventDefault()` to reject the request. The same event bubbles through the surface's DOM ancestors as `rmx:dialog-change`; use `dialog.onDialogChange(handler, captureBoolean?)` to listen on an ancestor. Inspect `event.target` when listening around nested dialogs. With a portal, use `onOpenChange` or attach the event handler inside the portal.

`onOpenChangeComplete(open)` runs after the surface and backdrop finish their finite animations and transitions. Infinite decorative animations do not delay completion. A later state change supersedes an unfinished transition.

For imperative opening, `ref` receives a stable `DialogRef` with `open`, `show(trigger?)`, and `close()`. Pass an external trigger to `show()` to return focus to it. Keep any trigger-specific payload in application state.

## Controlled state

```tsx
import type { Handle } from 'remix/component'
import * as dialog from '@remix-run/ui/dialog'
import { Portal } from '@remix-run/ui/portal'

function Preferences(handle: Handle) {
  let open = false
  return () => (
    <dialog.Context
      open={open}
      onOpenChange={(nextOpen) => {
        open = nextOpen
        void handle.update()
      }}
    >
      <button mix={dialog.trigger()}>Preferences</button>
      <Portal>
        <div aria-label="Preferences" mix={dialog.surface()}>
          <button mix={dialog.close()}>Done</button>
        </div>
      </Portal>
    </dialog.Context>
  )
}
```

## Nesting and motion

Place a child `dialog.Context` inside its parent's surface. Escape and outside clicks dismiss only the topmost dialog or popup. Release Escape before pressing it again to dismiss the next layer. Menus, selects, comboboxes, and popovers share this order, and Tab from a menu still obeys the containing dialog's focus boundary. Closing a parent also closes its nested dialogs.

A Remix popover anchored inside a dialog belongs to that dialog even when its surface is rendered elsewhere in the document. Its content remains focusable, interaction inside it does not dismiss the dialog, and closing the dialog releases the popup and its scroll lock. Ownership lasts for the open session, including when the anchor is removed. A non-modal or focus-trap-only child retains its modal parent's restrictions on the rest of the page.

`data-state="open"` and `data-state="closed"` are available on triggers, surfaces, and backdrops. Nested surfaces also receive `data-nested`. Style transitions with these attributes and `@starting-style`; the surface and backdrop remain visible until exit motion finishes. Respect `prefers-reduced-motion` in consumer styles.

The `data-open` attribute remains on surfaces and backdrops while they are visible, including exit motion. Closed content is hidden with structural CSS. Inline server rendering produces hidden accessible markup; portals emit only a marker and mount their children in the browser.

## Integration limits

Dialogs and popovers share visual and dismissal order. A backdrop sits immediately below its dialog and above lower layers. Set `--rmx-layer-base` on the document root to offset the stack relative to application chrome. Keep the same base for participating overlays. Use portals to avoid ancestor stacking contexts that would otherwise constrain this order.

Ordinary third-party overlays can appear above these elements using `z-index`. They do not automatically join modal focus, inertness, or dismissal ownership. Use Remix popover mixins for coordinated detached content. Native modal dialogs and native popovers still occupy the browser's separate top layer.

Escape handling does not currently implement device Back dismissal through `CloseWatcher`. Browser coverage includes Chromium, Firefox, and WebKit; physical mobile Safari and assistive-technology combinations require separate validation.
