# Select

`select` is the headless single-select popup module in `remix/ui`. Use `Select` and `Option`
for the ordinary button + popup control, or compose `select.*` directly when you need to own
the markup while keeping the same behavior.

It is for single value selection. Use something else for multi-select lists, action menus, or
generic floating panels.

## Usage

```tsx
import { Option, Select } from 'remix/ui'

function EnvironmentField() {
  return () => (
    <Select initialLabel="Local" defaultValue="local" name="environment">
      <Option label="Local" value="local" />
      <Option label="Staging" value="staging" />
      <Option label="Production" value="production" />
      <Option disabled label="Archived" value="archived" />
    </Select>
  )
}
```

Use `Select` when you want the built-in trigger, popup, list, and hidden input. Drop to
`select.*` when you need custom structure but still want the same open, focus, selection, and
close behavior.

## Export Reference

- `Select`: thin convenience wrapper for the ordinary select shape. It renders a trigger button,
  popup surface, listbox, and optional hidden input. `initialLabel` is the placeholder shown
  before a committed selection label replaces it. `defaultValue` initializes the uncontrolled
  selection. `name` enables the hidden input for form submission.
- `Option`: thin convenience wrapper for one option. `label` is the selected label and event
  payload label. `children` controls the rendered option content when you want different visible
  text. `searchValue` optionally overrides what typeahead matches.
- `select.context`: scopes one select controller. Use it when composing the module directly.
  Accepts `defaultValue`, `disabled`, `name`, and `ref`. The `ref` receives a handle with
  `open()`, `close()`, `requestClose()`, `isOpen`, `value`, `label`, `activeOptionId`, and `id`.
- `select.button()`: apply to the trigger host. It sets the button ARIA wiring, opens on pointer,
  keyboard, and click-only virtual activation, supports `ArrowDown` / `ArrowUp` from the closed
  trigger, and runs typeahead against the current selection while the button has focus.
- `select.popover()`: apply to the popup surface. It turns the host into a manual popover,
  handles `Escape`, listens for outside press, and dispatches the close lifecycle events.
- `select.list()`: apply to the list root. Focus stays on this element while
  `aria-activedescendant` tracks the active option. It handles arrow navigation, `Tab`, `Enter`,
  `Space`, and typeahead that only changes the active option.
- `select.option({ label, value, disabled, searchValue })`: apply to each option host. It
  registers the option, sets `role="option"`, keeps `aria-selected` and `data-highlighted` in
  sync, handles pointer and virtual selection, and matches typeahead against `searchValue` when
  provided or `label` otherwise.
- `select.hiddenInput()`: apply to an `<input>` when you are composing the module directly and
  want form submission. It syncs the input `value` with the current selection and reads `name`
  from `select.context`.
- `select.change`: bubbling event fired after a new selection finishes its flash sequence and the
  popup close transition settles. The event exposes `value`, `label`, and `optionId`.
- `select.closerequest`: bubbling cancelable event fired before the popup closes. The event
  exposes `reason`, `returnFocus`, and `trigger`.

## Behavior Notes

- Opening the popup syncs the surface `min-width` from the trigger and moves focus to the list.
- Click-only virtual activation still opens the popup, so assistive-technology activation follows
  the same path as other opens.
- `ArrowDown` and `ArrowUp` on the closed trigger reopen from the selected option when one exists.
  Otherwise they start from the first or last enabled option.
- Typeahead on the closed trigger changes the selected value immediately and emits `select.change`
  immediately. Typeahead on the open list only changes the active option.
- `pointerleave` clears the active option. After that, the next `ArrowDown` or `ArrowUp` inside
  the open list restarts from the first or last enabled option.
- Typeahead skips disabled options. By default it matches `label`, but `searchValue` can provide a
  string or string[] alias list instead.
- The opening pointer release is ignored if it lands on the option that was already under the
  pointer. If the pointer moves to a different option first, that release is accepted.
- `Tab` does not leave the open popup. It keeps focus on the list and activates the first enabled
  option.
- `Enter` and `Space` on the list select the active option. Repeated `Enter` keydowns are ignored
  so holding the key does not repeatedly select.
- Selection flashes before the popup closes. Public `select.change` is dispatched only after the
  popup close transition settles. If the user reselects the current value, the flash and close
  still happen, but no `select.change` event is emitted.
- The built-in hidden input updates immediately when selection changes. The `Select` wrapper
  commits its visible label after a short internal delay. For popup selections that delay starts
  after the close sequence finishes.

## Deconstructed Usage

```tsx
import { Glyph, select, ui } from 'remix/ui'

function EnvironmentField() {
  return () => (
    <select.context defaultValue="local" name="environment">
      <button mix={[ui.button.select, select.button()]}>
        <span mix={ui.button.label}>Environment</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>

      <div mix={[select.popover(), ui.popover.surface]}>
        <div aria-label="Environment" mix={[select.list(), ui.listbox.surface]}>
          <div mix={[ui.listbox.option, select.option({ label: 'Local', value: 'local' })]}>
            <Glyph mix={ui.listbox.glyph} name="check" />
            <span mix={ui.listbox.label}>Local</span>
          </div>
          <div mix={[ui.listbox.option, select.option({ label: 'Staging', value: 'staging' })]}>
            <Glyph mix={ui.listbox.glyph} name="check" />
            <span mix={ui.listbox.label}>Staging</span>
          </div>
          <div mix={[ui.listbox.option, select.option({ label: 'Production', value: 'production' })]}>
            <Glyph mix={ui.listbox.glyph} name="check" />
            <span mix={ui.listbox.label}>Production</span>
          </div>
          <div
            mix={[
              ui.listbox.option,
              select.option({ disabled: true, label: 'Archived', value: 'archived' }),
            ]}
          >
            <Glyph mix={ui.listbox.glyph} name="check" />
            <span mix={ui.listbox.label}>Archived</span>
          </div>
        </div>
      </div>

      <input mix={select.hiddenInput()} />
    </select.context>
  )
}
```

Use this shape when you want to keep the select behavior but own the markup yourself.

## When To Use Something Else

- Use `Select` when you want the ordinary single-select field with the default structure.
- Use `select.*` when you want the same behavior but need custom markup or a custom trigger.
- Use `listbox` when you need a more headless list surface or multi-select behavior.
- Use `menu` when the popup is choosing actions instead of storing a value.
- Use `popover` when you need a floating panel with no select-specific keyboard or selection
  behavior.
