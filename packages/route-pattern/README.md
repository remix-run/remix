# route-pattern

Type-safe URL matching and href generation for JavaScript. `route-pattern` supports path variables, wildcards, optionals, search constraints, and full-URL patterns with predictable ranking.

## Features

- **Type-safe** - Infer params from patterns for compile-time correctness
- **Expressive** - Variables, wildcards, optionals, and search constraints
- **Full URL support** - Match protocol, hostname, port, pathname, and search
- **Simple & deterministic ranking** - Predictable left-to-right priority for static, variable, and wildcard patterns
- **Fast** - Indexed, bounded-state matching without variant expansion or regex backtracking
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

Examples in this README use `remix/route-pattern/*` imports. The same APIs are also available from the direct package entrypoints: `@remix-run/route-pattern`, `@remix-run/route-pattern/href`, `@remix-run/route-pattern/match`, `@remix-run/route-pattern/join`, and `@remix-run/route-pattern/specificity`.

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
'blog/:date/:slug' // matches /blog/2024-01-15/hello
'files/:name.:ext' // matches /files/readme.md
```

Pathname variables possessively capture the largest non-empty run up to `/` or `.`. Hyphens are data, so UUIDs and slugs remain intact. A variable may have static text before it, but every path through following optionals must reach `/`, `.`, a wildcard, or the end of the hostname or pathname. Capture an inseparable value such as a date with one variable instead of `:year-:month-:day`.

Raw `/` and `.` are structural delimiters. Their percent-encoded forms remain data and are decoded in the resulting param. Static pattern text may use either decoded text or percent encoding, so `/café` and `/caf%C3%A9` match the same pathname text.

**Wildcards** match multi-segment paths using `*name`:

```ts
'files/*path' // matches /files/images/logo.png
'node_modules/*package/dist/index.js' // matches /node_modules/@remix-run/router/dist/index.js
'files/*' // matches any path under /files, but doesn't capture the wildcard value
```

Patterns may contain any number of wildcards when static text or a delimiter separates them. Adjacent wildcards such as `*left*right` are rejected because their capture boundary is ambiguous.

**Optionals** make parts optional using `()`:

```ts
'api(/v:version)/users' // matches /api/users, /api/v2/users
'blog/:slug(.html)' // matches /blog/hello, /blog/hello.html
'docs(/guides/:category)' // matches /docs, /docs/guides/routing
'api(/v:major(.:minor))' // matches /api, /api/v2, /api/v2.1
```

Optionals compile as state branches rather than concrete variants, so independent and nested optionals do not cause exponential matcher construction. Empty optionals and adjacent optional branches that give the same URL different capture schemas are rejected.

While variables, wildcards, and optionals are most prevalent in pathnames, you can also use them in hostnames:

```ts
':tenant.example.com/dashboard' // matches acme.example.com/dashboard
'(www.)example.com/blog/:slug(.html)' // matches example.com/blog/hello, www.example.com/blog/hello.html
'*.example.com/files/*path' // matches cdn.example.com/files/images/logo.png
'(:locale.)example.com/docs(/:section)' // matches en.example.com/docs, en.example.com/docs/guides
```

Capture names may repeat. `params` uses the last participating capture in pattern order, while `paramsMeta` retains every participating capture:

```ts
let matcher = createMatcher('/:id/:id')
let match = matcher.match('https://example.com/first/second')

match?.params
// { id: 'second' }

match?.paramsMeta.pathname.map(({ name, value }) => ({ name, value }))
// [{ name: 'id', value: 'first' }, { name: 'id', value: 'second' }]
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

Matchers accept absolute URL strings or `URL` objects. To match a relative URL reference, pass an absolute `baseURL`; the input is resolved with the same semantics as `new URL(input, baseURL)`, and the resolved URL is returned on the match.

```ts
let match = blogMatcher.match('../blog/v3', {
  baseURL: 'https://example.com/admin/settings',
})

match?.params
// { slug: 'v3' }

match?.url.href
// 'https://example.com/blog/v3'
```

This works for root-relative, path-relative, query-relative, and network-path references. Without `baseURL`, string inputs must still be absolute.

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

Each match returns:

- `url`: the `URL` object that was matched
- `pattern`: the matched `RoutePattern`
- `data`: the data attached with `matcher.add(pattern, data)`
- `params`: captured param values
- `paramsMeta`: hostname and pathname param metadata

`paramsMeta.hostname` and `paramsMeta.pathname` are arrays of `{ type, name, value, begin, end }` entries. The offsets are measured after URL normalization. A pattern with no hostname matches any hostname, represented in `paramsMeta.hostname` as an unnamed wildcard entry.

Set `ignoreCase: true` to make pathname matching case-insensitive. Hostname matching is always case-insensitive, and search constraints are always case-sensitive.

```ts
let matcher = createMatcher('/Docs/:slug', { ignoreCase: true })

matcher.match('https://example.com/docs/Intro')?.params
// { slug: 'Intro' }
```

Matchers limit individual pattern size, total matcher size, and the work performed by one match. Pattern and matcher sizes are measured in UTF-8 bytes. Direct package consumers may lower or raise individual limits. Exceeding one throws `MatcherResourceError` with structured `details` instead of silently abandoning matching:

