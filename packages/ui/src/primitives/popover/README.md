# Popover

`popover` is a low-level primitive for anchored, dismissible floating panels.

Use it for custom surfaces like filters, inspectors, and view options. Higher-level widgets like menu, select, and combobox should build on top of it instead of exposing raw `popover.*` mixins directly.

## Usage

```tsx
import { css, on, type Handle } from 'remix/ui'
import * as popover from 'remix/ui/popover'

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

      <div
        mix={[
          panel,
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
    </popover.Context>
  )
}

let panel = css({
  background: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '12px',
})
```

## `popover.*`

### `popover.Context`

Provides shared coordination for one popover instance. Render the anchor, any focus targets, and the surface inside the same context.

### `popover.anchor(options)`

Registers the host element as the anchor for the current popover surface.

### `popover.surface({ open, onHide, ... })`

Turns the host into the controlled popover surface.

- Wires `popover="manual"` and native `showPopover()` / `hidePopover()` behavior.
- Calls `onHide` for `Escape` and outside clicks with a `PopoverHideRequest`.
- Restores focus to the registered hide target unless `restoreFocusOnHide: false`.
- Accepts `closeOnAnchorClick: false` when the anchor must stay interactive while open.

Apply this to the actual floating root, not a nested child.

### `popover.focusOnShow()`

Registers the element that should receive focus when the popover opens.

### `popover.focusOnHide()`

Registers the element that should receive focus again when the popover closes.

## Behavior Notes

- Opening anchors the surface to the registered anchor and locks page scrolling until close.
- `onHide` receives `{ reason: 'escape-key' | 'outside-click', target? }`.
- `popover.focusOnShow()` wins on open when present.
- `popover.focusOnHide()` is used on close by default when focus restoration is enabled.
- `closeOnAnchorClick: false` keeps anchor clicks inside the current session, which is useful for input-driven popovers like comboboxes.
