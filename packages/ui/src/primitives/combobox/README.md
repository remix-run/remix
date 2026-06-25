# Combobox

`combobox` is a headless primitive for building editable popup value pickers.

Use it when the user should type draft text, filter a popup list, and commit one stable form value. Styled combobox components live in `remix/components/combobox`.

## Usage

```tsx
import { css, type Handle } from 'remix/ui'
import * as combobox from 'remix/ui/combobox'
import * as listbox from 'remix/ui/listbox'
import * as popover from 'remix/ui/popover'

let root = css({ display: 'grid', gap: '8px', width: '280px' })
let input = css({ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' })
let surface = css({ border: '1px solid #d1d5db', borderRadius: '6px', background: 'white' })
let option = css({ padding: '6px 8px' })

let airports = [
  { label: 'Los Angeles International', searchValue: ['lax', 'los angeles'], value: 'LAX' },
  { label: 'John F. Kennedy International', searchValue: ['jfk', 'new york'], value: 'JFK' },
] as const

export function AirportField(handle: Handle) {
  let value: string | null = null

  return () => (
    <div
      mix={[
        root,
        combobox.onComboboxChange((event) => {
          value = event.value
          void handle.update()
        }),
      ]}
    >
      <combobox.Context defaultValue={value} name="airport">
        <input mix={[input, combobox.input()]} placeholder="Search airports or codes" />
        <popover.Context>
          <div mix={[surface, combobox.popover()]}>
            <div mix={[listbox.list(), combobox.list()]}>
              {airports.map((airport) => (
                <div
                  key={airport.value}
                  mix={[
                    option,
                    combobox.option({
                      label: airport.label,
                      searchValue: airport.searchValue,
                      value: airport.value,
                    }),
                  ]}
                >
                  {airport.label}
                </div>
              ))}
            </div>
          </div>
        </popover.Context>
        <input mix={combobox.hiddenInput()} />
      </combobox.Context>
    </div>
  )
}
```

## `combobox.*`

- `Context`: coordinator for one combobox instance.
- `input()`: turns the host input into the combobox input.
- `popover()`: turns the host into the popup surface.
- `list()`: turns the host into the popup listbox root.
- `option(options)`: registers one option with the combobox and listbox layers.
- `hiddenInput()`: mirrors the committed value into a hidden input for forms.
- `onComboboxChange(...)`: event mixin for the bubbling `ComboboxChangeEvent`.
- `ComboboxChangeEvent`: event with `value`, `label`, and `optionId`.

## Behavior Notes

- Typing opens the popup in hint mode when there are matches.
- If typing leaves no matches, the popup closes immediately without the navigation fade-out.
- Selecting from the list flashes the option, then closes the popup and commits the visible input label.
- Typing clears the committed value immediately; the hidden form value becomes empty until the user commits again.
- Blur commits an exact `label` or `searchValue` match. A non-matching blur clears the draft text and committed value.
- Disabled options can stay visible in filtered results, but they are skipped by keyboard navigation and selection.
