# radio

`radio` is a style mixin for native radio inputs. It only owns radio visuals and the default `type="radio"` behavior for native `<input>` hosts.

## Primitive Usage

```tsx
import radio from 'remix/ui/radio'

function ShippingSpeed() {
  return () => (
    <fieldset>
      <label>
        <input defaultChecked mix={radio()} name="shipping-speed" value="standard" />
        Standard
      </label>
      <label>
        <input mix={radio({ size: 'lg' })} name="shipping-speed" value="express" />
        Express
      </label>
    </fieldset>
  )
}
```

Compose app-owned styles around the primitive when a radio option needs local layout:

```tsx
import radio from 'remix/ui/radio'
import { optionStyle } from './shipping.styles'

function ShippingOption() {
  return () => (
    <label mix={optionStyle}>
      <input mix={radio()} name="shipping-speed" value="overnight" />
      Overnight
    </label>
  )
}
```

## `remix/ui/radio`

- `radio(options)`: style mixin for native radio inputs or radio-like hosts.
- `RadioOptions`: accepts `size`.
- `RadioSize`: `'md'` or `'lg'`. Defaults to `'md'`.

## Behavior Notes

- `radio()` returns a mixin descriptor, so it composes with other mixins in the host element's `mix` prop.
- Native `<input>` hosts receive `type="radio"` unless an explicit `type` is provided.
- Radio state is native browser behavior. The mixin also styles `aria-checked="true"` and `data-state="checked"` for custom hosts.
- Disabled hosts use the shared disabled treatment through `disabled` or `aria-disabled="true"`.
