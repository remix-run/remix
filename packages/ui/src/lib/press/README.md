# Press

`press` is a low-level input primitive that normalizes pointer, keyboard, and assistive-technology click activation into one event model.

Use it when a widget cares about both the press origin and the release target. If you only need ordinary button activation, native `click` on a real `<button>` is usually simpler.

## Usage

Apply `press()` to each host that should participate in the normalized press lifecycle. Use `press.down` for start-of-gesture work and `press.press` for committed activation.

```tsx
import { css, on, type Handle } from 'remix/component'
import { press, ui } from 'remix/ui'

let densities = ['Compact', 'Default', 'Comfortable'] as const

export function DensityPicker(handle: Handle) {
  let preview = 'Default'
  let value = 'Default'

  function setValue(nextValue: string) {
    value = nextValue
    preview = nextValue
    void handle.update()
  }

  return () => (
    <div mix={root}>
      <div mix={group}>
        {densities.map((density) => (
          <button
            key={density}
            mix={[
              value === density ? ui.button.primary : ui.button.secondary,
              press(),
              on(press.down, () => {
                preview = density
                void handle.update()
              }),
              on(press.cancel, () => {
                preview = value
                void handle.update()
              }),
              on(press.press, () => {
                setValue(density)
              }),
            ]}
            type="button"
          >
            {density}
          </button>
        ))}
      </div>

      <output mix={ui.text.labelSm}>Preview: {preview}</output>
    </div>
  )
}

let root = css({
  display: 'grid',
  gap: '12px',
})

let group = css({
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
})
```

## `press.*`

### `press()`

Registers the host element as a press target.

- Apply it to each element that should participate in the normalized press lifecycle.
- Prefer native interactive elements like `<button>` when possible.
- If you apply it to a non-native interactive host, you still own focusability, semantics, and any required ARIA.

### `press.down`

Fires when a press starts on the host.

Use this for origin-based behavior like previews, opening on pointer down, or remembering where the gesture began.

### `press.start`

Alias of `press.down`.

Keep using it where it already exists, but prefer `press.down` in new code.

### `press.up`

Fires on the release target when a press completes over a pressable host.

This may be the same element as `press.down`, or a different `press()` host under the pointer when the interaction ends.

### `press.press`

Fires on the committed activation target after `press.up`.

Use this for the action that should happen once, regardless of whether it came from pointer, keyboard, or virtual click.

### `press.end`

Fires on the origin host when the current press session finishes.

This always belongs to the element where the press began, even if `press.up` and `press.press` land on a different host.

### `press.cancel`

Fires on the origin host when the current press session aborts.

This happens when the interaction ends outside any enabled `press()` host or is otherwise canceled.

### `press.long`

Fires on the origin host after a long press delay.

If you call `event.preventDefault()` in `press.long`, the later `press.press` is suppressed. `press.up` and `press.end` still fire when the interaction completes.

### `PressEvent`

The event object dispatched for all `press.*` lifecycle events.

Useful fields include:

- `event.pointerType`: `'mouse'`, `'touch'`, `'pen'`, `'keyboard'`, or `'virtual'`
- `event.clientX` and `event.clientY`
- modifier keys like `altKey`, `ctrlKey`, `metaKey`, and `shiftKey`
- `event.isVirtual`: convenience boolean for assistive-technology click activation

### `PressPointerType`

The union of pointer sources represented by `PressEvent.pointerType`.

If you need raw event type strings outside the `press` namespace, the package also exports `pressEventType`, `pressStartEventType`, `pressUpEventType`, `pressEndEventType`, `pressCancelEventType`, and `longPressEventType`.

## Behavior Notes

- `press.down` and `press.start` are the same event.
- A pointer gesture can begin on one pressable host and commit on another.
- `press.down` fires on the origin host.
- `press.up` and `press.press` fire on the release target.
- `press.end` always fires on the origin host.
- Releasing outside any enabled `press()` host dispatches `press.cancel` and `press.end` on the origin host, with no `press.up` or `press.press`.
- Keyboard `Enter` and `Space` dispatch the same normalized `down -> up -> end -> press` sequence on the focused host and suppress the native follow-up click.
- A click without a prior pointer sequence is treated as a virtual activation and dispatches `down -> up -> end -> press` with `event.pointerType === 'virtual'`.
- Disabled and `aria-disabled="true"` hosts do not participate.
- `press` does not replace hover or current-under-pointer behavior. Keep using raw `pointermove` and `pointerleave` when a widget needs that distinction.

## When To Use Something Else

Use native `click` when a plain button only needs same-target activation.

Use a higher-level primitive when you also need semantics, focus management, or dismissal behavior, such as:

- `popover`
- `listbox`
- `menu`
