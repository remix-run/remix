BREAKING CHANGE: Make search param pattern decoding and serialization consistent with `URLSearchParams`. Affects: `RoutePattern.{match,href,search,ast.search}`

Previously, `RoutePattern` treated `?q` and `?q=` as **different** constraints:

```ts
// Before: `?q` and `?q=` are different

let url = new URL('https://example.com?q')

// Matches "key only" constraint?
new RoutePattern('?q').match(url) // ✅ match

// Matches "key and value" constraint?
new RoutePattern('?q=').match(url) // ❌ no match (`null`)

// Different constraints serialized to different strings
new RoutePattern('?q').search // -> 'q'
new RoutePattern('?q=').search // -> 'q='
```

There were two main problems with that approach:

**Unintuitive matching**

```ts
// URL search looks like `?q=`
let url = new URL('https://example.com?q=')

// Pattern search looks like `?q=`
let pattern = new RoutePattern('?q=')

// But "key and value" constraint doesn't match!
pattern.match(url) // ❌ no match (`null`)
```


**Parsing and serialization**

For consistency with `URLSearchParams`, search param patterns should be parsed according to the [WHATWG `application/x-www-form-urlencoded` parsing spec](https://url.spec.whatwg.org/#application/x-www-form-urlencoded-parsing) and should also [encode spaces as `+`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#percent_encoding).

Now, we use `URLSearchParams` to parse search param patterns to guarantee decodings are consistent:

```ts
let url = new URL('https://example.com?q=a+b')
// Decodes `+` to ` `
url.searchParams.getAll('q') // -> ['a b']

// Before
let pattern = new RoutePattern('?q=a+b')
// Does not decode `+` to ` `
pattern.ast.search.get('q') // -> ❌ Set { 'a+b' }

// After
let pattern = new RoutePattern('?q=a+b')
// Decodes `+` to ` `
pattern.ast.search.get('q') // -> ✅ Set { 'a b' }
```

Similarly, now that `?q` and `?q=` are semantically equivalent, they should serialize to the same thing:

```ts
new URLSearchParams('q=').toString() // 'q='

// Before
new RoutePattern('?q=').search // ❌ 'q'

// After
new RoutePattern('?q=').search // ✅ 'q='
```

As a result, `RoutePattern`s can no longer represent a "key and any value" constraint.
In practice, this was a niche use-case so we chose correctness and consistency with `URLSearchParams`.
If the need for "key and any value" constraints arises, we can later introduce a separate syntax for that without the unintuitive shortcoming of `?q=`.

With "key and any value" constraints removed, the `missing-search-param` error type thrown by `RoutePattern.href` was made obsolete and was removed.