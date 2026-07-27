# checkbox

`checkbox` is a style mixin for native checkbox inputs. It only owns checkbox visuals, an optional visual state, and the default `type="checkbox"` behavior for native `<input>` hosts.

## Usage

```tsx
import checkbox from 'remix/ui/checkbox'

function VisibilityToggle() {
  return () => (
    <label>
      <input defaultChecked mix={checkbox()} name="visibility" value="archived" />
      Show archived items
    </label>
  )
}
```

Use `size: 'lg'` when the surrounding UI needs a larger visual control:

```tsx
<input mix={checkbox({ size: 'lg' })} />
```

For mixed state, app code owns the checkbox state and the native `indeterminate` property:

```tsx
import checkbox from 'remix/ui/checkbox'

function PermissionParent() {
  let state: 'checked' | 'mixed' | 'unchecked' = 'mixed'

  return () => (
    <input
      checked={state === 'checked'}
      indeterminate={state === 'mixed'}
      mix={checkbox({ state })}
    />
  )
}
```

## `remix/ui/checkbox`

- `checkbox(options)`: style mixin for native checkbox inputs or checkbox-like hosts.
- `CheckboxOptions`: accepts `size` and `state`.
- `CheckboxSize`: `'md'` or `'lg'`. Defaults to `'md'`.
- `CheckboxState`: `'checked'`, `'mixed'`, or `'unchecked'`.

## Behavior Notes

- `checkbox()` returns a mixin descriptor, so it composes with other mixins in the host element's `mix` prop.
- Native `<input>` hosts receive `type="checkbox"` unless an explicit `type` is provided.
- Native input state is browser-owned through `checked`, `defaultChecked`, and user interaction.
- The optional `state` option adds `aria-checked` and `data-state` for app-owned mixed state or custom hosts.
- Checked styles apply through `:checked`, `aria-checked="true"`, or `data-state="checked"`.
- Mixed styles apply through `:indeterminate`, `indeterminate`, `aria-checked="mixed"`, or `data-state="mixed"`.
- Disabled hosts use the shared disabled treatment through `disabled` or `aria-disabled="true"`.
