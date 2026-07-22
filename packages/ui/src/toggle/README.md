# toggle

`toggle` is a style mixin for checkbox inputs rendered as switches. Use native input props for normal form behavior, and compose it with `remix/ui/toggle/primitives` when you need the headless toggle state helpers or custom hosts.

## Usage

```tsx
import toggle from 'remix/ui/toggle'

function NotificationSetting() {
  return () => (
    <label>
      <input mix={toggle({ size: 'lg' })} defaultChecked />
      Email notifications
    </label>
  )
}
```

## Primitive Usage

Use the lower-level primitive when app code needs normalized checked state, toggle change events, or a non-input host:

```tsx
import toggle from 'remix/ui/toggle'
import * as togglePrimitive from 'remix/ui/toggle/primitives'

function CustomToggle() {
  return () => (
    <button
      aria-label="Notifications"
      mix={[...toggle(), togglePrimitive.control({ defaultChecked: true })]}
    />
  )
}
```

## `remix/ui/toggle`

- `toggle(options)`: styles a native checkbox input as a switch and supplies `type="checkbox"` plus `role="switch"` when the host is an `<input>` without an explicit non-checkbox `type`. Supports `size: 'md' | 'lg'` and defaults to `'md'`.
- `onToggleChange(handler)`: re-exported primitive event mixin.
- `ToggleChangeEvent`: re-exported primitive event class.
- `ToggleSize` and `ToggleOptions`: public TypeScript types for the style mixin.

## `remix/ui/toggle/primitives`

- `control(options)`: wires a boolean switch control with checked state, ARIA, keyboard, and native input behavior.
- `onToggleChange(handler)`: event mixin for bubbling toggle changes.
- `ToggleChangeEvent`: event class dispatched when a toggle changes.
- `ToggleControlOptions`: primitive options for controlled and uncontrolled state.

## Behavior Notes

- Checked styles apply through `:checked`, `[aria-checked="true"]`, or `[data-state="checked"]`.
- Native checkbox switches use the native `checked` attribute for state. Custom hosts use `role="switch"` and `aria-checked="true"` or `aria-checked="false"`.
- Every switch needs an accessible name, usually from visible label text, `aria-label`, or `aria-labelledby`.