```ts
let matcher = createMultiMatcher({
  limits: { maxPatternSize: 4096, maxMatchWork: 100_000 },
})
```

### Ranking matches by specificity

When multiple patterns match the same URL, `route-pattern` chooses the most specific match deterministically. Matches are ranked left-to-right, character-by-character:

- Explicit protocol and port constraints are more specific than omitted constraints.
- Static hostnames are more specific than dynamic hostnames, which are more specific than omitted hostnames.
- Static characters are more specific than variables.
- Variables are more specific than wildcards.
- Earliest difference decides the winner.

This is the same ranking used by `createMultiMatcher`.

For advanced use cases, `/specificity` provides comparison utilities: `lessThan`, `greaterThan`, `equal`, `descending`, `ascending`, `compare`. `lessThan(a, b)` returns `true` when match `a` is less specific than match `b`. For example:

```ts
import { createMultiMatcher } from 'remix/route-pattern/match'
import { descending } from 'remix/route-pattern/specificity'

let matcher = createMultiMatcher()
matcher.add('files/*path', null)
matcher.add('files/:name', null)
matcher.add('files/readme', null)

let matches = matcher.matchAll('https://example.com/files/readme')

matches.sort(descending).map((match) => match.pattern.toString())
// ['/files/readme', '/files/:name', '/files/*path']
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

createHref(
  'blog/:slug?ref=docs',
  { slug: 'v3' },
  {
    searchParams: { utm_source: 'newsletter' },
  },
)
// '/blog/v3?utm_source=newsletter&ref=docs'

createHref('users/:id', { id: 'a.b' })
// '/users/a%2Eb' (the encoded dot remains variable data when matched)
```

Pass `baseURL` to generate a path-relative reference to a same-origin route. Patterns with a different origin remain absolute.

```ts
let baseURL = new URL('https://example.com/admin/settings')

createHref('users/:id', { id: '123' }, { baseURL })
// '../users/123'

createHref('https://cdn.example.com/assets/*path', { path: 'logo.svg' }, { baseURL })
// 'https://cdn.example.com/assets/logo.svg'
```

The `searchParams` option accepts a plain object or `URLSearchParams`. Use `URLSearchParams` when duplicate keys or their order matter:

```ts
let searchParams = new URLSearchParams([
  ['tag', 'featured'],
  ['tag', 'popular'],
])

createHref('search', undefined, { searchParams })
// '/search?tag=featured&tag=popular'
```

`createHref()` throws `CreateHrefError` when it cannot safely generate an href. The error exposes stable structured details on `error.details`; the string message is for humans.

Common failures include missing required params, nameless wildcards, invalid hostname params, empty pathname variables, and origin patterns that specify a protocol or port without a concrete hostname.

**Note:** optional groups without params are included in the generated href:

```ts
createHref('todos(/new)')
// '/todos/new'

createHref('products(.json)')
// '/products.json'
```

## Parse & stringify patterns

You can explicitly parse and stringify patterns. Create a `RoutePattern` with `RoutePattern.parse` and use the methods and helpers below instead of reading parsed token internals.

```ts
import { getRoutePatternCaptures, RoutePattern } from 'remix/route-pattern'

let pattern = RoutePattern.parse('://:tenant.example.com/blog/:slug(/*path)')
//  ^? RoutePattern

pattern.toString()
// '://:tenant.example.com/blog/:slug(/*path)'

pattern.toJSON()
// { hostname: ':tenant.example.com', pathname: 'blog/:slug(/*path)', ... }

getRoutePatternCaptures(pattern)
// [
//   { part: 'hostname', type: ':', name: 'tenant', optional: false },
//   { part: 'pathname', type: ':', name: 'slug', optional: false },
//   { part: 'pathname', type: '*', name: 'path', optional: true },
// ]
```

All APIs that take a `pattern` arg accept `string` or a parsed `RoutePattern`.

**TIP:** For high-performance scenarios, you can parse patterns ahead of time to avoid reparsing them on every call.

`RoutePattern.toJSON()` returns a `RoutePatternJSON` object with serialized `protocol`, `hostname`, `port`, `pathname`, and `search` fields. `RoutePattern.parse()` throws `ParseError` for malformed sources; the error exposes stable `type`, `source`, and `index` fields.

The public support types are:

- `RoutePatternCapture` from `remix/route-pattern`
- `RoutePatternJSON` from `remix/route-pattern`
- `CreateHrefErrorDetails` from `remix/route-pattern/href`
- `CreateHrefOptions` and `CreateHrefSearchParams` from `remix/route-pattern/href`
- `MatchParamMeta` from `remix/route-pattern/match`
- `MatchOptions` from `remix/route-pattern/match`
- `MatcherLimits` from `remix/route-pattern/match`
- `MatcherResourceError` and `MatcherResourceErrorDetails` from `remix/route-pattern/match`

Literal patterns are validated and infer named params until the type-level parser reaches its 64-step complexity budget. Larger runtime-valid patterns remain accepted and fall back to safe general pattern types instead of risking a TypeScript excessive-instantiation error.

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
