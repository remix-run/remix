# Combobox

`Combobox` is the input-first popup value picker for `remix/ui`.

Use it when the user should type draft text, filter a popup list, and still commit one stable form value. If you just need a button-triggered picker, use `Select` instead.

## Usage

```tsx
import { css, type Handle } from 'remix/ui'
import { Combobox, ComboboxOption, onComboboxChange } from 'remix/ui'

let airports = [
  {
    label: 'Los Angeles International',
    searchValue: ['lax', 'los angeles', 'los angeles international'],
    value: 'LAX',
  },
  {
    label: 'John F. Kennedy International',
    searchValue: ['jfk', 'new york', 'john f. kennedy international'],
    value: 'JFK',
  },
] as const

export default function AirportField(handle: Handle) {
  let value: string | null = null

  return () => (
    <div mix={root}>
      <Combobox
        inputId="airport"
        mix={onComboboxChange((event) => {
          value = event.value
          void handle.update()
        })}
        name="airport"
        placeholder="Search airports or codes"
      >
        {airports.map((airport) => (
          <ComboboxOption
            key={airport.value}
            label={airport.label}
            searchValue={airport.searchValue}
            value={airport.value}
          />
        ))}
      </Combobox>

      <p>{`value=${value ?? 'null'}`}</p>
    </div>
  )
}

let root = css({
  display: 'grid',
  gap: '8px',
})
```

## Public API

### `Combobox`

The convenience component.

- Renders the text input, popover surface, listbox root, and hidden form input.
- Dispatches a bubbled custom event that `onComboboxChange(...)` listens for when the committed value changes.
- Accepts `defaultValue`, `disabled`, `inputId`, `name`, and `placeholder`.

### `ComboboxOption`

The default option row for `Combobox`.

- Uses the shared listbox option visuals.
- Accepts `label`, `value`, optional `searchValue`, and optional `disabled`.
- `searchValue` can be a string or string array for aliases like airport codes, abbreviations, or alternate labels.

### `onComboboxChange(...)`

The listener mixin for bubbled committed-value changes.

The event object includes:

- `event.value`: the committed value or `null`
- `event.label`: the committed option label or `null`
- `event.optionId`: the generated option id or `null`

### `combobox.Context`

The lower-level coordinator for custom combobox composition.

It wraps the shared `popover` and `listbox` contexts and owns the draft text, committed value, popup state, and selection timing.

### `combobox.input()`

Turns the host input into the combobox input.

- Keeps focus on the input during list navigation and pointer selection.
- Wires `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`.
- Opens from typing, click, and arrow-key navigation.

### `combobox.popover()`

Turns the host into the combobox popover surface.

- Uses the shared popover primitive.
- Keeps anchor clicks inside the session so the input stays interactive while open.
- Applies the combobox open/close reason contract used by `combobox.popoverStyle`.

### `combobox.list()`

Turns the host into the popup listbox root and applies the generated list id.

### `combobox.option(options)`

Registers one option with the combobox and listbox layers.

- Accepts `label`, `value`, optional `searchValue`, and optional `disabled`.
- Hides non-matching options from the current draft filter.
- Prevents pointer selection from blurring the input before the click commits.

### `combobox.hiddenInput()`

Mirrors the committed value into a hidden input for forms.

Apply it to an `<input type="hidden" />` inside the same `combobox.Context`.

## Behavior Notes

- Typing opens the popup in hint mode when there are matches.
- If typing leaves no matches, the popup closes immediately without the navigation fade-out.
- Selecting from the list flashes the option, then closes the popup and finally commits the visible input label.
- Typing clears the committed value immediately; the hidden form value becomes empty until the user commits again.
- Blur commits an exact `label` or `searchValue` match. A non-matching blur clears the draft text and committed value.
- `Escape` keeps exact-match draft text but clears non-matching draft text and selection.
- Disabled options can stay visible in filtered results, but they are skipped by keyboard navigation and selection.

## When To Use Something Else

Use `Select` when you want the ordinary button-triggered single-select control.

Use `listbox` when you need listbox semantics without an editable text input.

Use `popover` directly for custom floating panels that are not value-picking controls.
