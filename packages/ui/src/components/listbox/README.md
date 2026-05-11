# Listbox

`listbox` is a headless option-list primitive for controlled selection and highlighting. Use it under components like `select` and `combobox`, or directly when you need custom listbox markup.

## Usage

```tsx
import * as listbox from 'remix/ui/listbox'

function FrameworkListbox() {
  let value: string | null = null
  let activeValue: string | null = null

  return (
    <listbox.Context
      value={value}
      activeValue={activeValue}
      onSelect={(nextValue) => {
        value = nextValue
      }}
      onHighlight={(nextValue) => {
        activeValue = nextValue
      }}
    >
      <div aria-label="Frameworks" mix={listbox.list()}>
        <div mix={listbox.option({ label: 'Remix', value: 'remix' })}>Remix</div>
        <div mix={listbox.option({ disabled: true, label: 'React Router', value: 'rr' })}>
          React Router
        </div>
      </div>
    </listbox.Context>
  )
}
```

## `listbox.*`

- `listbox.Context`: provider for controlled `value` and `activeValue`, option registration, selection, highlighting, and optional ref access.
- `listbox.list()`: mixin that wires `role="listbox"`, default `tabIndex={-1}`, keyboard navigation, focus scrolling, and typeahead highlighting.
- `listbox.option(options)`: mixin that registers an option and wires `role="option"`, id, selected, disabled, highlighted, mouse, and click behavior.
- `listStyle`, `optionStyle`, `glyphStyle`, and `labelStyle`: flat style mixins for standard listbox presentation.
- `ListboxRef`: live ref object exposing active/selected options, option navigation, search matching, scrolling, and selection helpers.

## Behavior Notes

- Selection and highlighting are controlled. `onSelect` and `onHighlight` notify the parent, but DOM state updates after the parent rerenders with new values.
- Disabled options are skipped by keyboard navigation, typeahead, mouse movement, and click selection.
- Arrow keys navigate enabled options. `Home` and `End` move to boundaries. `Enter` and Space select the active option.
- `Tab` is prevented and highlights the first enabled option.
- Typeahead highlights the next matching enabled option without selecting it and supports `textValue`.
- `flashSelection` delays settled selection while a temporary selection attribute is applied.
