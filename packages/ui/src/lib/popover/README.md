# Popover

`popover` is a low-level primitive for anchored, dismissible popover UI.

Use it for custom panels like view options, filters, inspectors, and other floating surfaces that are not semantically menus, listboxes, or comboboxes. Higher-level widgets can be built on top of it, but it can also be used directly for standalone popover UI.

## Usage

Wrap the trigger(s) and surface in `popover.context`, apply `popover.button(...)` to any opener, and apply `popover.surface()` to the floating root.

```tsx
import { css, type Handle } from 'remix/component'
import { Glyph, popover, ui } from 'remix/ui'

export function ViewOptionsButton() {
  return () => (
    <popover.context>
      <button mix={[popover.button({ placement: 'bottom-end' }), ui.popover.button]}>
        <span mix={ui.button.label}>View options</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>

      <div mix={[popover.surface(), ui.popover.surface]}>
        <div mix={panel}>
          <h2 mix={ui.text.titleSm}>View options</h2>

          <div mix={field}>
            <label mix={ui.text.labelSm}>Grouping</label>
            <select mix={ui.select.input}>
              <option>No grouping</option>
              <option>Status</option>
              <option>Priority</option>
            </select>
          </div>

          <div mix={actions}>
            <button mix={[ui.button.ghost, popover.initialFocus(), popover.dismiss()]}>
              Cancel
            </button>
            <button mix={[ui.button.primary, popover.dismiss()]}>Apply</button>
          </div>
        </div>
      </div>
    </popover.context>
  )
}

let panel = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '12px',
  width: '22rem',
})

let field = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

let actions = css({
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
})
```

## `popover.*`

### `popover.context`

Provides the shared coordinator for one popover session. Every related trigger and the surface must be rendered inside the same context.

### `popover.button(options?)`

Registers an opener for the current popover.

- Opens from pointer, keyboard, and virtual/assistive-technology activation.
- Sets `aria-controls`, `aria-expanded`, and `aria-haspopup="dialog"`.
- Accepts `AnchorOptions` to control how the surface is positioned relative to that opener.

Multiple buttons can point at the same surface. The opener that started the current session controls anchoring and focus return for that session.

### `popover.surface()`

Turns an element into the popover surface.

- Wires up the native manual popover behavior.
- Closes on outside press.
- Closes on `Escape`.
- Closes when focus leaves the surface for another element outside it.
- Restores focus to the session opener by default when closing.

Apply this to the actual floating root, not a nested child inside the panel.

### `popover.initialFocus()`

Marks the element that should receive focus after the popover opens.

If no `popover.initialFocus()` element is registered, focus falls back to the surface itself.

### `popover.dismiss()`

Closes the current popover when the host element is activated.

Use this on buttons or other controls inside the surface that should dismiss the panel.

### `popover.change`

The bubbled event type dispatched from the surface when the open state changes.

The event object includes:

- `event.open`: whether the popover is now open
- `event.opener`: the opener element for the current session, or `null`

```tsx
import { on } from 'remix/component'

<div
  mix={on(popover.change, (event) => {
    console.log(event.open, event.opener)
  })}
/>
```

## Behavior Notes

- The surface is anchored to the opener that started the current session.
- Clicking the same trigger while open closes the popover without immediately reopening from the follow-up click.
- Clicking a different trigger while open is treated as an outside press for the current session.
- Focus returns to the opener after close unless the close path explicitly opts out.
- The primitive owns popover coordination, focus handoff, and dismissal behavior. You still own the panel content, structure, and styling.

## When To Use Something Else

Use `popover` directly when you want a floating panel with custom content.

Do not use it as the final consumer-facing primitive for widgets that need their own semantics and keyboard contracts, such as:

- menus
- listboxes
- comboboxes
- selects

Those should build on top of `popover` rather than exposing raw `popover.*` mixins directly.