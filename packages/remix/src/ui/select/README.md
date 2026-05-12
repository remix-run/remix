# select

`Select` is a button-triggered popup value picker backed by `listbox` and `popover`. Use it when the user should choose one stable string value from a finite set.

## Usage

```tsx
import { Option, Select, onSelectChange } from 'remix/ui/select'

export function FrameworkSelect() {
  return (
    <Select
      defaultLabel="Select a framework"
      defaultValue="remix"
      name="framework"
      mix={onSelectChange((event) => {
        console.log(event.value, event.label, event.optionId)
      })}
    >
      <Option label="Remix framework" value="remix">
        Remix
      </Option>
      <Option disabled label="React Router framework" value="react-router">
        React Router
      </Option>
      <Option label="React framework" value="react">
        React
      </Option>
    </Select>
  )
}
```

Use `textValue` when closed-trigger typeahead should match a different string from the visible label.

```tsx
<Select defaultLabel="Select an environment">
  <Option label="Production environment" value="production">
    Production
  </Option>
  <Option label="Staging environment" textValue="beta" value="staging">
    Staging
  </Option>
</Select>
```

Use the lower-level primitives when the trigger or popup structure needs to be owned by another component. Keep the same provider, trigger, popover, list, option, and hidden-input relationship.

```tsx
import type { Handle } from 'remix/ui'
import * as button from 'remix/ui/button'
import * as listbox from 'remix/ui/listbox'
import * as popover from 'remix/ui/popover'
import * as select from 'remix/ui/select'

function SelectValue(handle: Handle) {
  let context = handle.context.get(select.Context)

  return () => <span mix={button.labelStyle}>{context.displayedLabel}</span>
}

function IssueTypeSelect() {
  return () => (
    <select.Context defaultLabel="Select a type" name="issueType">
      <button type="button" mix={[button.baseStyle, select.triggerStyle, select.trigger()]}>
        <SelectValue />
      </button>
      <popover.Context>
        <div mix={[popover.surfaceStyle, select.popover()]}>
          <div mix={[popover.contentStyle, listbox.listStyle, select.list()]}>
            <div mix={[listbox.optionStyle, select.option({ label: 'Bug', value: 'bug' })]}>
              Bug
            </div>
            <div mix={[listbox.optionStyle, select.option({ label: 'Feature', value: 'feature' })]}>
              Feature
            </div>
          </div>
        </div>
      </popover.Context>
      <input mix={select.hiddenInput()} />
    </select.Context>
  )
}
```

## `select.*`

- `Select`: composed trigger, popover, listbox, option list, and optional hidden input for form participation. Accepts `defaultLabel`, `defaultValue`, `disabled`, `name`, and button props.
- `Option`: option wrapper that renders the standard check glyph and label slot. Accepts `label`, `value`, optional `disabled`, and optional `textValue`.
- `onSelectChange(...)`: event mixin for the bubbling `SelectChangeEvent`.
- `Context`, `trigger()`, `popover()`, `list()`, `option(...)`, and `hiddenInput()`: lower-level composition primitives.
- `triggerStyle`: standard select trigger style.
- `SelectChangeEvent`: event with `value`, `label`, and `optionId`.
- `SelectProps`, `SelectContextProps`, and `SelectOptionProps`: public TypeScript props for the composed and lower-level APIs.

## Behavior Notes

- `defaultLabel` is displayed before selection settles. `defaultValue` selects the matching option without replacing the trigger label until a new selection commits.
- `Option.label` is the committed display label and event label. `children` are the rendered option contents.
- Click, `ArrowDown`, and `ArrowUp` open the popup. Focus moves into the list and Escape restores focus to the trigger through popover behavior.
- Reopening highlights the current selected value.
- The popup min-width syncs to the trigger width before opening.
- Closed-trigger typeahead selects a matching option immediately and supports option `textValue`.
- Selecting an option flashes it with `data-select-flash`, waits for the close transition and label delay, updates the displayed label, and dispatches `SelectChangeEvent`.
- Selecting the already-selected value updates state but does not dispatch a change event.
- `SelectChangeEvent` bubbles from the trigger when a trigger exists. It includes `value`, `label`, and `optionId`.
- Passing `name` renders a hidden input so the selected value participates in `FormData`; disabled selects disable the trigger and hidden input.
