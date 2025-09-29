# route-pattern

A powerful and flexible URL pattern matching library for modern JavaScript applications. `route-pattern` provides type-safe URL parsing and generation with a powerful, intuitive syntax.

## Features

- **Comprehensive URL Matching**: Match complete URLs including protocol, hostname, port, pathname, and query parameters
- **Developer-Friendly Syntax**: Clean, readable patterns inspired by Rails routing
- **Type Safety**: Generate URLs with type-safe parameter validation and autocompletion
- **Universal Runtime Support**: Works seamlessly across all JavaScript environments including Node.js, Bun, Deno, Cloudflare Workers, and browsers

## Examples

The following examples show how to create route patterns and use them to match and generate URLs. Parts of a route pattern that begin with a colon (`:`) are dynamic parameters.

```tsx
import { RoutePattern } from '@remix-run/route-pattern'

let pattern = new RoutePattern('blog/:slug')

// URL matching
pattern.match('https://remix.run/blog/remixing-shopify')
// { params: { slug: 'remixing-shopify' } }
pattern.match('https://remix.run/admin')
// null

// URL generation
pattern.href({ slug: 'remixing-shopify' }) // "/blog/remixing-shopify"
```

A single URL segment can contain multiple parameters by separating them with any character that isn't a [valid JavaScript identifier character](https://developer.mozilla.org/en-US/docs/Glossary/Identifier).

Optional parts of the URL are wrapped in parentheses.

```tsx
let pattern = new RoutePattern('blog/:year-:month-:day/:slug(.html)')

pattern.match('https://remix.run/blog/2024-01-15/introducing-remix.html')
// { params: { year: '2024', month: '01', day: '15', slug: 'introducing-remix' } }
pattern.match('https://remix.run/blog/2024-01-15/introducing-remix')
// { params: { year: '2024', month: '01', day: '15', slug: 'introducing-remix' } }

pattern.href({
  year: '2024',
  month: '01',
  day: '15',
  slug: 'introducing-remix',
})
// "/blog/2024-01-15/introducing-remix.html"
```

Optional parts of the URL may be nested to support flexible URL patterns.

```tsx
let pattern = new RoutePattern('api(/v:major(.:minor))/customers/:id(.:format)')

pattern.match('https://shopify.com/api/customers/cari')
// { params: { major: undefined, minor: undefined, id: 'cari', format: undefined } }
pattern.match('https://shopify.com/api/v2.1/customers/cari.json')
// { params: { major: '2', minor: '1', id: 'cari', format: 'json' } }
pattern.match('https://shopify.com/api/v2/customers/cari.json')
// { params: { major: '2', minor: undefined, id: 'cari', format: 'json' } }

pattern.href({ major: '2', minor: '1', id: 'cari', format: 'json' })
// "/api/v2.1/customers/cari.json"
pattern.href({ major: '2', id: 'cari', format: 'json' })
// "/api/v2/customers/cari.json"
pattern.href({ major: '2', id: 'cari' })
// "/api/v2/customers/cari"
pattern.href({ id: 'cari' })
// "/api/customers/cari"
```

URL patterns may match on the full URL, including protocol, hostname, and port.

```tsx
let pattern = new RoutePattern('https://:store.shopify.com/orders')

pattern.match('https://coffee-roasters.shopify.com/orders')
// { params: { store: 'coffee-roasters' } }

pattern.href({ store: 'remix' })
// "https://remix.shopify.com/orders"
```

Wildcards (`*`) are useful for matching nested paths, file paths, or any URL structure with variable depth.

```tsx
let pattern = new RoutePattern('http(s)://cdn.shopify.com/assets/*path.:ext')

pattern.match('https://cdn.shopify.com/assets/products/sneakers.webp')
// { params: { path: 'products/sneakers', ext: 'webp' } }
pattern.match('http://cdn.shopify.com/assets/products/sneakers.webp')
// { params: { path: 'products/sneakers', ext: 'webp' } }

pattern.href({ path: 'remix', ext: 'png' })
// "https://cdn.shopify.com/assets/remix.png"
```

A wildcard that is not followed by an identifier is "unnamed" and won't show up in the params. But it will still match.

```tsx
let pattern = new RoutePattern('files/*')

pattern.match('https://cdn.shopify.com/files/images/logo.png')
// { params: {} }

pattern.href({ '*': 'images/hero.jpg' })
// "/files/images/hero.jpg"
```

## URL Generation

In addition to generating URLs using `pattern.href(...args)`, you can also use the `createHrefBuilder` function to create a custom href builder that can be used to generate URLs from patterns or pattern strings.

