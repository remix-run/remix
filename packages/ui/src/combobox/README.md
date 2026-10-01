# combobox

`combobox` provides headless input-first popup value-picker primitives. Use it when the user should type draft text, filter a popup list, and still commit one stable form value. If you just need a button-triggered picker, use `select` instead.

## Usage

```tsx
import * as combobox from '@remix-run/ui/combobox'
import { inputStyle, listStyle, optionStyle, popoverStyle } from './combobox.styles'

let frameworks = [
  { label: 'Remix', searchValue: ['remix', 'rmx'], value: 'remix' },
  { label: 'React Router', value: 'react-router' },
]

export function FrameworkCombobox() {
  return (
    <combobox.Context name="framework">
      <input mix={[inputStyle, combobox.input()]} placeholder="Search frameworks" />
      <div mix={[popoverStyle, combobox.popover()]}>
        <div mix={[listStyle, combobox.list()]}>
          {frameworks.map((option) => (
            <div key={option.value} mix={[optionStyle, combobox.option(option)]}>
              {option.label}
            </div>
          ))}
        </div>
      </div>
      <input mix={combobox.hiddenInput()} />
    </combobox.Context>
  )
}
```

Listen for committed-value changes on the combobox root or an ancestor:

```tsx
<div
  mix={combobox.onComboboxChange((event) => {
    console.log(event.value, event.label, event.optionId)
  })}
>
  {/* combobox */}
</div>
```

## `@remix-run/ui/combobox`

### `onComboboxChange(...)`

Listens for bubbled committed-value changes. The event includes:

- `event.value`: the committed value or `null`
- `event.label`: the committed option label or `null`
- `event.optionId`: the generated option id or `null`

`ComboboxChangeEvent` is the event class dispatched for committed value changes.

### `combobox.Context`

Coordinates the shared popover and listbox behavior. It owns the draft text, committed value, popup state, and selection timing. Pass `defaultValue` for an initial selection, `disabled` to disable the control, `name` for form participation, and `ref` for imperative access.

### `combobox.input()`

Turns the host input into the combobox input.

- Keeps focus on the input during list navigation and pointer selection.
- Wires `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`.
- Opens from typing, click, and arrow-key navigation.

### `combobox.popover()`

Turns the host into the combobox popover surface.

- Uses the shared popover primitive.
- Keeps anchor clicks inside the session so the input stays interactive while open.
- Applies the combobox open and close reason contract.

### `combobox.list()`

Turns the host into the popup listbox root and applies the generated list id.

### `combobox.option(options)`

Registers one option with the combobox and listbox layers.

- Accepts `label`, `value`, optional `searchValue`, and optional `disabled`.
- Hides non-matching options from the current draft filter.
- Prevents pointer selection from blurring the input before the click commits.

### `combobox.hiddenInput()`

Mirrors the committed value into a hidden input for forms. Apply it to an `<input type="hidden" />` inside the same `combobox.Context`.

### Types

- `ComboboxOpenStrategy`: initial active-option strategy when the popup opens.
- `ComboboxHandle`: imperative ref for reading or updating the combobox value and draft label.
- `ComboboxContextProps`, `ComboboxProps`, `ComboboxOptionOptions`, and `ComboboxOptionProps`: context prop and option types for custom composition.

## Behavior Notes

- Typing opens the popup in hint mode when there are matches.
- If typing leaves no matches, the popup closes immediately without the navigation fade-out.
- Selecting from the list flashes the option, then closes the popup and finally commits the visible input label.
- Typing clears the committed value immediately. The hidden form value becomes empty until the user commits again.
- Blur commits an exact `label` or `searchValue` match. A non-matching blur clears the draft text and committed value.
- Escape keeps exact-match draft text but clears non-matching draft text and selection.
- Disabled options can stay visible in filtered results, but they are skipped by keyboard navigation and selection.

## When To Use Something Else

Use `select` when you want a button-triggered single-select control.

Use `listbox` when you need listbox semantics without an editable text input.

Use `popover` directly for custom floating panels that are not value-picking controls.
