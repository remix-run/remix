# input

`input` is a style mixin for text inputs. Use `input()` directly on standalone native inputs, or compose `input.root()` with `input.field()` when the input needs inline icons or controls.

## Usage

```tsx
import input from 'remix/ui/input'

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

## Options

- `size`: `'md'` or `'lg'`. Defaults to `'md'`.

## API

- `input(options)`: styles a standalone native input.
- `input.root(options)`: styles a flex input frame for inline icons, buttons, and a child input.
- `input.field()`: styles the child native input inside `input.root()`.

## Behavior Notes

- `input.root()` uses child selectors to size direct SVG children as presentational icons.
- Put the icon before or after the field to control its visual position.
- Focus and disabled states work through the native input; the root mirrors them with `:focus-within` and `:has(input:disabled)`.
