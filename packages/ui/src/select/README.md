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
    <select.Context defaultLabel="Select a type" name="issueType">
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

- `Context`: provider for select composition. Accepts `defaultLabel`, `defaultValue`, `disabled`, and `name`.
- `trigger()`: wires the trigger button, open behavior, closed-trigger typeahead, and trigger ARIA attributes.
- `popover()`: wires the popover surface and keeps its minimum width synced to the trigger before open.
- `list()`: wires the listbox root used inside the popover.
- `option(...)`: registers one selectable option. Accepts `label`, `value`, optional `disabled`, and optional `textValue`.
- `hiddenInput()`: mirrors the selected value into a hidden input for form participation.
- `onSelectChange(...)`: event mixin for the bubbling `SelectChangeEvent`.
- `SelectChangeEvent`: event with `value`, `label`, and `optionId`.
- `SelectContextProps`: provider props for select composition.

## Behavior Notes

- `defaultLabel` is the initial trigger label. When `defaultValue` is set, pass that option's label: option labels are not known until options register, so the label is not derived from `defaultValue`.
- The option `label` is the committed display label and event label. The host's children are the rendered option contents.
- A primary mouse button press on the trigger opens the popup on `pointerdown`, like native selects, without waiting for the release; the popup opens directly, without a click, and the click that trails the press is ignored. Pressing the trigger again closes it. Touch and pen open on `click` so scrolling and pointer cancellation keep working, and `ArrowDown`, `ArrowUp`, Enter, and Space open from the keyboard. Focus moves into the list and Escape restores focus to the trigger through popover behavior.
- Options commit on `click`, on release, and on press when they also use [`press()`](https://github.com/remix-run/remix/blob/main/packages/ui/src/press/README.md). A press that opened the popup and is released over an option after moving at least 10px commits it, so press, drag, and release selects in one gesture; releasing within 10px of the press, or over the trigger, leaves the popup open. In an open popup, a mouse press that starts on one option and is released over another commits the option under the release, and a release outside the list commits nothing. Options highlight on `pointermove` (mouse and pen, not touch), including while a press is held. Options structurally set `cursor: default` and `user-select: none` (with `-webkit-user-select`), including when disabled, in the `rmx` layer so app styles can override them.
- Dismissing by pressing outside the popup still waits for `click`, and a press that starts inside the popup never dismisses it.
- Reopening highlights the current selected value.
- The popup minimum width syncs to the trigger width before opening.
- Closed-trigger typeahead selects a matching option immediately and supports option `textValue`.
- Selecting an option commits immediately: the displayed label, hidden input value, and `SelectChangeEvent` update while the popup closes with its exit transition.
- Selecting the already-selected value updates state but does not dispatch a change event.
- `SelectChangeEvent` bubbles from the trigger when a trigger exists. It includes `value`, `label`, and `optionId`.
- Passing `name` to `Context` and applying `hiddenInput()` to an input lets the selected value participate in `FormData`. Disabled selects disable the trigger and hidden input.
