# separator

`separator` provides the shared separator style used inside item lists such as menus. Use it on an `<hr>` or an element with `role="separator"` when it needs to align with first-party item indentation.

## Usage

```tsx
import { separatorStyle } from 'remix/ui/separator'

function MenuSeparator() {
  return <hr mix={separatorStyle} />
}
```

## `separator.*`

- `separatorStyle`: CSS mixin for a horizontal separator that follows shared item inset CSS variables.

## Behavior Notes

- The style uses `--rmx-ui-item-inset`, `--rmx-ui-item-indicator-width`, and `--rmx-ui-item-indicator-gap` when a parent list provides them.
- The separator defaults to the UI theme spacing and border token when those variables are not provided.
- This module is style-only; it does not add ARIA attributes or event behavior.
