# route-pattern

Type-safe URL matching and href generation for JavaScript. `route-pattern` supports path variables, wildcards, optionals, search constraints, and full-URL patterns with predictable ranking.

## Features

- **Type-safe** - Infer params from patterns for compile-time correctness
- **Expressive** - Variables, wildcards, optionals, and search constraints
- **Full URL support** - Match protocol, hostname, port, pathname, and search
- **Simple & deterministic ranking** - Predictable left-to-right priority for static, variable, and wildcard patterns
- **Fast** - Trie-based matching for scalable performance
- **Modular** - Import only the features you need to for smaller bundles
- **Runtime agnostic** - Works across Node.js, Bun, Deno, Cloudflare Workers, and browsers

## Installation

```sh
npm i remix
```

## Quick example

```ts
import { createMultiMatcher } from 'remix/route-pattern/match'

let matcher = createMultiMatcher<{ name: string }>()

matcher.add('blog/:slug', { name: 'blog-post' })
matcher.add('api(/v:version)/*path', { name: 'api' })
matcher.add('http(s)://:region.cdn.com/assets/*file.:ext', { name: 'assets' })

let match = matcher.match('https://example.com/blog/v3')
match?.pattern.toString()
// /blog/:slug
match?.params
// { slug: 'v3' }
match?.data
// { name: 'blog-post' }

import { createHref } from 'remix/route-pattern/href'

createHref('blog/:slug', { slug: 'v3' })
// '/blog/v3'

createHref('api(/v:version)/*path', { version: '2', path: 'users/profile' })
// '/api/v2/users/profile'

createHref('http(s)://:region.cdn.com/assets/*file.:ext', {
  region: 'us-west',
  file: 'images/logo',
  ext: 'png',
})
// 'https://us-west.cdn.com/assets/images/logo.png'
```

## API at a glance

