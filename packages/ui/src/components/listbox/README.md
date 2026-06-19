# listbox

`listbox` is a headless option-list primitive for controlled selection and highlighting. Use it under components like select and combobox, or directly when you need custom listbox markup.

## Primitive Usage

```tsx
import type { Handle } from 'remix/ui'
import * as listbox from 'remix/components/listbox'
import type { ListboxValue } from 'remix/components/listbox'
import { listStyle, optionStyle } from './listbox.styles'

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
      <div aria-label="Frameworks" tabIndex={0} mix={[listStyle, listbox.list()]}>
        {frameworks.map((option) => (
          <div key={option.value} mix={[optionStyle, listbox.option(option)]}>
            {option.label}
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
    optionStyle,
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

## `remix/components/listbox`

- `listbox.Context`: provider for controlled `value` and `activeValue`, option registration, selection, highlighting, optional ref access, `flashSelection`, `selectionFlashAttribute`, and `onSelectSettled`.
- `listbox.list()`: mixin that wires `role="listbox"`, default `tabIndex={-1}`, keyboard navigation, focus scrolling, and typeahead highlighting.
- `listbox.option(options)`: mixin that registers an option with required `label` and `value`, optional `disabled` and `textValue`, and wires `role="option"`, id, selected, disabled, highlighted, mouse, and click behavior.
- `ListboxValue`: selected or active value, represented as `string | null`.
- `ListboxContext` and `ListboxProviderProps`: provider context and prop types for controlled listboxes.
- `ListboxOption`: option input shape with `label`, `value`, optional `disabled`, and optional `textValue`.
- `ListboxRegisteredOption`: registered option metadata passed to callbacks and refs.
- `ListboxRef`: live ref object exposing active/selected options, option navigation, search matching, scrolling, and selection helpers.

## Behavior Notes

- Selection and highlighting are controlled. `onSelect` and `onHighlight` notify the parent, but DOM state updates after the parent rerenders with new values.
- Disabled options are skipped by keyboard navigation, typeahead, mouse movement, and click selection.
- Arrow keys wrap through enabled options. `Home` and `End` move to enabled boundaries. `Enter` and Space select the active option.
- Typeahead highlights the next matching enabled option without selecting it and supports `textValue`.
- `flashSelection` applies `selectionFlashAttribute` for 60ms, delays `onSelectSettled`, and ignores new highlight/select interactions until the flash completes.
