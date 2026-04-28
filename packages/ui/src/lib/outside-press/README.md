# onOutsidePress

`onOutsidePress` is a low-level mixin that calls a handler when a primary press starts outside the host element.

Use it to dismiss custom transient UI like floating panels, inspectors, or inline editors. If you are building a popover, menu, or listbox, prefer the higher-level primitive that already owns outside-dismiss behavior.

## Usage

Apply `onOutsidePress(...)` to the element that defines the inside boundary. When a primary outside press starts, close the UI and re-render.

```tsx
import { css, on, type Handle } from 'remix/ui'
import { Button } from '@remix-run/ui/button'
import { onOutsidePress } from '@remix-run/ui/on-outside-pointer-down'

export function FiltersExample(handle: Handle) {
  let open = false

  function setOpen(nextOpen: boolean) {
    open = nextOpen
    void handle.update()
  }

  return () => (
    <div mix={root}>
      <Button
        mix={[
          on('click', () => {
            setOpen(!open)
          }),
        ]}
        tone="secondary"
      >
        Filters
      </Button>

      {open ? (
        <div
          mix={[
            panel,
            onOutsidePress(() => {
              setOpen(false)
            }),
          ]}
        >
          <h2 mix={panelTitle}>Filters</h2>

          <label mix={field}>
            <span mix={fieldLabel}>Status</span>
            <select mix={fieldInput}>
              <option>All</option>
              <option>Open</option>
              <option>Closed</option>
            </select>
          </label>

          <div mix={actions}>
            <Button
              mix={[
                on('click', () => {
                  setOpen(false)
                }),
              ]}
              tone="ghost"
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

let root = css({
  display: 'grid',
  gap: '12px',
})

let panel = css({
  display: 'grid',
  gap: '12px',
  width: '20rem',
  padding: '12px',
})

let field = css({
  display: 'grid',
  gap: '6px',
})

let panelTitle = css({
  margin: 0,
  fontSize: '16px',
  lineHeight: '1.3',
})

let fieldLabel = css({
  fontSize: '12px',
  fontWeight: '600',
})

let fieldInput = css({
  minHeight: '36px',
  paddingInline: '8px',
})

let actions = css({
  display: 'flex',
  justifyContent: 'flex-end',
})
```

## `onOutsidePress`

### `onOutsidePress(handler)`

Runs `handler` when interaction starts outside the host element.

- Apply it to the outermost element that should count as inside.
- `handler` receives either a `pointerdown` or `click` event.
- Use it for dismissal or cancellation paths that should react to outside interaction.

### `OutsidePressEvent`

The event passed to the handler.

- Real primary pointer gestures arrive as `PointerEvent`
- Click-only activations arrive as `MouseEvent`

### `OutsidePressHandler`

The callback signature for `onOutsidePress(handler)`.

```ts
type OutsidePressHandler = (event: OutsidePressEvent) => void
```

## Behavior Notes

- The mixin only reacts to presses whose target is outside the host element.
- Real outside pointer gestures fire from `pointerdown`, not from the follow-up `click`.
- After a primary `pointerdown`, the paired outside `click` is suppressed so the handler only runs once.
- That suppression also covers pointer gestures that start inside the host and release outside it.
- Click-only outside activation still fires the handler on `click` (virtual AT click).
- Non-primary or non-left-button pointer interaction is ignored.
- When the mixin is removed, it stops listening for outside interaction.

## When To Use Something Else

Use `onOutsidePress` when you already own the open state and just need a reliable outside-dismiss signal.

Prefer a higher-level primitive when you also need popup semantics, focus management, anchoring, or keyboard behavior, such as:

- `popover`
- `Menu`
- `Listbox`
