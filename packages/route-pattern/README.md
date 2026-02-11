# route-pattern

Type-safe URL matching and href generation for JavaScript. `route-pattern` supports path params, wildcards, optionals, and full-URL patterns with predictable ranking.

## Features

- **Type-Safe Params** - Infer params from patterns for compile-time route correctness
- **Flexible Pattern Syntax** - Variables, wildcards, optionals, and query constraints
- **Full URL Support** - Match protocol, host, pathname, and search params
- **Deterministic Ranking** - Static segments beat params, and params beat wildcards
- **Runtime Agnostic** - Works across Node.js, Bun, Deno, Cloudflare Workers, and browsers

## Installation

```sh
npm i remix
```

## Quick Example

```ts
import { RoutePattern } from 'remix/route-pattern'

let blog = new RoutePattern('blog/:slug')
blog.match('https://remix.run/blog/v3') // { params: { slug: 'v3' } }
blog.href({ slug: 'v3' }) // '/blog/v3'

let api = new RoutePattern('api(/v:version)/*path')
api.match('https://api.com/api/v2/users/profile') // { params: { version: '2', path: 'users/profile' } }
api.href({ version: '2', path: 'users/profile' }) // '/api/v2/users/profile'
api.href({ path: 'users/profile' }) // '/api/users/profile'

let cdn = new RoutePattern('http(s)://:region.cdn.com/assets/*file.:ext')
cdn.match('https://us-west.cdn.com/assets/images/logo.png') // { params: { region: 'us-west', file: 'images/logo', ext: 'png' } }
cdn.href({ region: 'us-west', file: 'images/logo', ext: 'png' }) // 'https://us-west.cdn.com/assets/images/logo.png'
```

## Intuitive syntax

**Variables** capture dynamic segments using `:name`:

```ts
new RoutePattern('users/:id') // matches /users/123
new RoutePattern('blog/:year-:month-:day/:slug') // matches /blog/2024-01-15/hello
```

**Wildcards** match multi-segment paths using `*name`:

```ts
new RoutePattern('files/*path') // matches /files/images/logo.png
new RoutePattern('node_modules/*package/dist/index.js') // matches /node_modules/@remix-run/router/dist/index.js
new RoutePattern('files/*') // matches any path under /files, but doesn't capture the value for the wildcard
```

**Optionals** make parts optional using `()`:

```ts
new RoutePattern('api(/v:version)/users') // matches /api/users AND /api/v2/users
new RoutePattern('blog/:slug(.html)') // matches /blog/hello AND /blog/hello.html
new RoutePattern('docs(/guides/:category)') // multiple segments optional: /docs OR /docs/guides/routing
new RoutePattern('api(/v:major(.:minor))') // nested optionals: /api, /api/v2, /api/v2.1
```

**Search params** narrow matches using `?key` or `?key=value`:

```ts
new RoutePattern('search?q') // requires ?q in URL
new RoutePattern('search?q=') // requires ?q with any value
new RoutePattern('search?q=routing') // requires ?q=routing exactly
```

**Flexible matching** for partial URL patterns:

```ts
new RoutePattern('blog/:slug') // omits protocol/hostname, matches any origin
new RoutePattern('://example.com/api') // omits protocol, matches http and https
new RoutePattern('search?q') // allows additional search params beyond ?q
```

## Matchers

Match URLs against multiple patterns. Each pattern can have associated data (handlers, route IDs, metadata, etc.):

```ts
import { ArrayMatcher as Matcher } from 'remix/route-pattern'

// Any data type you want!  👇
let matcher = new Matcher<string>()

matcher.add('/', 'home')
matcher.add('blog/:slug', 'blog-post')
matcher.add('api(/v:version)/*path', 'api')

matcher.match('https://example.com/blog/v3')
// { pattern: 'blog/:slug', params: { slug: 'v3' }, data: 'blog-post' }

matcher.match('https://example.com/api/v2/users/profile')
// { pattern: 'api(/v:version)/*path', params: { version: '2', path: 'users/profile' }, data: 'api' }
```

**ArrayMatcher vs TrieMatcher**

- **ArrayMatcher**: Best for small apps (~80 routes or fewer)
- **TrieMatcher**: Best for large apps (hundreds of routes)

Note: Performance depends on your specific patterns—benchmark both to verify which is faster for your app.

Both implement the `Matcher` API so you can swap them out easily:

```ts
// import { ArrayMatcher as Matcher } from 'remix/route-pattern'
import { TrieMatcher as Matcher } from 'remix/route-pattern'
```

## Specificity

When multiple patterns match a URL, the most specific pattern wins.

**Pathname specificity** (left-to-right):

```ts
import { ArrayMatcher } from 'remix/route-pattern'

let matcher = new ArrayMatcher<string>()
matcher.add('blog/hello', 'static')
matcher.add('blog/:slug', 'variable')
matcher.add('blog/*path', 'wildcard')
matcher.add('*path', 'catch-all')

matcher.match('https://example.com/blog/hello')
// { pattern: 'blog/hello', params: {}, data: 'static' }
// 'blog/hello' wins: static segments beat variables/wildcards at each position
```

**Search parameter specificity**:

```ts
let router = new ArrayMatcher<string>()
router.add('search', 'no-params')
router.add('search?q', 'has-q')
router.add('search?q=', 'has-q-with-value')
router.add('search?q=hello', 'exact-match')

router.match('https://example.com/search?q=hello')
// { pattern: 'search?q=hello', params: {}, data: 'exact-match' }
// More constrained search params = more specific
```

## Benchmark

To run benchmarks comparing `route-pattern` performance with comparable libraries:

```sh
pnpm bench bench/comparison.bench.ts
```

## Related Work

- [`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)
- [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