| Import                            | Description                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `remix/route-pattern`             | Parse and stringify patterns.                                                                                                          |
| `remix/route-pattern/href`        | Generate hrefs for patterns with type safe params.                                                                                     |
| `remix/route-pattern/match`       | Match against one pattern with type inference for params, or match against many patterns with deterministic ranking and attached data. |
| `remix/route-pattern/join`        | Combine two patterns into one. Override protocol, hostname, port. Join pathnames. Merge search constraints.                            |
| `remix/route-pattern/specificity` | Rank matches by [specificity](#ranking-matches-by-specificity).                                                                        |

For in-depth reference, visit the [`route-pattern` API docs](https://api.remix.run/api/remix/route-pattern)

## Pattern syntax

### Protocol

Protocol must be `http`, `https`, or `http(s)`:

```ts
'https://example.com' // matches https://example.com
'http(s)://example.com' // matches http://example.com, https://example.com
```

### Hostname & pathname

**Variables** capture dynamic segments using `:name`:

```ts
'users/:id' // matches /users/123
'blog/:year-:month-:day/:slug' // matches /blog/2024-01-15/hello
```

**Wildcards** match multi-segment paths using `*name`:

```ts
'files/*path' // matches /files/images/logo.png
'node_modules/*package/dist/index.js' // matches /node_modules/@remix-run/router/dist/index.js
'files/*' // matches any path under /files, but doesn't capture the wildcard value
```

**Optionals** make parts optional using `()`:

```ts
'api(/v:version)/users' // matches /api/users, /api/v2/users
'blog/:slug(.html)' // matches /blog/hello, /blog/hello.html
'docs(/guides/:category)' // matches /docs, /docs/guides/routing
'api(/v:major(.:minor))' // matches /api, /api/v2, /api/v2.1
```

While variables, wilcards, and optionals are most prevalent in pathnames, you can also use them in hostnames:

```ts
':tenant.example.com/dashboard' // matches acme.example.com/dashboard
'(www.)example.com/blog/:slug(.html)' // matches example.com/blog/hello, www.example.com/blog/hello.html
'*.example.com/files/*path' // matches cdn.example.com/files/images/logo.png
'(:locale.)example.com/docs(/:section)' // matches en.example.com/docs, en.example.com/docs/guides
```

**Escape characters** with `\`:

```ts
'time/12\\:30' // matches /time/12:30
'calculator/2\\*3' // matches /calculator/2*3
'wiki/Mercury_\\(planet\\)' // matches /wiki/Mercury_(planet)
'wiki/AC\\/DC' // matches /wiki/AC%2FDC
```

### Search

**Search constraints** narrow matches using `?key` or `?key=value`:

```ts
'search?q' // key must be present
'search?q=routing' // requires ?q=routing exactly
```

## Match URLs

### Match against a single pattern

Use `createMatcher` when you have one pattern and want params inferred from that exact pattern.

```ts
import { createMatcher } from 'remix/route-pattern/match'

const url: string | URL = /* ... */

let blogMatcher = createMatcher('blog/:slug')
blogMatcher.match(url)?.params
// Type safe params     ^? { slug: string } | undefined

let docsMatcher = createMatcher('://(:tenant.)host.com/docs/*path.:ext')
docsMatcher.match(url)?.params
// Type safe params     ^? { tenant: string | undefined, path: string, ext: string } | undefined
```

### Match against multiple patterns

Use `createMultiMatcher` when you need to match many patterns and attach your own data to each match.

```ts
import { createMultiMatcher } from 'remix/route-pattern/match'

let matcher = createMultiMatcher<string>()
// Any data type you want!         👆

matcher.add('/', 'home')
matcher.add('blog/:slug', 'blog-post')
matcher.add('api(/v:version)/*path', 'api')

matcher.match('https://example.com/blog/v3')
// { params: { slug: 'v3' }, data: 'blog-post' }

matcher.match('https://example.com/api/v2/users/profile')
// { params: { version: '2', path: 'users/profile' }, data: 'api' }
```

The matched pattern is only known at runtime, so matched `params` are not inferred when matching with `createMultiMatcher`.

### Ranking matches by specificity

When multiple patterns match the same URL, `route-pattern` chooses the most specific match deterministically. Matches are ranked left-to-right, character-by-character:

- Static characters are more specific than variables.
- Variables are more specific than wildcards.
- Earliest difference decides the winner.

This is the same ranking used by `createMultiMatcher`.

For advanced use cases, `/specificity` provides comparison utilities: `lessThan`, `greaterThan`, `equal`, `descending`, `ascending`, `compare`. For example:

```ts
import { createMultiMatcher } from 'remix/route-pattern/match'
import { descending } from 'remix/route-pattern/specificity'

let matcher = createMultiMatcher()
matcher.add('files/*path', null)
matcher.add('files/:name', null)
matcher.add('files/readme.md', null)

let matches = matcher.matchAll('https://example.com/files/readme.md')

matches.sort(descending).map((match) => match.pattern.toString())
// ['/files/readme.md', '/files/:name', '/files/*path']
```

## Generate hrefs

`createHref` turns a pattern and params into a URL string. Required variables and wildcards must be provided, while params inside optional groups may be omitted.

```ts
import { createHref } from 'remix/route-pattern/href'

createHref('blog/:slug', { slug: 'v3' })
// '/blog/v3'

createHref('api(/v:version)/*path', { path: 'users/profile' })
// '/api/users/profile'

createHref('api(/v:version)/*path', { version: '2', path: 'users/profile' })
// '/api/v2/users/profile'

createHref('http(s)://:region.cdn.com/assets/*file.:ext', {
  region: 'us-west',
  file: 'images/logo',
  ext: 'png',
})
// 'https://us-west.cdn.com/assets/images/logo.png'

createHref('blog/:slug?ref=docs', { slug: 'v3' }, { utm_source: 'newsletter' })
// '/blog/v3?utm_source=newsletter&ref=docs'
```

**Note:** optional groups without params are included in the generated href:

```ts
createHref('todos(/new)')
// '/todos/new'

createHref('products(.json)')
// '/products.json'
```

## Parse & stringify patterns

You can explicitly parse and stringify patterns. `RoutePattern` is an opaque handle: use the methods and helpers below instead of reading parsed token internals.

```ts
import { getRoutePatternParams, RoutePattern } from 'remix/route-pattern'

let pattern = RoutePattern.parse('://:tenant.example.com/blog/:slug(/*path)')
//  ^? RoutePattern

pattern.toString()
// '://:tenant.example.com/blog/:slug(/*path)'

pattern.toJSON()
// { hostname: ':tenant.example.com', pathname: 'blog/:slug(/*path)', ... }

getRoutePatternParams(pattern)
// [
//   { part: 'hostname', type: ':', name: 'tenant', optional: false },
//   { part: 'pathname', type: ':', name: 'slug', optional: false },
//   { part: 'pathname', type: '*', name: 'path', optional: true },
// ]
```

All APIs that take a `pattern` arg accept `string` or a parsed `RoutePattern`.

**TIP:** For high-performance scenarios, you can parse patterns ahead of time to avoid reparsing them on every call.

## Combine patterns

`joinPatterns` builds a new pattern from a base pattern.

```ts
import { joinPatterns } from 'remix/route-pattern/join'

let user = joinPatterns('users', ':id')

user.toString()
// '/users/:id'

let apiUser = joinPatterns('api(/v:version)', '://remix.run/users/:id')

apiUser.toString()
// '://remix.run/api(/v:version)/users/:id'
```

- **Protocol:** if second pattern has a protocol, overrides base pattern
- **Hostname:** if second pattern has a hostname, overrides base pattern
- **Port:** if second pattern has a port, overrides base pattern
- **Pathname:** concatenates pathnames, adding a `/` in between as necessary
- **Search constraints:** merges search constraints by key

## Benchmarks

Benchmarks live in [`bench/`](./bench/).

## Related Work

- [`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)
- [`find-my-way`](https://github.com/delvedor/find-my-way)
- [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
