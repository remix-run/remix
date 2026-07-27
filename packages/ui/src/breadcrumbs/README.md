# breadcrumbs

`Breadcrumbs` renders semantic breadcrumb navigation from a list of items. Use it when the page needs a compact path back through parent sections.

## Component Usage

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

Mark an earlier item as current when the page belongs to a parent section but the final crumb is still useful context. The current item always renders as text with `aria-current="page"`.

```tsx
<Breadcrumbs
  items={[
    { href: '/', label: 'Home' },
    { current: true, href: '/components', label: 'Components' },
    { label: 'Breadcrumbs' },
  ]}
/>
```

Pass `separator` to replace the default chevron icon.

```tsx
<Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Breadcrumbs' }]} separator="/" />
```

## `remix/ui/breadcrumbs`

- `Breadcrumbs`: component that renders a `<nav>` with an ordered list of breadcrumb items.
- `BreadcrumbItem`: item shape with `label`, optional `href`, and optional `current`.
- `BreadcrumbsProps`: nav props plus required `items` and optional `separator`.

## Behavior Notes

- The default `aria-label` is `"Breadcrumb"` unless an `aria-label` prop is provided.
- Breadcrumb items render inside an ordered list.
- The last item is treated as current when no item has `current: true`.
- An explicit current item wins over the last-item default.
- Current items render as text with `aria-current="page"`, even when they include `href`.
- Non-current items with `href` render as links; non-current items without `href` render as text.
- The default separator is a chevron icon. Separators render between items and are hidden from assistive technology.
