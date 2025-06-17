# Route Patterns

Route patterns are strings that describe the structure of URLs you want to match.

This spec discusses what the user sees when they interact with route patterns.
It does not discuss the algorithms nor data structures used by the matching engine, which will be discussed elsewhere.

## Goals

- Pattern ranking based on well-defined metrics
- Detect conflicting/duplicate routes ("unreachable routes")
- Benchmark in the same ballpark as existing solutions

## Out of Scope

This version will not support:

- Matching URL fragments (`#section`)
- Matching the URL port (`:8080`)
- Matching the URL credentials (`user:pass@`)
- Caching (can be added in userland)
- Request/Response handling (build on top of this)
- Performance optimization for cold starts

## Quick example

This example is here to jump-start your intuition.
Don't worry if something is unclear; we'll cover things in excruciating detail in later sections.

```ts
const matcher = createUrlMatcher([
  'products/:id',
  'products/sku-:sku(/compare/sku-:sku2)',
  'blog/:year-:month-:day/:slug(.html)',
  '://:tenant.remix.run/admin/users/:userId',
]);

const url = 'https://remix.run/products/wireless-headphones';
const result = matcher.bestMatch(url);

console.log(result.pattern); // 'products/:id'
console.log(result.params); // { id: 'wireless-headphones' }
```

If you want fine-grained control, you can also generate the matches in ranked order:

```ts
const url = 'https://remix.run/products/sku-electronics-12345';
for (const match of matcher.rankedMatches(url)) {
  console.log(`${match.pattern} -> ${JSON.stringify(match.params)}`);
}
// Output:
// products/sku-:sku(/compare/sku-:sku2) -> { sku: 'electronics-12345' }
// products/:id -> { id: 'sku-electronics-12345' }
```

## The patterns language

Patterns may specify any combination of URL properties:

- protocol
- hostname
- pathname
- search

```ts
'/products'; // Match on the URL pathname
'/search?q'; // Match the pathname + search
'https://remix.run/store'; // Match the protocol + hostname + pathname
'://remix.run/store'; // Match hostname + pathaname
'file:///usr/bin'; // Match protocol + pathname
```

### Wildcards

Dynamic segments of the URL can be matched with a wildcard `*` in the pathname and/or hostname.

```ts
'/products/*'; // Matches /products/a, /products/b, etc.
'/products/*/edit'; // Matches
'https://*.remix.run/store'; // Match
```

### Params

