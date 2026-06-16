# button

`button` is a style mixin for pill-shaped action controls. It owns only button-like visual styling and the default `type="button"` behavior for native `<button>` hosts.

## Usage

```tsx
import button from 'remix/ui/button'

function Actions() {
  return () => (
    <div>
      <button mix={button()}>Edit order</button>
      <button mix={button({ size: 'lg', tone: 'primary' })}>Add product</button>
      <button mix={button({ tone: 'ghost' })}>Cancel</button>
    </div>
  )
}
```

## Options

- `size`: `'md'` or `'lg'`. Defaults to `'md'`.
- `tone`: `'neutral'`, `'primary'`, or `'ghost'`. Defaults to `'neutral'`.

## Behavior Notes

- `button()` returns a mixin descriptor, so it composes with other mixins in the host element's `mix` prop.
- Native `<button>` hosts receive `type="button"` unless an explicit `type` is provided.
- Non-button hosts receive styling only.
- Disabled hosts use the shared disabled treatment through `disabled` or `aria-disabled="true"`.
