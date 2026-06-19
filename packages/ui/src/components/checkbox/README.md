# checkbox

`checkbox` is a style mixin for native checkbox inputs. `Checkbox` and its group components are styled wrappers around the lower-level `remix/ui/checkbox` primitives for mixed-state checkboxes and aggregate checkbox groups.

## Component Usage

### Native Input

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

Use `size: 'lg'` when the surrounding UI needs a larger visual control:

```tsx
<input mix={checkbox({ size: 'lg' })} />
```

### Mixed-State Component

Use `Checkbox` when the control can be mixed. It renders a native checkbox input and keeps the native `indeterminate` property in sync.

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

### Checkbox Groups

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

## Primitive Usage

Use the lower-level primitives when app code owns the checkbox markup and styles:

```tsx
import * as checkbox from 'remix/ui/checkbox'
import { controlStyle } from './checkbox.styles'

function CustomCheckbox() {
  return () => (
    <input
      aria-label="Custom checkbox"
      mix={[controlStyle, checkbox.control({ defaultChecked: 'mixed', name: 'selection' })]}
    />
  )
}
```

For checkbox groups, compose `GroupContext` with `parent(...)` and `item(...)` mixins:

```tsx
import * as checkbox from 'remix/ui/checkbox'
import { controlStyle, groupStyle, itemStyle } from './checkbox.styles'

export function PrimitivePermissionGroup() {
  return (
    <checkbox.GroupContext defaultValue={['read']} name="permissions">
      <div aria-label="Permissions" mix={[groupStyle, checkbox.group()]}>
        <label mix={itemStyle}>
          <input aria-label="All permissions" mix={[controlStyle, checkbox.parent()]} />
          All permissions
        </label>

        <label mix={itemStyle}>
          <input aria-label="Read" mix={[controlStyle, checkbox.item({ value: 'read' })]} />
          Read
        </label>
      </div>
    </checkbox.GroupContext>
  )
}
```

## Options

- `size`: `'md'` or `'lg'`. Defaults to `'md'`.

## `remix/components/checkbox`

- `checkbox(options)`: styles a native checkbox input and supplies `type="checkbox"` when the host is an `<input>` without an explicit `type`.
- `Checkbox`: renders a native `input[type="checkbox"]`. `checked` and `defaultChecked` accept `true`, `false`, or `'mixed'`.
- `CheckboxGroup`: renders a `role="group"` wrapper and manages a selected string value array for child checkbox items.
- `CheckboxItem`: renders a native checkbox input controlled by the nearest `CheckboxGroup`.
- `CheckboxGroupParent`: renders a native checkbox input controlled by the nearest `CheckboxGroup`; it is mixed when some enabled child items are selected.
- `onCheckboxChange(handler)` and `onCheckboxGroupChange(handler)`: re-exported primitive event mixins.
- `CheckboxChangeEvent` and `CheckboxGroupChangeEvent`: re-exported primitive event classes.
- `CheckboxSize`, `CheckboxState`, `CheckboxOptions`, `CheckboxProps`, `CheckboxGroupProps`, `CheckboxGroupParentProps`, and `CheckboxItemProps`: public TypeScript types for the composed APIs.

## `remix/ui/checkbox`

- `GroupContext`: lower-level provider for a checkbox group value.
- `control(options)`: wires a standalone checkbox control with `checked`, `mixed`, ARIA, keyboard, and native input behavior.
- `group()`: wires the group wrapper with `role="group"` and disabled state.
- `item(options)`: wires a child checkbox control to the nearest group value.
- `parent(options)`: wires a parent checkbox control to the nearest group and derives `true`, `false`, or `'mixed'` from registered enabled items.
- `onCheckboxChange(handler)` and `onCheckboxGroupChange(handler)`: event mixins for bubbling checkbox and group changes.
- `CheckboxControlOptions`, `CheckboxGroupContextProps`, `CheckboxParentOptions`, `CheckboxItemOptions`, and `CheckboxGroupChangeEventInit`: primitive option and event-init types.

## Behavior Notes

- Checked styles apply through `:checked`, `[aria-checked="true"]`, or `[data-state="checked"]`.
- Mixed styles apply through `:indeterminate`, `[indeterminate]`, `[aria-checked="mixed"]`, or `[data-state="mixed"]`.
- Use `checkbox.control(...)`, `checkbox.parent(...)`, or `checkbox.item(...)` when a raw native input needs live mixed behavior.
- The component control needs an accessible name, usually from `aria-label` or `aria-labelledby`.
