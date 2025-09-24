# route-pattern

A powerful and flexible URL pattern matching library for modern JavaScript applications. `route-pattern` provides type-safe URL parsing and generation with a powerful, intuitive syntax.

## Features

- **Comprehensive URL Matching**: Match complete URLs including protocol, hostname, port, pathname, and query parameters
- **Developer-Friendly Syntax**: Clean, readable patterns inspired by Rails routing
- **Type Safety**: Generate URLs with type-safe parameter validation and autocompletion
- **Universal Runtime Support**: Works seamlessly across all JavaScript environments including Node.js, Bun, Deno, Cloudflare Workers, and browsers

## Examples

The following examples show how to create a route map and use it to match and generate URLs.

Parts of a route pattern that begin with a colon (`:`) are dynamic parameters.

```tsx
import { createRoutes, createHrefBuilder } from '@remix-run/route-pattern'

let routes = createRoutes({
  home: '/',
  blog: {
    index: '/blog',
    post: '/blog/:slug',
  },
  profile: '/profiles/:id',
  profiles: {
    index: '/profiles',
    new: '/profiles/new',
    edit: '/profiles/:id/edit',
  },
})

routes.profile.match('https://shopify.com/profiles/1')
// { params: { id: '1' } }
routes.blog.post.match('https://shopify.com/blog/remixing-shopify')
// { params: { slug: 'remixing-shopify' } }

// The generic restricts the set of URLs that may be generated.
let href = createHrefBuilder<typeof routes>()

href(routes.home) // "/"
href(routes.blog.post, { slug: 'remixing-shopify' }) // "/blog/remixing-shopify"
href(routes.profiles.edit, { id: 1 }) // "/profiles/1/edit"
```

A single URL segment can contain multiple parameters by separating them with any character that isn't a [valid JavaScript identifier character](https://developer.mozilla.org/en-US/docs/Glossary/Identifier).

Optional parts of the URL are wrapped in parentheses.

```tsx
let routes = createRoutes({
  blog: {
    index: '/blog',
    post: '/blog/:year-:month-:day/:slug(.html)',
  },
})

routes.blog.post.match('https://remix.run/blog/2024-01-15/introducing-remix')
// { params: { year: '2024', month: '01', day: '15', slug: 'introducing-remix' } }
routes.blog.post.match('https://remix.run/blog/2024-01-15/introducing-remix.html')
// { params: { year: '2024', month: '01', day: '15', slug: 'introducing-remix' } }
```

Optional parts of the URL may be nested to support flexible URL patterns.

```tsx
let routes = createRoutes({
  api: {
    customers: 'api(/v:major(.:minor))/customers/:id(.:format)',
  },
})

routes.api.customers.match('https://shopify.com/api/customers/cari')
// { params: { major: undefined, minor: undefined, id: 'cari', format: undefined } }
routes.api.customers.match('https://shopify.com/api/v2.1/customers/cari.json')
// { params: { major: '2', minor: '1', id: 'cari', format: 'json' } }
routes.api.customers.match('https://shopify.com/api/v2/customers/cari.json')
// { params: { major: '2', minor: undefined, id: 'cari', format: 'json' } }
```

URL patterns may match on the full URL, including protocol, hostname, and port. Pass a "base" pattern to `createRoutes` as the first arg to make all patterns relative to that base.

```tsx
let routes = createRoutes('https://:store.shopify.com', {
  inventory: '/inventory',
  orders: '/orders',
})

routes.orders.match('https://coffee-roasters.shopify.com/orders')
// { params: { store: 'coffee-roasters' } }
```

Wildcards (`*`) are useful for matching nested paths, file paths, or any URL structure with variable depth.

You can also restrict matches to specific allowed values using enum syntax with curly braces, e.g. `{jpg,png}`.

```tsx
let routes = createRoutes({
  images: 'http(s)://cdn.shopify.com/assets/*path.{jpg,png,gif,svg,webp}',
})

routes.images.match('https://cdn.shopify.com/assets/products/sneakers.webp')
// { params: { path: 'products/sneakers' } }
routes.images.match('https://cdn.shopify.com/assets/styles/main.css')
// null (file type not allowed)
```

A wildcard that is not followed by an identifier is "unnamed" and won't show up in the params. But it will still match.

```tsx
let routes = createRoutes({
  images: 'files/*',
})

routes.images.match('https://cdn.shopify.com/files/images/logo.png')
// { params: {} }
```

## URL Generation

URL generation is type-safe, which helps prevent creating invalid URLs. Href builder provides two levels of type-safety:

1. The generic type of the href builder restricts the set of URLs that may be generated. This means you can't use a pattern that is not in the route schema.
2. The href builder validates the parameters, so you can't pass a parameter that is not in the route pattern.

```tsx
import { createHrefBuilder } from '@remix-run/route-pattern'

let routes = createRoutes({
  api: {
    products: '/api/v:version/products/:id.json',
  },
  assets: {
    images: '/assets/*path.jpg',
  },
  products: {
    shoes: '/shoes/:brand',
  },
})

// The generic restricts the set of URLs that may be generated.
let href = createHrefBuilder<typeof routes>()

// Complex patterns with optional segments
href(routes.api.products, { version: '2.1', id: 'wireless-headphones' })
// "/api/v2.1/products/wireless-headphones.json"

// ❌ Type error: Missing required "id" param
href(routes.api.products, { version: '2.1' })

// Multi-segment wildcards
href(routes.assets.images, { path: 'images/hero' })
// "/assets/images/hero.jpg"

// With Query Parameters
href(routes.products.shoes, { brand: 'nike' }, { limit: 50, sort: 'desc' })
// "/shoes/nike?limit=50&sort=desc"

// ❌ Type error: Invalid route pattern
href('/some/invalid-route')
```

If you don't use the generic type, you can still pass in a string, but you won't get any type safety.

Include a default host (and optional port) in URLs:

```tsx
let href = createHrefBuilder({ host: 'remix.run:8080' })

href('blog/:slug', { slug: 'remixing-shopify' })
// "https://remix.run:8080/blog/remixing-shopify"
```

## Low-level RoutePattern API

The `RoutePattern` interface provides a low-level API for matching URLs one at a time.

```tsx
let pattern = new RoutePattern('blog/:slug')
pattern.match('https://remix.run/blog/remixing-shopify')
// { params: { slug: 'remixing-shopify' } }
```

## Pattern Syntax

Route pattern strings follow a structured format that mirrors URL anatomy.

```ts
'[[<protocol>]://<hostname>[:<port>]/]<pathname>?<search>'
```

URL origin (protocol, hostname, and port) is optional.

### URL Components

**Pathname-Only Matching** (default): When no protocol or hostname is specified, patterns match only the pathname portion:

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