URL generation is type-safe, which helps prevent creating invalid URLs. Href builder provides two levels of type-safety:

1. The generic type passed to `createHrefBuilder` restricts the set of patterns that may be used as the first argument.
2. The href builder validates the parameters, making sure you pass the correct parameters for the pattern.

```tsx
import { createHrefBuilder } from '@remix-run/route-pattern'

type ValidPatterns = 'api/v:version/products/:id.json' | 'assets/*path.jpg' | 'shoes/:brand'

// The generic restricts the set of patterns that may be used
let href = createHrefBuilder<ValidPatterns>()

// Complex patterns with optional segments
href('/api/v:version/products/:id.json', { version: '2.1', id: 'wireless-headphones' })
// "/api/v2.1/products/wireless-headphones.json"

// ❌ Type error: Missing required "id" param
href('/api/v:version/products/:id.json', { version: '2.1' })

// Multi-segment wildcards
href('/assets/*path.jpg', { path: 'images/hero' })
// "/assets/images/hero.jpg"

// With Query Parameters
href('/shoes/:brand', { brand: 'nike' }, { limit: 50, sort: 'desc' })
// "/shoes/nike?limit=50&sort=desc"

// ❌ Type error: Invalid route pattern
href('/some/invalid-route')
```

If you don't use the generic type, you can still use `createHrefBuilder` with a string, but you won't get any type safety.

```tsx
let href = createHrefBuilder()

href('blog/:slug', { slug: 'remixing-shopify' })
// "/blog/remixing-shopify"
```

## Pattern Syntax

Route pattern strings follow a structured format that mirrors URL anatomy.

```ts
'[[<protocol>]://<hostname>[:<port>]/]<pathname>?<search>'
```

URL origin (protocol, hostname, and port) is optional.

### URL Components

**Pathname-Only Matching** (default): When no hostname is specified, patterns match only the pathname portion:

```tsx
let pattern = new RoutePattern('blog/:id')
pattern.match('https://remix.run/blog/route-discovery')
// { params: { id: 'route-discovery' } }
pattern.match('https://remix.run/blog/remixing-shopify')
// { params: { id: 'remixing-shopify' } }
```

**Search Parameter Matching**: Content after `?` is treated as search parameters:

```tsx
let pattern = new RoutePattern('search?q')

pattern.match('https://remix.run/search?q') // match!

let match = pattern.match('https://remix.run/search?q=routing') // match!
match.searchParams // new URLSearchParams('?q=routing')
```

If a search parameter is followed by `=`, it must have some value in order to match.

```tsx
let pattern = new RoutePattern('search?q=')
pattern.match('https://remix.run/search?q') // null
pattern.match('https://remix.run/search?q=') // match! (empty string is fine)
pattern.match('https://remix.run/search?q=routing') // match!
```

A search parameter with a specific value(s) matches only if the URL has that value.

```tsx
let pattern = new RoutePattern('search?q=routing')
pattern.match('https://remix.run/search?q') // null
pattern.match('https://remix.run/search?q=') // null
pattern.match('https://remix.run/search?q=routing') // match!
pattern.match('https://remix.run/search?q=routing&utm_source') // also match!
```

You can think about search parameter matching like "narrowing" for a route. Search parameters in a route pattern narrow the set of URLs it matches.

**Full URL Matching**: Use `://` to specify patterns with a protocol and hostname.

```tsx
let pattern = new RoutePattern('http(s)://:store.shopify.com/admin')
pattern.match('https://bookstore.shopify.com/admin')
// { params: { store: 'bookstore' } }
pattern.match('http://bookstore.shopify.com/admin')
// { params: { store: 'bookstore' } }
```

Omitting the protocol in the pattern matches any protocol.

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

The `protocol`, `hostname`, and `pathname` components support dynamic matching through [variables](#variables), [wildcards](#wildcards), and [optionals](#optionals).

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

Wildcards match multi-segment dynamic content and are represented by an asterisk (`*`).

**Named Wildcards** capture the matched content as a parameter:

```tsx
let pattern = new RoutePattern('/*path/v:version')
let match = pattern.match('https://cdn.shopify.com/assets/themes/dawn/v2')
// { params: { path: 'assets/themes/dawn', version: '2' } }
```

**Unnamed Wildcards** match content without capturing it:

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
// { params: { version: undefined } }
pattern.match('https://api.shopify.com/api/v2/products')
// { params: { version: '2' } }
```

Optionals are perfect for backward compatibility, feature flags, or supporting multiple URL formats in a single pattern.

## Alternatives

- [`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)
- [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
