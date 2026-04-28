# Popover

`popover` is a low-level primitive for anchored, dismissible floating panels.

Use it for custom surfaces like filters, inspectors, and view options. Higher-level widgets like `menu`, `select`, and `combobox` should build on top of it instead of exposing raw `popover.*` mixins directly.

## Usage

```tsx
import { css, on, type Handle } from 'remix/ui'
import { Button } from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { popover } from '@remix-run/ui/popover'

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
      <Button
        endIcon={<Glyph name="chevronDown" />}
        mix={[
          popover.anchor({ placement: 'bottom-end' }),
          popover.focusOnHide(),
          on('click', openPopover),
        ]}
        tone="secondary"
      >
        View options
      </Button>

      <div
        mix={[
          popover.surfaceStyle,
          popover.surface({
            open,
            onHide() {
              closePopover()
            },
          }),
        ]}
      >
        <div mix={popover.contentStyle}>
          <Button mix={[popover.focusOnShow(), on('click', closePopover)]} tone="ghost">
            Close
          </Button>
          <div mix={panelBody}>Panel content</div>
        </div>
      </div>
    </popover.Context>
  )
}

let panelBody = css({
  padding: '12px',
})
```

## `popover.*`

### `popover.Context`

Provides shared coordination for one popover instance. Render the anchor, any focus targets, and the surface inside the same context.

### `popover.anchor(options)`

Registers the host element as the anchor for the current popover surface.

- Accepts standard `AnchorOptions`.
- The stored anchor controls where the surface is positioned when it opens.
- Apply it to the button or other element the surface should attach to.

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

### `popover.surfaceStyle`

Default floating-surface presentation for popovers.

### `popover.contentStyle`

Default inner scroll container for popover content.

## Behavior Notes

- Opening anchors the surface to the registered anchor and locks page scrolling until close.
- `onHide` receives `{ reason: 'escape-key' | 'outside-click', target? }`.
- `popover.focusOnShow()` wins on open when present.
- `popover.focusOnHide()` is used on close by default when focus restoration is enabled.
- `closeOnAnchorClick: false` keeps anchor clicks inside the current session, which is useful for input-driven popovers like comboboxes.

## When To Use Something Else

- Use `menu` for command surfaces.
- Use `listbox` or `select` for committed value picking.
- Use `combobox` for input-first popup selection.
