# select

`select` is a headless button-triggered popup value picker backed by `listbox` and `popover`. Use it when the user should choose one stable string value from a finite set and you want to own the rendered structure and styles.

## Usage

```tsx
import type { Handle } from 'remix/ui'
import * as popover from 'remix/ui/popover'
import * as select from 'remix/ui/select'

function SelectValue(handle: Handle) {
  let context = handle.context.get(select.Context)

  return () => <span>{context.displayedLabel}</span>
}

function IssueTypeSelect() {
  return () => (
    <select.Context defaultLabel="Select a type" name="issueType">
      <button type="button" mix={select.trigger()}>
        <SelectValue />
      </button>
      <popover.Context>
        <div mix={select.popover()}>
          <div mix={select.list()}>
            <div mix={select.option({ label: 'Bug', value: 'bug' })}>Bug</div>
            <div mix={select.option({ label: 'Feature', value: 'feature' })}>Feature</div>
          </div>
        </div>
      </popover.Context>
      <input mix={select.hiddenInput()} />
    </select.Context>
  )
}
```

Styled, fully formed select components live in `remix/components/select`:

```tsx
import { Option, Select } from 'remix/components/select'
```

## `select.*`

- `Context`: provider for selected value, displayed label, option registration, hidden input value, and disabled state.
- `trigger()`: mixin that wires the button trigger, popup opening, closed-trigger typeahead, focus restoration, and selected-value display behavior.
- `popover()`: mixin that controls the popup surface, syncs width to the trigger, and coordinates close behavior.
- `list()`: mixin that connects the listbox behavior to select state.
- `option(options)`: mixin that registers an option with required `label` and `value`, optional `disabled` and `textValue`, and commits selection.
- `hiddenInput()`: mixin for form participation.
- `onSelectChange(...)`: event mixin for the bubbling `SelectChangeEvent`.
- `SelectChangeEvent`: event with `value`, `label`, and `optionId`.
- `SelectContextProps` and `SelectOptionProps`: public TypeScript props for lower-level composition.

## Behavior Notes

- `defaultLabel` is displayed before selection settles. `defaultValue` selects the matching option without replacing the trigger label until a new selection commits.
- Click, `ArrowDown`, and `ArrowUp` open the popup. Focus moves into the list and Escape restores focus to the trigger through popover behavior.
- Reopening highlights the current selected value.
- The popup min-width syncs to the trigger width before opening.
- Closed-trigger typeahead selects a matching option immediately and supports option `textValue`.
- Selecting an option flashes it, waits for the close transition and label delay, updates the displayed label, and dispatches `SelectChangeEvent`.
- Passing `name` with `hiddenInput()` lets the selected value participate in `FormData`.
