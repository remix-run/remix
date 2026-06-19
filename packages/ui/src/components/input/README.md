# input

`input` is a style mixin for text inputs. Use `input()` directly on standalone native inputs, or compose `input.root()` with `input.field()` when the input needs inline icons or controls.

## Primitive Usage

```tsx
import input from 'remix/components/input'

function ProductFilters() {
  return () => (
    <div>
      <input mix={input()} placeholder="Limit" />

      <div mix={input.root()}>
        <SearchIcon />
        <input mix={input.field()} placeholder="Search and filter products" />
      </div>
    </div>
  )
}
```

Compose app-owned styles when a field needs local layout or adornments:

```tsx
import input from 'remix/components/input'
import { filterFieldStyle, filterRootStyle } from './filters.styles'

function SearchFilter() {
  return () => (
    <div mix={[filterRootStyle, input.root()]}>
      <SearchIcon />
      <input mix={[filterFieldStyle, input.field()]} placeholder="Search" />
    </div>
  )
}
```

## `remix/components/input`

- `input(options)`: styles a standalone native input. `size` may be `'md'` or `'lg'` and defaults to `'md'`.
- `input.root(options)`: styles a flex input frame for inline icons, buttons, and a child input.
- `input.field()`: styles the child native input inside `input.root()`.
- `InputOptions`: accepts `size`.
- `InputSize`: `'md'` or `'lg'`.

## Behavior Notes

- `input.root()` uses child selectors to size direct SVG children as presentational icons.
- Put the icon before or after the field to control its visual position.
- Focus and disabled states work through the native input; the root mirrors them with `:focus-within` and `:has(input:disabled)`.
