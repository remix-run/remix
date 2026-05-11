# Select

`Select` is a button-triggered popup value picker backed by `listbox` and `popover`. Use it when the user should choose one stable string value from a finite set.

## Usage

```tsx
import { Option, Select, onSelectChange } from 'remix/ui/select'

export function FrameworkSelect() {
  return (
    <Select
      defaultLabel="Select a framework"
      name="framework"
      mix={onSelectChange((event) => {
        console.log(event.value)
      })}
    >
      <Option label="Remix framework" value="remix">
        Remix
      </Option>
      <Option disabled label="React Router framework" value="react-router">
        React Router
      </Option>
    </Select>
  )
}
```

## `select.*`

- `Select`: composed trigger, popover, listbox, option list, and optional hidden input for form participation.
- `Option`: option wrapper that renders the standard check glyph and label slot.
- `onSelectChange(...)`: event mixin for the bubbling `SelectChangeEvent`.
- `select.Context`, `select.trigger()`, `select.popover()`, `select.list()`, `select.option(...)`, and `select.hiddenInput()`: lower-level composition primitives.
- `triggerStyle`: standard select trigger style.
- `SelectChangeEvent`: event with `value`, `label`, and `optionId`.

## Behavior Notes

- `defaultLabel` is displayed before selection settles. `defaultValue` selects the matching option without replacing the trigger label until a new selection commits.
- Click, `ArrowDown`, and `ArrowUp` open the popup. Focus moves into the list and Escape restores focus to the trigger through popover behavior.
- The popup min-width syncs to the trigger width before opening.
- Closed-trigger typeahead selects a matching option immediately and supports option `textValue`.
- Selecting an option flashes it, waits for the close transition and label delay, updates the displayed label, and dispatches `SelectChangeEvent`.
- Passing `name` renders a hidden input so the selected value participates in `FormData`.
