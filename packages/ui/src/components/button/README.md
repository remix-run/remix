# button

`button` provides the styled button component and button style slots for `remix/components/button`. Use `Button` for ordinary action buttons, or compose flat `button.*Style` exports directly when a higher-level control needs button structure inside its own markup.

## Usage

```tsx
import { Button } from 'remix/components/button'
import * as button from 'remix/components/button'

function Actions() {
  return (
    <div>
      <Button startIcon={<PlusIcon />} tone="primary">
        Create project
      </Button>

      <a href="/projects" mix={[button.baseStyle, button.secondaryStyle]}>
        <span mix={button.labelStyle}>View projects</span>
        <ChevronRightIcon mix={button.iconStyle} />
      </a>
    </div>
  )
}

function PlusIcon() {
  return () => (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-linecap="round" />
    </svg>
  )
}

function ChevronRightIcon() {
  return () => (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-linecap="round" />
    </svg>
  )
}
```

## `button.*`

- `Button`: component for the common `base + tone + label/icon slots` case. Pass `tone`, `startIcon`, and `endIcon` when the default authored structure is enough.
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
