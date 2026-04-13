# Combobox

`combobox` is the headless single-select input + popup module in `remix/ui`. Use `Combobox` and
`ComboboxOption` for the ordinary text-input combobox, or compose `combobox.*` directly when you
need custom markup while keeping the same filtering, active-descendant, and committed-value
behavior.

It is for choosing one known value from a list of options. Use something else for free-text submit,
multi-select tokens, or action menus.

## Usage

```tsx
import { Combobox, ComboboxOption } from 'remix/ui'

function EnvironmentField() {
  return () => (
    <div>
      <label for="environment">Environment</label>
      <Combobox inputId="environment" name="environment" placeholder="Search environments">
        <ComboboxOption searchValue={['local', 'dev', 'workbench']} label="Local" value="local" />
        <ComboboxOption searchValue={['staging', 'beta']} label="Staging" value="staging" />
        <ComboboxOption label="Production" value="production" />
        <ComboboxOption disabled label="Archived" value="archived" />
      </Combobox>
    </div>
  )
}
```

Use `Combobox` when you want the built-in input, popup, list, and hidden input. Drop to
`combobox.*` when you need custom structure but still want the same filtering, keyboard behavior,
and form serialization.

## Export Reference

- `Combobox`: thin convenience wrapper for the ordinary combobox shape. It renders an input, popup
  surface, listbox, and optional hidden input. `defaultValue` initializes the uncontrolled
  selection and also seeds the input's initial DOM value. `inputId` lets an external `<label>`
  target the internal input. `placeholder` is the empty input text. `name` enables the hidden input
  for form submission.
- `ComboboxOption`: thin convenience wrapper for one option. `label` becomes the committed input
  text and event label. `children` controls the rendered option content when you want different
  visible text. `searchValue` optionally overrides what filtering and exact-match commit use.
- `combobox.context`: scopes one combobox controller. Use it when composing the module directly.
  Accepts `defaultValue`, `disabled`, `name`, and `ref`. The `ref` receives a handle with
  `open()`, `close()`, `isOpen`, `inputText`, `value`, `label`, `activeOptionId`, and `id`.
- `combobox.input()`: apply to the input host. It sets the combobox ARIA wiring, keeps focus on
  the input, opens from arrow keys, filters options from typed text, and owns
  `aria-activedescendant`.
- `combobox.popover()`: apply to the popup surface. It turns the host into a manual popover,
  anchors it to the input at `bottom-start`, and closes it on outside press.
- `combobox.list()`: apply to the list root. It registers the listbox id that the input references
  through `aria-controls`.
- `combobox.option({ label, value, disabled, searchValue })`: apply to each option host. It
  registers the option, sets `role="option"`, keeps `aria-selected`, `data-highlighted`, and
  `hidden` in sync, and handles pointer and virtual selection.
- `combobox.hiddenInput()`: apply to an `<input>` when you are composing the module directly and
  want form submission. It syncs the current committed value and reads `name` from
  `combobox.context`.
- `combobox.change`: bubbling event fired when the committed selection changes. Pointer and keyboard
  option selection dispatch after the selection flash settles. The event exposes `value`, `label`,
  and `optionId`. They become `null` when invalid draft text clears the current selection.

## Behavior Notes

- Focus stays on the input the whole time. The popup list never takes focus.
- The input owns `aria-activedescendant`, `aria-controls`, `aria-expanded`, and
  `aria-autocomplete="list"`.
- Typing filters options by prefix using `searchValue` when present or `label` otherwise, and it
  immediately clears the committed selection and hidden input value.
- Empty input text and zero matches close the popup.
- `ArrowDown` and `ArrowUp` open the popup from the closed input. When the current input text
  exactly matches an option, they reopen an unfiltered list and keep that option active.
- `Enter` only selects the active option when the popup is already open. It does not open the
  popup from the closed input.
- Pointer and `Enter` selection flash the committed option before the popup closes. The hidden
  value and `combobox.change` update before the visible input text commits to the selected label.
- `Space` stays ordinary text input.
- `blur` commits an exact `label` or `searchValue` match without rewriting the visible input text.
- `Escape` keeps exact-match draft text, but clears non-matching draft text and clears the
  selection.
- Pointer selection keeps focus on the input.
- Disabled options stay visible when they match the current filter, but active-descendant movement
  and selection skip them.

## When To Use Something Else

- Use `Select` when you want a button trigger instead of an editable input.
- Use `select.*` when the input pattern is wrong and the closed control should look like a trigger.
- Use `listbox` when focus should move into the list itself or when you need multi-select behavior.
- Use `menu` when the popup is choosing actions instead of storing a committed value.
- Use `popover` when you need a generic floating panel with no combobox-specific filtering or
  selection behavior.
