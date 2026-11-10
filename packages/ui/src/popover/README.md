# popover

`popover` provides headless behavior for anchored, dismissible floating panels. Use it for custom surfaces like filters, inspectors, and view options. More specific widgets like menu, select, and combobox build on it.

## Usage

```tsx
import { on, type Handle } from 'remix/component'
import * as popover from '@remix-run/ui/popover'
import { Portal } from '@remix-run/ui/portal'
import { panelStyle } from './popover.styles'

export function ViewOptions(handle: Handle) {
  let open = false

  function openPopover() {
    open = true
    void handle.update()
  }

  function closePopover() {
    open = false
    void handle.update()
  }

  return () => (
    <popover.Context>
      <button
        mix={[
          popover.anchor({ placement: 'bottom-end' }),
          popover.focusOnHide(),
          on('click', openPopover),
        ]}
        type="button"
      >
        View options
      </button>

      <Portal>
        <div
          mix={[
            panelStyle,
            popover.surface({
              open,
              onHide() {
                closePopover()
              },
            }),
          ]}
        >
          <button mix={[popover.focusOnShow(), on('click', closePopover)]} type="button">
            Close
          </button>
          <div>Panel content</div>
        </div>
      </Portal>
    </popover.Context>
  )
}
```

## `@remix-run/ui/popover`

### `popover.Context`

Provides shared coordination for one popover instance. Render the anchor, any focus targets, and the surface inside the same context.

### `popover.anchor(options)`

Registers the host element as the anchor for the current popover surface. A primary-button mouse press on the anchor doesn't take focus when the surface has a `focusOnShow()` target, so an anchor that also uses [`press()`](https://github.com/remix-run/remix/blob/main/packages/ui/src/press/README.md) leaves focus on that target, as a click does. Touch, pen, other buttons and anchors without an initial focus target keep the native press.

### `popover.surface({ open, onHide, ... })`

Turns the host into the controlled popover surface.

- Renders an ordinary element with fixed positioning and shared overlay stacking.
- Exposes `data-popover`, `data-open` while shown, and `data-state="open"` or `"closed"`.
- Calls `onHide` for `Escape` and outside clicks with a `PopoverHideRequest`.
- Restores focus to the registered hide target unless `restoreFocusOnHide: false`.
- Accepts `closeOnAnchorClick: false` when the anchor must stay interactive while open.
- Ignores the `click` of a press that started inside the surface, or before the surface opened. A popover opened on press therefore isn't dismissed when the mouse is released outside it.

Apply this to the actual floating root, not a nested child.

### `popover.focusOnShow()`

Registers the element that should receive focus when the popover opens.

### `popover.focusOnHide()`

Registers the element that should receive focus again when the popover closes.

### Primitive Types

- `PopoverContext`: context object exposed by `popover.Context`.
- `PopoverProps`: provider props for one popover instance.
- `PopoverSurfaceOptions`: options accepted by `popover.surface(...)`.
- `PopoverHideRequest`: hide request passed to `onHide`.

## Behavior Notes

- Opening anchors the surface to the registered anchor and locks page scrolling until close.
- `onHide` receives `{ reason: 'escape-key' | 'outside-click', target? }`.
- `popover.focusOnShow()` wins on open when present.
- `popover.focusOnHide()` is used on close by default when focus restoration is enabled.
- `closeOnAnchorClick: false` keeps anchor clicks inside the current session, which is useful for input-driven popovers like comboboxes.

## Portals and styling

Wrap the surface in `Portal` from `@remix-run/ui/portal` to render in the document body and escape clipping or transformed ancestors. The anchor and surface retain the same component context. Put theme variables and typography on the destination or surface, since DOM inheritance and event bubbling follow the destination. Inline surfaces remain supported when their ancestors permit floating content.

Style visibility with `[data-open]` and entrance/exit motion with `[data-state="open"]` or `[data-state="closed"]`. The surface keeps `data-open`, stacking order, and its scroll lock until finite exit animations finish. Reopening supersedes a pending close. Native `:popover-open`, `beforetoggle`, and `toggle` no longer apply. React to your controlled `open` state and use `handle.queueTask()` for DOM work after rendering. Opening and closing do not invoke native popover methods.

Dialogs, menus, selects, comboboxes, and popovers share stacking and dismissal order. Set `--rmx-layer-base` on the document root to offset all participating overlays relative to other application content. Portals avoid ancestor stacking contexts; arbitrary external widgets still need to respect a modal dialog's focus and inert boundaries.
