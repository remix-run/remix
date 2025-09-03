# Route Pattern

A powerful and flexible URL pattern matching library for modern JavaScript applications. Route Pattern provides type-safe URL parsing and generation with a powerful, intuitive syntax.

## Why Route Pattern?

- **Comprehensive URL Matching**: Match complete URLs including protocol, hostname, port, pathname, and query parameters
- **Developer-Friendly Syntax**: Clean, readable patterns inspired by Rails routing
- **Type Safety**: Generate URLs with type-safe parameter validation and autocompletion
- **Universal Runtime Support**: Works seamlessly across all JavaScript environments including Node.js, Bun, Deno, Cloudflare Workers, and browsers

## Quick Start

```tsx
import { RoutePattern } from '@remix-run/route-pattern'

let pattern = new RoutePattern('users/:id')
pattern.match('https://shopify.com/users/sarah')
// { params: { id: 'sarah' } }
```

## Examples

Handle date-based URLs with optional file extensions:

```tsx
let pattern = new RoutePattern('blog/:year-:month-:day/:slug(.html)')
pattern.match('https://remix.run/blog/2024-01-15/introducing-remix')
// { params: { year: '2024', month: '01', day: '15', slug: 'introducing-remix' } }
pattern.match('https://remix.run/blog/2024-01-15/introducing-remix.html')
// { params: { year: '2024', month: '01', day: '15', slug: 'introducing-remix' } }
```

Support flexible API versioning with backward compatibility:

```tsx
let pattern = new RoutePattern('api(/v:major(.:minor))/customers/:id(.json)')
pattern.match('https://shopify.com/api/customers/emma')
// { params: { id: 'emma' } }
pattern.match('https://shopify.com/api/v2.1/customers/emma.json')
// { params: { major: '2', minor: '1', id: 'emma' } }
pattern.match('https://shopify.com/api/v2/customers/emma.json')
// { params: { major: '2', minor: undefined, id: 'emma' } }
```

Route requests based on subdomains:

```tsx
let pattern = new RoutePattern('://:store.shopify.com/orders')
pattern.match('https://coffee-roasters.shopify.com/orders')
// { params: { store: 'coffee-roasters' } }
```

Serve files with type validation and nested paths:

```tsx
let pattern = new RoutePattern('assets/*path.{jpg,png,gif,svg,webp}')
pattern.match('https://cdn.shopify.com/assets/images/products/sneakers.webp')
// { params: { path: 'images/products/sneakers' } }
pattern.match('https://cdn.shopify.com/assets/styles/main.css')
// null (file type not allowed)
```

## URL Generation

Generate type-safe URLs from your route patterns with type-safe parameter validation:

```tsx
import { createHrefBuilder } from '@remix-run/route-pattern'

let href = createHrefBuilder()

// Complex patterns with optional segments
href('/api/v:version/products/:id.json', {
  version: '2.1',
  id: 'wireless-headphones',
})
// → "/api/v2.1/products/wireless-headphones.json"

// Multi-segment wildcards
href('/assets/*path.jpg', { path: 'images/hero' })
// → "/assets/images/hero.jpg"

// With Query Parameters
href('shoes/:brand?limit=10&sort=asc', { brand: 'nike' }, { limit: 50, sort: 'desc' })
// → "/shoes/nike?limit=50&sort=desc"
```

Include a default host (and optional port) in URLs:

```tsx
let href = createHrefBuilder({ host: 'remix.run:8080' })

href('blog/:slug', { slug: 'remixing-shopify' })
// → "https://remix.run:8080/blog/remixing-shopify"
```

## Pattern Format

Route patterns follow a structured format that mirrors URL anatomy:

```ts
'<protocol>://<hostname>[:<port>]/<pathname>?<search>'
```

### URL Components

**Pathname-Only Matching** (default): When no protocol or hostname is specified, patterns match only the pathname portion:

```tsx
let pattern = new RoutePattern('blog/:id')
pattern.match('https://remix.run/blog/route-discovery')
// { params: { id: 'route-discovery' } }
pattern.match('https://remix.run/blog/remixing-shopify')
// { params: { id: 'remixing-shopify' } }
```

**Query Parameter Matching**: Content after `?` is treated as search parameters:

```tsx
let pattern = new RoutePattern('search?q')
pattern.match('https://remix.run/search?q=routing')
// { params: {} }
```

**Full URL Matching**: Use `://` to specify protocol and hostname patterns:

```tsx
let pattern = new RoutePattern('://:store.shopify.com/admin')
pattern.match('https://bookstore.shopify.com/admin')
// { params: { store: 'bookstore' } }
```

**Port Specification**: Include port numbers directly after the hostname:

```tsx
let pattern = new RoutePattern('://localhost:3000/docs')
pattern.match('http://localhost:3000/docs')
// { params: {} }
```

### Pattern Features

The `protocol`, `hostname`, and `pathname` components support dynamic matching through [variables](#variables), [wildcards](#wildcards), [optionals](#optionals), and [enums](#enums).

Port numbers are matched as literal strings, while search parameters follow standard [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) behavior.

### Variables

Variables capture dynamic URL segments and are denoted by a colon (`:`) followed by a parameter name:

```tsx
let pattern = new RoutePattern('users/@:username')
pattern.match('https://shopify.com/users/@maya')
// { params: { username: 'maya' } }
```

**Naming Requirements**: Variable names must be valid [JavaScript identifiers](https://developer.mozilla.org/en-US/docs/Glossary/Identifier).

**Multiple Variables**: Combine multiple variables within a single segment using non-identifier separators:

```tsx
let pattern = new RoutePattern('api/v:major.:minor')
pattern.match('https://api.shopify.com/api/v2.1')
// { params: { major: '2', minor: '1' } }
```

### Wildcards

Wildcards match multi-segment dynamic content and are represented by an asterisk (`*`):

**Named Wildcards**: Capture the matched content as a parameter:

```tsx
let pattern = new RoutePattern('cdn/*path/v:version')
let match = pattern.match('https://cdn.shopify.com/assets/themes/dawn/v2')
// { params: { path: 'assets/themes/dawn', version: '2' } }
```

**Anonymous Wildcards**: Match content without capturing it:

```tsx
let pattern = new RoutePattern('docs/*.md')
pattern.match('https://remix.run/docs/guides/routing.md')
// { params: {} }
```

Wildcards are ideal for handling nested file paths, package directories, or any URL structure with variable depth.

### Optionals

Mark URL segments as optional by wrapping them in parentheses. Optional segments allow patterns to match both with and without the specified content:

```tsx
let pattern = new RoutePattern('api(/v:version)/products')
pattern.match('https://api.shopify.com/api/products')
// { params: {} }
pattern.match('https://api.shopify.com/api/v2/products')
// { params: { version: '2' } }
```

Optionals are perfect for backward compatibility, feature flags, or supporting multiple URL formats in a single pattern.

### Enums

Restrict matches to specific allowed values using enum syntax with curly braces:

```tsx
let pattern = new RoutePattern('products/:filename.{jpg,png,gif,webp}')
pattern.match('https://cdn.shopify.com/products/sneakers.png')
// { params: { filename: 'sneakers' } }
pattern.match('https://cdn.shopify.com/products/catalog.pdf')
// null (extension not in allowed list)
```

Enums provide type safety and validation, ensuring URLs match only expected formats while maintaining clean parameter extraction.

## Alternatives

- [`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)
- [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
