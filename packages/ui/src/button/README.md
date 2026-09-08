# button

`button` is a style mixin for pill-shaped action controls. It owns only button-like visual styling and the default `type="button"` behavior for native `<button>` hosts.

## Primitive Usage

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

Compose app-owned styles around the primitive when a control needs local layout or state styling:

```tsx
import button from 'remix/ui/button'
import { toolbarButtonStyle } from './toolbar.styles'

function ToolbarAction() {
  return () => <button mix={[toolbarButtonStyle, button({ tone: 'ghost' })]}>Archive</button>
}
```

## `remix/ui/button`

- `button(options)`: style mixin for native buttons or button-like hosts.
- `ButtonOptions`: accepts `size` and `tone`.
- `ButtonSize`: `'md'` or `'lg'`. Defaults to `'md'`.
- `ButtonTone`: `'neutral'`, `'primary'`, or `'ghost'`. Defaults to `'neutral'`.

## Behavior Notes

- `button()` returns a mixin descriptor, so it composes with other mixins in the host element's `mix` prop.
- Native `<button>` hosts receive `type="button"` unless an explicit `type` is provided.
- Non-button hosts receive styling only.
- Disabled hosts use the shared disabled treatment through `disabled` or `aria-disabled="true"`.
