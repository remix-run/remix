# listbox

`listbox` is a headless option-list primitive for controlled selection and highlighting. Use it under components like `select` and `combobox`, or directly when you need custom listbox markup.

## Usage

```tsx
import type { Handle } from 'remix/ui'
import { Glyph } from 'remix/ui/glyph'
import * as listbox from 'remix/ui/listbox'
import type { ListboxValue } from 'remix/ui/listbox'

function FrameworkListbox(handle: Handle) {
  let value: ListboxValue = 'remix'
  let activeValue: ListboxValue = 'remix'

  return () => (
    <listbox.Context
      value={value}
      activeValue={activeValue}
      onSelect={(nextValue) => {
        value = nextValue
        void handle.update()
      }}
      onHighlight={(nextValue) => {
        activeValue = nextValue
        void handle.update()
      }}
    >
      <div aria-label="Frameworks" tabIndex={0} mix={[listbox.listStyle, listbox.list()]}>
        {frameworks.map((option) => (
          <div key={option.value} mix={[listbox.optionStyle, listbox.option(option)]}>
            <Glyph mix={listbox.glyphStyle} name="check" />
            <span mix={listbox.labelStyle}>{option.label}</span>
          </div>
        ))}
      </div>
    </listbox.Context>
  )
}

let frameworks = [
  { label: 'Remix', value: 'remix' },
  { disabled: true, label: 'React Router', value: 'react-router' },
  { label: 'React', value: 'react' },
  { label: 'Preact', value: 'preact' },
]
```

Use `textValue` when the visible label is not the best string for typeahead search.

```tsx
<div
  mix={[
    listbox.option({
      label: 'Staging',
      textValue: 'beta',
      value: 'staging',
    }),
  ]}
>
  Staging
</div>
```

Use `ref` when a parent component needs imperative coordination with the current option registry.

```tsx
import type { ListboxRef } from 'remix/ui/listbox'

let listboxRef: ListboxRef | undefined

function selectLastOption() {
  listboxRef?.navigateLast()
  void listboxRef?.selectActive()
}

;<listbox.Context
  value={value}
  activeValue={activeValue}
  ref={(ref) => {
    listboxRef = ref
  }}
  onSelect={(nextValue) => {
    value = nextValue
  }}
  onHighlight={(nextActiveValue) => {
    activeValue = nextActiveValue
  }}
>
  {/* listbox markup */}
</listbox.Context>
```

## `listbox.*`

- `listbox.Context`: provider for controlled `value` and `activeValue`, option registration, selection, highlighting, optional ref access, `flashSelection`, `selectionFlashAttribute`, and `onSelectSettled`.
- `listbox.list()`: mixin that wires `role="listbox"`, default `tabIndex={-1}`, keyboard navigation, focus scrolling, and typeahead highlighting.
- `listbox.option(options)`: mixin that registers an option with required `label` and `value`, optional `disabled` and `textValue`, and wires `role="option"`, id, selected, disabled, highlighted, mouse, and click behavior.
- `listStyle`, `optionStyle`, `glyphStyle`, and `labelStyle`: flat style mixins for standard listbox presentation.
- `ListboxValue`: selected or active value, represented as `string | null`.
- `ListboxOption`: option input shape with `label`, `value`, optional `disabled`, and optional `textValue`.
- `ListboxRegisteredOption`: registered option metadata passed to callbacks and refs.
- `ListboxRef`: live ref object exposing active/selected options, option navigation, search matching, scrolling, and selection helpers.

## Behavior Notes

- Selection and highlighting are controlled. `onSelect` and `onHighlight` notify the parent, but DOM state updates after the parent rerenders with new values.
- Disabled options are skipped by keyboard navigation, typeahead, mouse movement, and click selection.
- Arrow keys wrap through enabled options. `Home` and `End` move to enabled boundaries. `Enter` and Space select the active option.
- Mouse movement highlights enabled options. `mouseleave` clears the highlight when leaving the active option.
- `Tab` is prevented and highlights the first enabled option.
- Typeahead highlights the next matching enabled option without selecting it and supports `textValue`.
- Focus and keyboard navigation scroll the active option into view with nearest-edge alignment.
- `flashSelection` applies `selectionFlashAttribute` for 60ms, delays `onSelectSettled`, and ignores new highlight/select interactions until the flash completes.
