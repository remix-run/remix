# Tagged Templates (`html`)

The `html` tagged template produces the same element trees as JSX without a build step or compiler transform. It's an alternative syntax for environments where JSX is unavailable or unwanted.

```ts
import { html } from 'remix/component/tag'

function Greeting() {
  return (props: { name: string }) => html`<div>Hello, ${props.name}!</div>`
}
```

## Import

```ts
import { html } from 'remix/component/tag'
```

The `html` export lives in a separate `remix/component/tag` subpath so it's tree-shaken out of projects that use JSX exclusively.

## Syntax

### Host elements

```ts
html`<div class="greeting">Hello</div>`
```

### Dynamic props

```ts
let cls = 'active'
html`<div class=${cls}>${content}</div>`
```

### Component types

Pass a function reference in the tag position:

```ts
import { Button } from './button.ts'

html`<${Button} label="Click me" />`
```

Close dynamic-type elements with `<//>` (or repeat the reference — the value is ignored on close):

```ts
html`<${Button} label="Click me"><//>`
```

### Self-closing elements

```ts
html`<input type="text" value=${val} />`
html`<br />`
```

### Fragments

Use an empty tag to group elements without adding DOM nodes:

```ts
html`<>
  <li>Item 1</li>
  <li>Item 2</li>
</>`
```

### Spread props

Prefix a spread with `...` immediately before the interpolation:

```ts
let props = { class: 'btn', disabled: true }
html`<button ...${props}>Click</button>`
```

### Boolean attributes

Attributes without a value default to `true`:

```ts
html`<input disabled readonly />`
```

### Nested elements

```ts
html`<ul>
  <li>First</li>
  <li>Second</li>
</ul>`
```

### Children from arrays

Interpolated arrays (e.g. from `.map()`) are passed through as children:

```ts
let items = ['a', 'b', 'c']
html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`
```

### Multiple root elements

When a template produces more than one root element, `html` returns an array:

```ts
let pair = html`<p>First</p><p>Second</p>`
// → [RemixElement, RemixElement]
```

## Full example

```ts
import { html } from 'remix/component/tag'
import type { Handle } from 'remix/component'

function TodoList(handle: Handle) {
  let items = ['Buy groceries', 'Walk the dog']

  return (props: { title: string }) => html`
    <div>
      <h2>${props.title}</h2>
      <ul>
        ${items.map((item) => html`<li>${item}</li>`)}
      </ul>
    </div>
  `
}
```

## Differences from JSX

| Feature | JSX | `html` |
|---------|-----|--------|
| Build step required | Yes | No |
| Static type checking of props | Yes (with TypeScript) | No |
| Closing dynamic components | `</${Comp}>` | `<//>` (preferred) |
| Attribute name | camelCase or lowercase | As written |
| Fragments | `<>...</>` | `<>...</>` |

## See Also

- [Getting Started](./getting-started.md) - JSX-based setup
- [Components](./components.md) - Component structure
