# Route Pattern

Route patterns describe the structure of URLs you want to match.

- Full URL matching, not just pathname
- Familiar syntax inspired by Rails
- Support for all JavaScript runtimes (Node, Bun, Deno, etc.)

## Usage

```tsx
import { RoutePattern } from '@remix-run/route-pattern'

// Blog with optional HTML extension
let pattern = new RoutePattern('blog/:year-:month-:day/:slug(.html)')

pattern.match('https://remix.run/blog/2024-01-15/web-architecture')
// { params: { year: '2024', month: '01', day: '15', slug: 'web-architecture' } }

pattern.match('https://remix.run/blog/2024-01-15/web-architecture.html')
// { params: { year: '2024', month: '01', day: '15', slug: 'web-architecture' } }
```

```tsx
// API with versioning and optional format
let pattern = new RoutePattern('api(/v:major.:minor)/users/:id(.json)')

pattern.match('https://remix.run/api/users/sarah')
// { params: { id: 'sarah' } }

pattern.match('https://remix.run/api/v2.1/users/sarah.json')
// { params: { major: '2', minor: '1', id: 'sarah' } }
```

```tsx
// Multi-tenant applications
let pattern = new RoutePattern('://:tenant.remix.run(/admin)/users/:id')

pattern.match('https://acme.remix.run/users/123')
// { params: { tenant: 'acme', id: '123' } }

pattern.match('https://acme.remix.run/admin/users/123')
// { params: { tenant: 'acme', id: '123' } }
```

```tsx
// Asset serving with type constraints
let pattern = new RoutePattern('assets/*path.{jpg,png,gif,svg}')

pattern.match('https://remix.run/assets/images/logos/remix.svg')
// { params: { path: 'images/logos/remix' } }

pattern.match('https://remix.run/assets/styles/main.css')
// null (wrong file type)
```

## API

**RoutePattern**

```ts
class RoutePattern {
  readonly source: string
  constructor(source: string)
  match(url: string | URL): Match | null
}
```

**Match**

```ts
type Match = {
  params: Record<string, string | undefined>
}
```

## Concepts

Route patterns are split into 4 parts:

```ts
'<protocol>://<hostname>/<pathname>?<search>'
```

By default, patterns are assumed to be `pathname`-only:

```tsx
let pattern = new RoutePattern('blog/:id')

pattern.match('https://remix.run/blog/hello-world')
// { params: { id: 'hello-world' } }

pattern.match('https://example.com/blog/web-dev-tips')
// { params: { id: 'web-dev-tips' } }
```

Everything after the first `?` is treated as the `search`:

```tsx
let pattern = new RoutePattern('search?q')

pattern.match('https://remix.run/search?q=javascript')
// { params: { } }
```

To specify a protocol or hostname, you must use `://` before any `/` or `?`:

```tsx
let pattern2 = new RoutePattern('://:tenant.remix.run/admin')

pattern2.match('https://acme.remix.run/admin')
// { params: { tenant: 'acme' } }
```

The `protocol`, `hostname`, and `pathname` parts support [params](#params), [globs](#globs), [optionals](#optionals), and [enums](#enums).
`search` is instead treated as [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams).

### Params

Params match dynamic parts of a URL within a segment. They're written as `:` followed (optionally) by a name:

```tsx
let pattern = new RoutePattern('users/@:id')

pattern.match('https://remix.run/users/@sarah')
// { params: { id: 'sarah' } }
```

You can put multiple params in a single segment:

```tsx
let pattern = new RoutePattern('api/v:major.:minor')

pattern.match('https://remix.run/api/v2.1')
// { params: { major: '2', minor: '1' } }
```

You can omit the param name (just a `:` with no name) if you don't need the captured value:

```tsx
let pattern = new RoutePattern('products/:-shoes')

pattern.match('https://remix.run/products/tennis-shoes')
// { params: {} }
```

### Globs

Globs match dynamic parts that can span multiple segments. They're written as `*` followed (optionally) by a name:

```tsx
let pattern = new RoutePattern('://app.unpkg.com/*path/dist/:file.mjs')

pattern.match('https://app.unpkg.com/preact@10.26.9/files/dist/preact.mjs')
// { params: { path: 'preact@10.26.9/files', file: 'preact' }}
```

You can omit the glob name if you don't need the captured value:

```tsx
let pattern = new RoutePattern('assets/*/favicon.ico')

pattern.match('https://remix.run/assets/v2/favicon.ico')
// { params: {} }
```

### Optionals

You can mark parts of a pattern as optional by wrapping them in parentheses:

```tsx
let pattern = new RoutePattern('api(/v:version)/users')

pattern.match('https://remix.run/api/users')
// { params: {} }

pattern.match('https://remix.run/api/v2/users')
// { params: { version: '2' } }
```

### Enums

Enums let you match against a specific set of static values:

```tsx
let pattern = new RoutePattern('files/:filename.{jpg,png,gif}')

pattern.match('https://remix.run/files/logo.png')
// { params: { filename: 'logo' } }
```
