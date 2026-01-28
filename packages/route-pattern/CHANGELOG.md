# `route-pattern` CHANGELOG

This is the changelog for [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern). It follows [semantic versioning](https://semver.org/).

## v0.18.0

### Minor Changes

- BREAKING CHANGE: Remove `createHrefBuilder`, `type HrefBuilder`, `type HrefBuilderArg`

  `createHrefBuilder` was the original design and implementation of href generation,
  but with the new `RoutePattern.href` method it is now obsolete.

  Use `HrefArgs` instead of `HrefBuilderArgs`:

  ```ts
  // before
  type Args = HrefBuilderArgs<Source>

  // after
  type Args = HrefArgs<Source>
  ```

- BREAKING CHANGE: simplify protocol to only accept `http`, `https`, and `http(s)`

  Previously, we allowed arbitrary `PartPattern` for protocol, but in reality the request/response server only directly receives `http` and `https` protocols (`ws` and `wss` are upgraded from `http` and `https` respectively).

  That means params or arbitrary optionals are no longer allowed within the protocol and will result in a `ParseError`.

### Patch Changes

- Add `ast` property to `RoutePattern`

  The AST is a read-only, "bare-metal" API designed for advanced use cases. For example, optimized matchers like `TrieMatcher` can't just delegate matching to `RoutePattern.match()` for each of their patterns and need direct access to the pattern AST.

  ```ts
  let ast: AST = pattern.ast

  type AST = {
    protocol: PartPattern
    hostname: PartPattern
    port: string | null
    pathname: PartPattern
    search: SearchConstraints
  }
  ```

  ```ts
  type PartPattern = {
    tokens: Array<Token>
    paramNames: Array<string>
    /** Map of `(` token index to its corresponding `)` token index for optional segments */
    optionals: Map<number, number>
    separator: '.' | '/' | ''
  }

  type Token =
    | { type: 'text'; text: string }
    | { type: 'separator' }
    | { type: '(' | ')' }
    | { type: ':' | '*'; nameIndex: number } // nameIndex references paramNames array

  // `posts/:id(/edit)`
  let part: PartPattern = {
    tokens: [
      { type: 'text', text: 'posts' },
      { type: 'separator' },
      { type: ':', nameIndex: 0 },
      { type: '(' },
      { type: 'separator' },
      { type: 'text', text: 'edit' },
      { type: ')' },
    ],
    paramNames: ['id'],
    optionals: new Map([[3, 6]]), // token at index 3 '(' maps to token at index 6 ')'
    separator: '/',
  }
  ```

  ```ts
  type SearchConstraints = Map<string, Set<string> | null>

  // - `null`: key must be present (matches ?q, ?q=, ?q=1)
  // - Empty Set: key must be present with a value (matches ?q=1)
  // - Non-empty Set: key must be present with all these values (matches ?q=x&q=y)
  ```

- Add getters to `RoutePattern`

  The `protocol`, `hostname`, `port`, `pathname`, and `search` getters display the normalized pattern parts as strings.

  ```ts
  let pattern = new RoutePattern('https://:tenant.example.com:3000/:lang/docs/*?version=:version')

  pattern.protocol // 'https'
  pattern.hostname // ':tenant.example.com'
  pattern.port // '3000'
  pattern.pathname // ':lang/docs/*'
  pattern.search // 'version=:version'
  ```

  Omitted parts return empty strings.

- Add `meta` to match returned by `RoutePattern.match()`

  The `meta` property provides rich information about matched params (variables and wildcards) in the hostname and pathname, analogous to RegExp groups/indices. This enables advanced use cases that need more than just the param values including match ranking.

  ```ts
  import * as assert from 'node:assert/strict'

  let pattern = new RoutePattern('https://:tenant.example.com/:lang/docs/*')
  let match = pattern.match('https://acme.example.com/en/docs/api/routes')

  assert.deepEqual(match.params, { tenant: 'acme', lang: 'en' })
  assert.deepEqual(match.meta.hostname, [
    { type: ':', name: 'tenant', value: 'acme', begin: 0, end: 4 },
  ])
  assert.deepEqual(match.meta.pathname, [
    { type: ':', name: 'lang', value: 'en', begin: 0, end: 2 },
    { type: '*', name: '*', value: 'api/routes', begin: 8, end: 18 },
  ])
  ```

- Add functions for comparing match specificity

  Specificity is our intuitive metric for finding the "best" match.

  ```ts
  import * as Specificity from '@remix-run/route-pattern/specificity'

  Specificity.lessThan(a, b) // `true` when `a` is more specific than `b`. `false` otherwise
  Specificity.greaterThan(a, b)
  Specificity.equal(a, b)

  matches.sort(Specificity.ascending)
  matches.sort(Specificity.descending)
  ```

  Specificity compares patterns char-by-char where static matches beat variable matches, which beat wildcard matches.

  ```typescript
  import { RoutePattern } from '@remix-run/route-pattern'
  import * as Specificity from '@remix-run/route-pattern/specificity'
  import * as assert from 'node:assert/strict'

  let url = 'https://example.com/posts/new'

  let pattern1 = new RoutePattern('/posts/:id')
  let pattern2 = new RoutePattern('/posts/new')

  let match1 = pattern1.match(url)
  let match2 = pattern2.match(url)

  assert.ok(Specificity.lessThan(match1, match2))
  ```

  **Hostname segments are compared right-to-left** (e.g., `example.com` compares `com` first, then `example`), though characters within a segment are still compared left-to-right:

  ```typescript
  import * as assert from 'node:assert/strict'

  let url = 'https://app-api.example.com'

  let pattern1 = new RoutePattern('https://app-*.example.com')
  let match1 = pattern1.match(url)

  let pattern2 = new RoutePattern('https://*-api.example.com')
  let match2 = pattern2.match(url)

  assert.ok(Specificity.lessThan(match1, match2))
  ```

## v0.17.0

### Minor Changes

- BREAKING CHANGE: Remove exports for `TrieMatcher` and `TrieMatcherOptions`

  `TrieMatcher` prototype produces inconsistent matches based on ad hoc scoring.
  That means that swapping `ArrayMatcher` for `TrieMatcher` could alter which route was picked as the best match for a given URL.

  We'll restore the `TrieMatcher` export after it produces correct, consistent matches.

## v0.16.0 (2025-12-18)

- BREAKING CHANGE: Rename `RegExpMatcher` to `ArrayMatcher`

## v0.15.3 (2025-11-19)

- Exclude benchmark files from published npm package

## v0.15.2 (2025-11-19)

- Exclude test files from published npm package

## v0.15.1 (2025-11-19)

- `href()` now filters out `undefined` and `null` values from search parameters, preventing them from appearing in the generated URL's query string
- `href()` no longer adds a trailing `?` when search parameters are empty

## v0.15.0 (2025-11-05)

- Build using `tsc` instead of `esbuild`. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.

## v0.14.0 (2025-10-04)

- Add `Matcher` and `MatchResult` interfaces. These are new public APIs for matching sets of patterns.
- Add `RegExpMatcher` and `TrieMatcher` concrete implementations of the `Matcher` interface

  - `RegExpMatcher` is a simple array-based matcher that compiles route patterns to regular expressions.
  - `TrieMatcher` is a trie-based matcher optimized for large route sets and long-running server applications.

  ```tsx
  import { TrieMatcher } from '@remix-run/route-pattern'

  let matcher = new TrieMatcher<{ name: string }>()
  matcher.add('users/:id', { name: 'user' })
  matcher.add('posts/:id', { name: 'post' })

  let match = matcher.match('https://example.com/users/123')
  // { data: { name: 'user' }, params: { id: '123' }, url: ... }
  ```

## v0.13.0 (2025-09-29)

- BREAKING CHANGE: removed `createRoutes` and corresponding types (`RouteMap`, `RouteDefs`, and `RouteDef`). This functionality will be re-introduced in a future "router" package.
- BREAKING CHANGE: removed `RouteMap` from `createHrefBuilder` generic type.
- Expose `Join` type as public API
- Expose `HrefBuilderArgs` type as public API
- Optimization: compile patterns as needed instead of on instantiation

## v0.12.0 (2025-09-25)

- BREAKING CHANGE: removed `options` arg from `createHrefBuilder`
- BREAKING CHANGE: removed support for enum patterns
- Add `pattern.href(...args)` method for generating URLs from patterns

  ```tsx
  import { RoutePattern } from '@remix-run/route-pattern'

  let pattern = new RoutePattern('users/:id')
  pattern.href({ id: '123' }) // "/users/123"
  ```

- Add `createRoutes` function for working with more than one pattern at a time. This generates a `RouteMap` object that allows human-friendly naming of patterns.

  ```tsx
  import { createRoutes } from '@remix-run/route-pattern'

  let routes = createRoutes({
    home: '/',
    blog: {
      index: '/blog',
      post: '/blog/:slug',
    },
  })

  routes.home.match('https://remix.run/')
  // { params: {} }
  routes.blog.post.match('https://remix.run/blog/my-post')
  // { params: { slug: 'my-post' } }

  routes.blog.post.href({ slug: 'my-post' }) // "/blog/my-post"
  ```

  A `RouteMap` also works as a generic to `createHrefBuilder()` to restrict the set of patterns that may be used as the first argument.

  ```tsx
  import { createHrefBuilder } from '@remix-run/route-pattern'

  let href = createHrefBuilder<typeof routes>()
  href('/blog/:slug', { slug: 'my-post' }) // "/blog/my-post"
  ```

- Add `pattern.join(input, options)`, which allows a pattern to be built relative
  to another pattern

  ```tsx
  import { RoutePattern } from '@remix-run/route-pattern'

  let base = new RoutePattern('https://remix.run/api')
  let pattern = base.join('users/:id')
  pattern.source // "https://remix.run/api/users/:id"
  ```

- Export `RouteMatch` type as public API
- Allow `null` and `undefined` as values for optional params

## v0.11.0 (2025-09-11)

- `createHrefBuilder<T>` now accepts a `RoutePattern` directly instead of just `string`s
- `Variant<T>` preserves leading slashes in pathname-only patterns

## v0.10.0 (2025-09-04)

- BREAKING CHANGE: removed `match.protocol`, `match.hostname`, `match.port`, `match.pathname`, `match.search`, and `match.searchParams`. Use `match.url` instead
- Fix search matching and add more fine-grained examples

## v0.9.1 (2025-09-04)

- Fix handling of patterns with leading slash
- Make variables not greedy

```tsx
let pattern = new RoutePattern('/:id(.json)')
// Before :id was greedy and would consume ".json"
pattern.match('https://remix.run/123.json')
// { params: { id: '123.json' } }
// After
pattern.match('https://remix.run/123.json')
// { params: { id: '123' } }
```

- Allow search params values to have type `string | number | bigint | boolean` and automatically stringify

## v0.9.0 (2025-09-03)

- Add `protocol`, `hostname`, `port`, `pathname`, `search`, and `searchParams` properties to the `Match` interface. This is useful to avoid parsing the URL twice when passing a string directly to `pattern.match(urlString)`
- Fix `protocol` and `hostname` to always ignore case given in the pattern
- Add `ignoreCase` option to `RoutePattern` constructor to match URL pathnames in a case-insensitive way

```tsx
let pattern = new RoutePattern('https://remix.run/users/:id', { ignoreCase: true })
pattern.match('https://remix.run/Users/123') // { ..., params: { id: '123' } }
```

## v0.8.0 (2025-09-03)

- Any valid pattern is also valid in `href(pattern)`
- Href generation with missing optional variables omits the optional section entirely

```tsx
let href = createHrefBuilder()
href('products(/:id)', { id: 'remix' }) // /products/remix

// These all used to fail, but are now OK!
href('products(/:id)') // /products
href('products(/:id)', {}) // /products
href('products(/:id)', { id: null }) // /products (type error)
href('products(/:id)', { id: undefined }) // /products (type error)
```

- Param values may be `string | number | bigint | boolean` and are automatically stringified

```tsx
let href = createHrefBuilder()

// These used to be a type errors, but are now OK!
href('products(/:id)', { id: 1 }) // /products/1
href('products(/:id)', { id: false }) // /products/false
```

## v0.7.0 (2025-09-01)

- Add support for nested optionals in route patterns

```tsx
// Now you can do stuff like
let pattern = new RoutePattern('api(/v:major(.:minor))')
pattern.match('https://remix.run/api') // { params: {} }
pattern.match('https://remix.run/api/v1') // { params: { major: '1' } }
pattern.match('https://remix.run/api/v1.2') // { params: { major: '1', minor : '2' } }
```

- Make `pattern.match().params` type-safe
- Export top-level `Params<pattern>` helper for extracting params from a pattern
- Tighten up some types in `href()`. Now you get variants for
  - all the different values of an enum
  - unnamed wildcards
- Fix bug when using unnamed wildcards in `href()`

## v0.6.0 (2025-08-29)

- Use a single RegExp to match protocol, hostname, port, and pathname
- Allow duplicate variable names in patterns, right-most shows up in `match.params`
- Allow route patterns to match on port
- All variables require names, wildcards may have a name or be "unnamed"

## v0.4.0 (2025-07-24)

- Renamed package from `@mjackson/route-pattern` to `@remix-run/route-pattern`