A param captures dynamic values and is written as `:` followed by a [JavaScript identifier](#javascript-identifier) that acts as its name:

```ts
'products/:id';

// ❌ Bad - missing or invalid param name
'products/:123';
```

Params capture values in a URL using `/(.*)/` in place of `:<name>`:

```ts
'products/:id';
// /products/winter-jacket → { id: 'winter-jacket' }

'://:tenant.example.com';
// store.example.com → { tenant: 'store' }
```

Param names must be unique:

```ts
// ❌ Bad - duplicate param name
'users/:id/posts/:id';

// ✅ Good - unique param names
'users/:user/posts/:post';

// ❌ Bad - duplicate param name across hostname and pathname
'://:region.api.example.com/users/:region';
```

Params can be mixed with static text and even other params in the same segment:

```ts
'users/@:id';
// /users/@sarah → { id: 'sarah' }

'downloads/:filename.pdf';
// /downloads/report.pdf → { filename: 'report' }

'blog/:year-:month-:day/:slug';
// /blog/2024-03-15/hello-world → { year: '2024', month: '03', day: '15', slug: 'hello-world' }

'api/v:major.:minor-:channel';
// /api/v2.1-beta → { major: '2', minor: '1', channel: 'beta' }

'://:region.:env.api.example.com';
// us-east.staging.api.example.com → { region: 'us-east', env: 'staging' }
```

### Globs

Globs capture "everything in this segment" using `*`:

```ts
'docs/*';
// /docs/getting-started → { path: 'getting-started/quickstart' }

'://*subdomain.example.com';
// store.admin.example.com → { subdomain: 'store.admin' }
```

Globs and params share a namespace:

```ts
// ❌ Bad - duplicate name 'region'
'://:region.api.example.com/users/:region';

// ❌ Bad - duplicate name 'tenant'
'://:tenant.example.com/files/*tenant';

// ❌ Bad - duplicate name 'data'
'://*data.example.com/files/*data';

// ✅ Good - unique names
'://:region.api.example.com/users/:userId';
'://:tenant.example.com/files/*documents';
'://*subdomain.example.com/files/*filepath';
```

The [Pathname](#pathname) and [Hostname](#hostname) sections go over other context-specific rules for globs.

### Optionals

You can mark any part of a pattern as optional by enclosing it in parentheses `()`.

```ts
'products/:id(/edit)';
// /products/winter-jacket → { id: 'winter-jacket' }
// /products/winter-jacket/edit → { id: 'winter-jacket' }

'http(s)://api.example.com';
// http://api.example.com → {}
// https://api.example.com → {}
```

Optionals can span any characters and contain static text, params, or globs:

```ts
'download/:filename(.pdf)';
// /download/report → { filename: 'report' }
// /download/report.pdf → { filename: 'report' }

'api(/v:version)/users';
// /api/users → {}
// /api/v2/users → { version: '2' }

'users/:id(/settings/:section)(/edit)';
// /users/sarah → { id: 'sarah' }
// /users/sarah/settings/profile → { id: 'sarah', section: 'profile' }
// /users/sarah/settings/profile/edit → { id: 'sarah', section: 'profile' }

'users/:userId(/files/*path)';
// /users/sarah → { userId: 'sarah' }
// /users/sarah/files/projects/docs/readme.md → { userId: 'sarah', path: 'projects/docs/readme.md' }

'://(www.)shop.example.com';
// shop.example.com → {}
// www.shop.example.com → {}
```

Optionals cannot be nested:

```ts
// ❌ Bad - nested optionals not allowed
'users/:id(/settings(/advanced))';

// ✅ Good - use multiple separate patterns
'users/:id';
'users/:id/settings(/advanced)';
```

Optionals cannot span across multiple parts of a route pattern:

```ts
// ❌ Bad - optional starts in protocol, ends in hostname
'http(s://api).example.com';

// ❌ Bad - optional starts in hostname, ends in pathname
'://(api.example.com/users)/settings';

// ❌ Bad - optional spans protocol and pathname
'http(s://example.com/api)';

// ✅ Good - separate optionals for each part
'http(s)://api.example.com(/settings)';

// ✅ Good - optional contained within hostname
'://(www.)example.com';

// ✅ Good - optional contained within pathname
'://example.com(/api/v2)';
```

For the matching, patterns with optionals are expanded into _variants_ which represent all the possible combinations you can get by including different optionals.

You can think of optionals as a shorthand for writing out all the variants by hand.
As you can see, each optional **doubles** the number of variants:

```ts
'files/:filename(/index)(.html)';
// Creates 4 variants:
// 1. `files/:filename`
// 2. `files/:filename/index`
// 3. `files/:filename.html`
// 4. `files/:filename/index.html`

'api(/v:version)(/regions/:region)(/features/:feature)';
// Creates 8 variants:
// 1. `api`
// 2. `api/v:version`
// 3. `api/regions/:region`
// 4. `api/features/:feature`
// 5. `api/v:version/regions/:region`
// 6. `api/v:version/features/:feature`
// 7. `api/regions/:region/features/:feature`
// 8. `api/v:version/regions/:region/features/:feature`
```

When using optionals, param and glob names must be unambiguous across all variants:

```ts
// ✅ Good - param name is `id` across all variants
'users/:id(/settings)';

// ❌ Bad - ambiguous param names across variants
'files/:name(Extension)';
// variants:
// 1. `files/:name`          - param name is 'name'
// 2. `files/:nameExtension` - param name becomes 'nameExtension'!

// ❌ Bad - seems like param name is `category` and `Items` is static text
'products/(:category)Items';
// variants:
// 1. `products/Items` - no param name; `Items` is static text
// 2. `products/:categoryItems` - param name is actually 'categoryItems' and `Items` is part of param name!

// ✅ Good - use separators to avoid ambiguity
'products/(:category-)items';
// variants:
// 1. `products/items` - no params
// 2. `products/:category-items` - param name is clearly 'category'
```

### Escaping special characters

Use backslash `\` to escape special characters in the patterns language: `:`, `*`, `(` and `)`.

**Note:** In JavaScript strings, you'll need to use `\\` since backslash itself needs escaping:

```ts
// Escape : to prevent it being treated as a param
'api\\:v1/users';
// ✅ Matches: /api:v1/users (literal colon)
// ❌ Does NOT match: /apiv1/users (no param named empty string)

// Escape * to prevent it being treated as a glob
'files\\*backup';
// ✅ Matches: /files*backup (literal asterisk)
// ❌ Does NOT match: /files/anything (no glob behavior)

// Escape parentheses to prevent optional behavior
'calc\\(2+2\\)';
// ✅ Matches: /calc(2+2) (literal parentheses)
// ❌ Does NOT match: /calc (no optional behavior)

// Multiple escapes in one pattern
'search\\:query\\(\\*\\)';
// ✅ Matches: /search:query(*) (all literal characters)
```

## Parts of a route pattern

### Pathname

Pathnames support [params](#params), [globs](#globs), and [optionals](#optionals):

```ts
// Params in pathname
'users/:id/profile';
// /users/123/profile → { id: '123' }

'blog/:year/:month/:day/:slug';
// /blog/2024/03/15/hello-world → { year: '2024', month: '03', day: '15', slug: 'hello-world' }

// Optionals in pathname
'products/:id(/reviews)(/edit)';
// /products/123 → { id: '123' }
// /products/123/reviews → { id: '123' }
// /products/123/reviews/edit → { id: '123' }

'docs/*path';
// /docs/getting-started/quickstart → { path: 'getting-started/quickstart' }
```

Pathnames can only include a glob as the entire rightmost segment:

```ts
// ❌ Bad - glob mixed with other text
'docs/guide-*rest';

// ❌ Bad - glob not in rightmost segment
'docs/*path/index';

// ✅ Good - rightmost segment of pathname
'users/:id/files/*filepath';
// /users/sarah/files/projects/readme.md → { id: 'sarah', filepath: 'projects/readme.md' }
```

Pathnames are case-sensitive:

```ts
'Users/:id';
// ✅ Matches: /Users/123 → { id: '123' }
// ❌ Does NOT match: /users/123

'products/Premium/:id';
// ✅ Matches: /products/Premium/456 → { id: '456' }
// ❌ Does NOT match: /products/premium/456
```

A route pattern that omits a pathname only matches `""` and `"/"` pathnames in a URL:

```ts
'://api.example.com';
// ✅ Matches: https://api.example.com
// ✅ Matches: https://api.example.com/
// ❌ Does NOT match: https://api.example.com/users
// ❌ Does NOT match: https://api.example.com/api/v1

'http(s)://api.example.com';
// ✅ Matches: https://api.example.com/
// ❌ Does NOT match: https://api.example.com/status
```

### Hostname

Hostnames must start with `://` to distinguish them from pathnames:

```ts
// ❌ Bad - interpreted as a pathname
'remix.run';

// ✅ Good
'://remix.run';
```

Hostnames support [params](#params), [globs](#globs), and [optionals](#optionals):

```ts
'://:region.api.example.com';
// us-east.api.example.com → { region: 'us-east' }

'://*tenant.example.com';
// store.example.com → { tenant: 'store' }

'://(www.)shop.example.com';
// shop.example.com → {}
// www.shop.example.com → {}

'://:env.(staging.)api.example.com';
// us.staging.api.example.com → { env: 'us' }
// us.api.example.com → { env: 'us' }
```

Hostnames can only include a glob as the entire leftmost segment:

```ts
// ❌ Bad - glob not leftmost
'://api.*tenant.com';

// ❌ Bad - glob mixed with other text
'://shop*tenant.example.com';

// ✅ Good - leftmost hostname segment
'://*tenant.shop.com/products';
// store.shop.com/products → { tenant: 'store' }
```

Hostnames are case-insensitive:

```ts
'://API.EXAMPLE.COM';
// ✅ Matches: https://api.example.com
// ✅ Matches: https://API.EXAMPLE.COM
// ✅ Matches: https://Api.Example.Com
```

A route pattern that omits a hostname matches any hostname:

```ts
'/products/:id';
// ✅ Matches: https://example.com/products/123
// ✅ Matches: https://shopify.com/products/456
// ✅ Matches: http://localhost:3000/products/789
```

### Protocol

Protocols support [optionals](#optionals).
They **do not** support [params](#params) nor [globs](#globs).

```ts
// ✅ Good - static protocols
'file';
'ftp';
'http';

// ✅ Good - optionals in protocol
'http(s)';
'ws(s)';
```

Static protocols must match `/^[a-zA-Z][\w+-.]*$/`; protocols with optionals, their variants must match that same regular expression:

```ts
// ❌ Bad - only letters, numbers, and `+`, `-`, `.` allowed
'http@api'; // @ not allowed
'http/2.0'; // / not allowed
'http$secure'; // $ not allowed
'1http'; // must start with letter

// ❌ Bad - params not supported so `:` is treated as a symbol
'http:secure';

// ❌ Bad - globs not supported so `*` is treated as a symbol
'http*';
```

Protocols are case-insensitive:

```ts
'HTTP://example.com';
// ✅ Matches: http://example.com
// ✅ Matches: HTTP://example.com

'WS(S)://api.example.com';
// ✅ Matches: ws://api.example.com
// ✅ Matches: WSS://api.example.com
// ✅ Matches: wss://api.example.com
```

A route pattern that omits the protocol matches any protocol:

```ts
'://example.com/api';
// ✅ Matches: http://example.com/api
// ✅ Matches: https://example.com/api
// ✅ Matches: ftp://example.com/api
// ✅ Matches: sftp://example.com/api
// ✅ Matches: ws://example.com/api
```

### Combining patterns

You can combine protocol, hostname, and pathname patterns in a single route pattern:

```ts
'/api/users/:id';
// https://example.com/api/users/123 → { id: '123' }
// http://localhost/api/users/123 → { id: '123' }

'/api(/v:version)/users/:id-:username/*files(.backup)';
// https://api.com/api/users/123-sarah/projects/readme.md → { id: '123', username: 'sarah', files: 'projects/readme.md' }
// ftp://server.com/api/v2/users/123-sarah/projects/readme.md.backup → { version: '2', id: '123', username: 'sarah', files: 'projects/readme.md' }

'://*tenant.shop.com';
// https://acme.shop.com → { tenant: 'acme' }
// https://acme.shop.com/ → { tenant: 'acme' }
// ftp://acme.shop.com → { tenant: 'acme' }

'http(s)://api.example.com';
// https://api.example.com → {}
// http://api.example.com/ → {}

'://:region.api.example.com/users/:id-:type/*data';
// https://us-west.api.example.com/users/123-admin/profile/settings.json → { region: 'us-west', id: '123', type: 'admin', data: 'profile/settings.json' }
// ws://us-west.api.example.com/users/123-admin/profile/settings.json → { region: 'us-west', id: '123', type: 'admin', data: 'profile/settings.json' }

'http(s)://*tenant.shop.com/api(/v:version)/products/:sku-:id(/reviews)/*path(.json)';
// http://acme.shop.com/api/products/shoes-12345/attachments/image.jpg → { tenant: 'acme', sku: 'shoes', id: '12345', path: 'attachments/image.jpg' }
// https://acme.shop.com/api/v2/products/shoes-12345/reviews/detailed/analysis.json → { tenant: 'acme', version: '2', sku: 'shoes', id: '12345', path: 'detailed/analysis' }
```

## Matching URLs

To match a URL against one or more patterns, create a `matcher`:

```ts
const matcher = createUrlMatcher([
  // Basic product routes
  'products/:id',
  'products/:id/reviews',

  // Multi-tenant shop routes
  '://*tenant.shop.com/products',
  '://*tenant.shop.com/products/:id',

  // Optional www subdomain
  '://(www.)shop.com/products',
]);

const { pattern, params } = matcher.bestMatch('https://example.com/products/123');
// pattern = 'products/:id'
// params = { id: '123' }

const { pattern, params } = matcher.bestMatch(
  'https://example.com/products/123/files/docs/readme.md',
);
// pattern = 'products/:id/files/*filepath'
// params = { id: '123', filepath: 'docs/readme.md' }

const { pattern, params } = matcher.bestMatch('https://www.shop.example.com/products/123/reviews');
// pattern = '://shop.example.com/products/:id/(reviews)'
// params = { id: '123' }
```

The matcher can also return all possible matches ranked by specificity:

```ts
const matches = matcher.rankedMatches('https://store.shop.example.com/products/123');
// Returns array of matches ordered by specificity:
// [
//   { pattern: '://*tenant.shop.example.com/products', params: { tenant: 'store' } },
//   { pattern: 'products/:id', params: { id: '123' } }
// ]
```

### Best = shortest static prefix

URL matchers [longest prefix match](https://en.wikipedia.org/wiki/Longest_prefix_match) to rank matches.

Specifically, each pattern expanded into its variants and each variant converted to a normalized from where params are replaced by `:` and globs are replaced by `*`.

Static matches are prioritized over params, and params are prioritized over globs.

```ts
const matcher = createUrlMatcher([
  // Static path
  'orgs/teams/projects/settings',

  // First segment param
  'orgs/:org/projects/settings',

  // First and last segment params
  'orgs/:org/projects/:project',

  // Glob after first segment
  'orgs/*',
]);

// For URL: https://example.com/orgs/acme/projects/remix
// Pattern 'orgs/:org/projects/:project' is the best match because:
// 1. Its normalized form 'orgs/:/projects/:' has the longest matching prefix
// 2. It's more specific than 'orgs/*' (globs are less specific than params)
// 3. It's more specific than 'orgs/:org/projects/settings' (shorter prefix)
//
// The matches in order of specificity:
// 1. orgs/:org/projects/:project → { org: 'acme', project: 'remix' }
// 2. orgs/:org/projects/settings → { org: 'acme' }
// 3. orgs/* → { path: 'acme/projects/remix' }
```

## Definitions

### JavaScript identifier

For the purposes of this spec, JavaScript identifiers match this regular expression: [/[a-zA-Z*$0-9][a-zA-Z*$0-9]\*/](https://regexr.com/8fcn3)
