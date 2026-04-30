# button

`button` is the shared button styling contract for `@remix-run/ui`. Use `Button` for ordinary action buttons, or compose flat `button.*Style` exports directly when a higher-level control needs button structure without a wrapper.

## Usage

```tsx
import { Button } from '@remix-run/ui/button'
import * as button from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'

function Actions() {
  return (
    <div>
      <Button startIcon={<Glyph name="add" />} tone="primary">
        Create project
      </Button>

      <a href="/projects" mix={[button.baseStyle, button.secondaryStyle]}>
        <span mix={button.labelStyle}>View projects</span>
        <Glyph mix={button.iconStyle} name="chevronRight" />
      </a>
    </div>
  )
}
```

## `button.*`

- `Button`: thin button wrapper for the common `base + tone + label/icon slots` case. Pass `tone`, `startIcon`, and `endIcon` when the default authored structure is enough.
- `button.baseStyle`: base host styling plus the default `type="button"` behavior for button elements.
- `button.primaryStyle`, `button.secondaryStyle`, `button.ghostStyle`, and `button.dangerStyle`: visual button treatments.
- `button.labelStyle`: inline label slot with the standard button spacing.
- `button.iconStyle`: icon slot sizing and `aria-hidden` defaults for decorative icons.

## Behavior Notes

- `button.baseStyle` only adds `type="button"` when the host element is a `<button>` and no explicit `type` was provided.
- `Button` renders `children` inside `button.labelStyle` and renders `startIcon` and `endIcon` inside `button.iconStyle`.
- Use an explicit accessible name when you render an icon-only button.

## When To Use Something Else

Use `button.*Style` exports directly when a control needs button structure plus extra behavior or layout, like `select`, `menu`, or `tabs`. Those controls own their own interaction mixins and should not hide that behavior behind `Button`.
