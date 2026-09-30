# toggle

`toggle` provides headless checked-state behavior for switch controls. Use it with native checkbox inputs or custom hosts while keeping markup and visual styles app-owned.

## Usage

Use a native checkbox when you want normal form participation:

```tsx
import * as toggle from '@remix-run/ui/toggle'
import { controlStyle } from './toggle.styles'

function NotificationSetting() {
  return () => (
    <label>
      <input mix={[controlStyle, toggle.control({ defaultChecked: true })]} type="checkbox" />
      Email notifications
    </label>
  )
}
```

The same primitive supports a custom host:

```tsx
import * as toggle from '@remix-run/ui/toggle'
import { controlStyle } from './toggle.styles'

function CustomToggle() {
  return () => (
    <button mix={[controlStyle, toggle.control({ defaultChecked: true })]} type="button">
      Notifications
    </button>
  )
}
```

Use `checked` and `onCheckedChange` for controlled state, or `defaultChecked` for state owned by the primitive.

## `@remix-run/ui/toggle`

- `control(options)`: wires a boolean switch control with checked state, ARIA, keyboard behavior, and native input behavior. Options include controlled `checked`, uncontrolled `defaultChecked`, `onCheckedChange`, and common form-control properties.
- `onToggleChange(handler)`: event mixin for bubbling toggle changes.
- `ToggleChangeEvent`: bubbling event whose `checked` property contains the next state.
- `ToggleControlOptions`: options for controlled and uncontrolled state, disabled and read-only behavior, and native form participation.

## Behavior Notes

- Native checkbox switches use the native `checked` property for state and participate in forms.
- Custom hosts receive `role="switch"`, `aria-checked`, and keyboard handling. Space toggles the control.
- Disabled and read-only controls do not toggle.
- Every switch needs an accessible name, usually from visible label text, `aria-label`, or `aria-labelledby`.
- State changes call `onCheckedChange` and dispatch a bubbling `ToggleChangeEvent`.
