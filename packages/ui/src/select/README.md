# select

`select` provides headless behavior for a button-triggered popup value picker backed by `listbox` and `popover`. Use it when the user should choose one stable string value from a finite set.

## Usage

Keep the provider, trigger, popover, list, option, and hidden-input relationship together:

```tsx
import type { Handle } from 'remix/component'
import * as popover from '@remix-run/ui/popover'
import * as select from '@remix-run/ui/select'
import { listStyle, optionStyle, surfaceStyle, triggerStyle } from './select.styles'

function SelectValue(handle: Handle) {
  let context = handle.context.get(select.Context)

  return () => <span>{context.displayedLabel}</span>
}

function IssueTypeSelect() {
  return () => (
    <select.Context defaultLabel="Select a type" labelSwapDelayMs={100} name="issueType">
      <button mix={[triggerStyle, select.trigger()]} type="button">
        <SelectValue />
      </button>
      <popover.Context>
        <div mix={[surfaceStyle, select.popover()]}>
          <div mix={[listStyle, select.list()]}>
            <div mix={[optionStyle, select.option({ label: 'Bug', value: 'bug' })]}>Bug</div>
            <div mix={[optionStyle, select.option({ label: 'Feature', value: 'feature' })]}>
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

Use `textValue` when closed-trigger typeahead should match a different string from the visible label:

```tsx
<div
  mix={[
    optionStyle,
    select.option({
      label: 'Staging environment',
      textValue: 'beta',
      value: 'staging',
    }),
  ]}
>
  Staging
</div>
```

Listen for committed-value changes on the select root or an ancestor:

```tsx
<div
  mix={select.onSelectChange((event) => {
    console.log(event.value, event.label, event.optionId)
  })}
>
  {/* select */}
</div>
```

## `@remix-run/ui/select`

- `Context`: provider for select composition. Accepts `defaultLabel`, `defaultValue`, `disabled`, `name`, and `labelSwapDelayMs`. The label-swap delay defaults to 75 milliseconds.
- `trigger()`: wires the trigger button, open behavior, closed-trigger typeahead, and trigger ARIA attributes.
- `popover()`: wires the popover surface and keeps its minimum width synced to the trigger before open.
- `list()`: wires the listbox root used inside the popover.
- `option(...)`: registers one selectable option. Accepts `label`, `value`, optional `disabled`, and optional `textValue`.
- `hiddenInput()`: mirrors the selected value into a hidden input for form participation.
- `onSelectChange(...)`: event mixin for the bubbling `SelectChangeEvent`.
- `SelectChangeEvent`: event with `value`, `label`, and `optionId`.
- `SelectContextProps`, `SelectProps`, and `SelectOptionProps`: context prop and option types for custom composition.

## Behavior Notes

- `defaultLabel` is displayed before selection settles. `defaultValue` selects the matching option without replacing the trigger label until a new selection commits.
- The option `label` is the committed display label and event label. The host's children are the rendered option contents.
- Click, `ArrowDown`, and `ArrowUp` open the popup. Focus moves into the list and Escape restores focus to the trigger through popover behavior.
- Reopening highlights the current selected value.
- The popup minimum width syncs to the trigger width before opening.
- Closed-trigger typeahead selects a matching option immediately and supports option `textValue`.
- Selecting an option flashes it with `data-select-flash`, waits for the close transition and label delay, updates the displayed label, and dispatches `SelectChangeEvent`.
- Selecting the already-selected value updates state but does not dispatch a change event.
- `SelectChangeEvent` bubbles from the trigger when a trigger exists. It includes `value`, `label`, and `optionId`.
- Passing `name` to `Context` and applying `hiddenInput()` to an input lets the selected value participate in `FormData`. Disabled selects disable the trigger and hidden input.
