# checkbox

`checkbox` is a style mixin for native checkbox inputs. `Checkbox` is a styled component wrapper around the lower-level `remix/ui/checkbox` primitives for mixed-state checkboxes that need ARIA, keyboard, and hidden-input form behavior coordinated for you.

## Native Input

```tsx
import checkbox from 'remix/components/checkbox'

function VisibilityToggle() {
  return () => (
    <label>
      <input mix={checkbox()} defaultChecked />
      Show archived items
    </label>
  )
}
```

Use `size: 'lg'` when the surrounding UI needs a larger hit target or visual control:

```tsx
<input mix={checkbox({ size: 'lg' })} />
```

## Mixed-State Component

Use `Checkbox` when the control can be mixed. It renders a focusable visual checkbox and a hidden native checkbox input for form semantics.

```tsx
import { Checkbox } from 'remix/components/checkbox'

function PermissionToggle() {
  return () => (
    <Checkbox
      aria-label="Toggle permissions"
      defaultChecked="mixed"
      name="permissions"
      onCheckedChange={(checked) => {
        console.log(checked)
      }}
    />
  )
}
```

## Checkbox Groups

Use `CheckboxGroup`, `CheckboxItem`, and `CheckboxGroupParent` when a parent checkbox should reflect a set of children. The parent becomes mixed when only some enabled child values are selected.

```tsx
import { CheckboxGroup, CheckboxGroupParent, CheckboxItem } from 'remix/components/checkbox'

function Permissions() {
  return () => (
    <CheckboxGroup
      defaultValue={['read']}
      name="permissions"
      onValueChange={(value) => console.log(value)}
    >
      <label>
        <CheckboxGroupParent aria-label="All permissions" />
        All permissions
      </label>
      <label>
        <CheckboxItem value="read" />
        Read
      </label>
      <label>
        <CheckboxItem value="write" />
        Write
      </label>
    </CheckboxGroup>
  )
}
```

## Options

- `size`: `'md'` or `'lg'`. Defaults to `'md'`.

## API

- `checkbox(options)`: styles a native checkbox input and supplies `type="checkbox"` when the host is an `<input>` without an explicit `type`.
- `Checkbox`: renders a visible `role="checkbox"` control plus a hidden `input[type="checkbox"]`. `checked` and `defaultChecked` accept `true`, `false`, or `'mixed'`.
- `CheckboxGroup`: renders a `role="group"` wrapper and manages a selected string value array for child checkbox items.
- `CheckboxItem`: renders a checkbox controlled by the nearest `CheckboxGroup`.
- `CheckboxGroupParent`: renders a checkbox controlled by the nearest `CheckboxGroup`; it is mixed when some enabled child items are selected.
- `onCheckboxChange(handler)`: listens for primitive checkbox changes from an ancestor via a bubbling `CheckboxChangeEvent`.
- `onCheckboxGroupChange(handler)`: listens for group value changes from an ancestor via a bubbling `CheckboxGroupChangeEvent`.

Lower-level primitive providers and mixins live in `remix/ui/checkbox` for custom markup:

```tsx
import checkboxStyles from 'remix/components/checkbox'
import * as checkbox from 'remix/ui/checkbox'

function CustomCheckbox() {
  return () => (
    <checkbox.Context defaultChecked="mixed">
      <span aria-label="Custom checkbox" mix={[checkboxStyles(), checkbox.control()]} />
      <checkbox.UncheckedInput />
      <input mix={[checkboxStyles(), checkbox.hiddenInput()]} />
    </checkbox.Context>
  )
}
```

## Behavior Notes

- Checked styles apply through `:checked`, `[aria-checked="true"]`, or `[data-state="checked"]`.
- Mixed styles apply through `:indeterminate`, `[indeterminate]`, `[aria-checked="mixed"]`, or `[data-state="mixed"]`.
- For raw native inputs, set the native `indeterminate` DOM property yourself when you need live mixed behavior.
- For the primitive, mixed state maps to `aria-checked="mixed"` and synchronizes the hidden input's `indeterminate` property after render.
- The primitive control needs an accessible name, usually from `aria-label` or `aria-labelledby`.
