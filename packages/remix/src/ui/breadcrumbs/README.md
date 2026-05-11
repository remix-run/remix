# Breadcrumbs

`Breadcrumbs` renders semantic breadcrumb navigation from a list of items. Use it when the page needs a compact path back through parent sections.

## Usage

```tsx
import { Breadcrumbs } from 'remix/ui/breadcrumbs'

export function ProjectBreadcrumbs() {
  return (
    <Breadcrumbs
      items={[
        { href: '/', label: 'Home' },
        { href: '/projects', label: 'Projects' },
        { label: 'Roadmap' },
      ]}
    />
  )
}
```

## `breadcrumbs.*`

- `Breadcrumbs`: component that renders a `<nav>` with an ordered list of breadcrumb items.
- `BreadcrumbItem`: item shape with `label`, optional `href`, and optional `current`.
- `BreadcrumbsProps`: nav props plus required `items` and optional `separator`.

## Behavior Notes

- The default `aria-label` is `"Breadcrumb"` unless an `aria-label` prop is provided.
- The last item is treated as current when no item has `current: true`.
- An explicit current item wins over the last-item default.
- Current items render as text with `aria-current="page"`, even when they include `href`.
- Non-current items with `href` render as links; non-current items without `href` render as text.
- The default separator is the `chevronRight` glyph. Pass `separator` to render custom separator content.
