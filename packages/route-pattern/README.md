# Route Patterns

Route patterns are strings that describe the structure of URLs you want to match.

This spec discusses what the user sees when they interact with route patterns.
It does not discuss the algorithms nor data structures used by the matching engine, which will be discussed elsewhere.

## Goals

- Simple metric for ranking matches
- Detect unreachable routes
- Benchmark in the same ballpark as existing solutions

## Non-goals

- Matching URL fragments (`#section`)
- Matching URL port (`:8080`)
- Matching URL credentials (`user:pass@`)
- Caching
- Request/Response handling

## Quick example

This example is here to jump-start your intuition.
Don't worry if something is unclear; we'll cover things in excruciating detail in later sections.

```ts
const matcher = createMatcher([
  'products/:id',
  'products/sku-:sku(/compare/sku-:sku2)',
  'blog/:year-:month-:day/:slug(.html)',
  '://:tenant.remix.run/admin/users/:userId',
]);

const url = 'https://remix.run/products/wireless-headphones';
const match = matcher.match(url);

console.log(match?.pattern); // 'products/:id'
console.log(match?.params); // { id: 'wireless-headphones' }
```

If you want fine-grained control, you can also get all matches in ranked order:

```ts
const url = 'https://remix.run/products/sku-electronics-12345';
for (const match of matcher.matches(url)) {
  console.log(`${match.pattern} -> ${JSON.stringify(match.params)}`);
}
// products/sku-:sku(/compare/sku-:sku2) -> { sku: 'electronics-12345' }
// products/:id -> { id: 'sku-electronics-12345' }
```

## Route pattern parts

Route patterns are composed of 4 parts: protocol, hostname, pathname and search.
You can use any combination of these to create a route pattern, for example:

```ts
'/products'; // pathname
'/search?q'; // pathname + search
'https://remix.run/store'; // protocol + hostname + pathname
'://remix.run/store'; // hostname + pathaname
'file:///usr/bin'; // protocol + pathname
// ...and so on...
```

**Part delimiters:** Route patterns use the first occurrences of `://`, `/`, and `?` as delimiters to split a route pattern into its parts.
Pathname-only route patterns are the most common, so route patterns are assumed to be pathname-only unless `://` or `?` are present.
As a result, hostnames must begin with `://` and searches must begin with `?` to distinguish both from pathnames.

**Case Sensitivity:** Protocol and hostname are case-insensitive, while pathname and search are case-sensitive.

**Omitting parts:** For protocol, hostname, and pathname omitting that part means "match anything" for that part.
However, omitting a pathname means "match the 'empty' pathname" (namely `""` and `"/"`)

```ts
'://api.example.com/users';
// ✓ matches: https://api.example.com/users
// ✓ matches: http://api.example.com/users
// ✓ matches: ftp://api.example.com/users

'/api/users';
// ✓ matches: https://example.com/api/users
// ✓ matches: https://staging.api.com/api/users
// ✓ matches: https://localhost:3000/api/users

'https://api.example.com';
// ✓ matches: https://api.example.com
// ✓ matches: https://api.example.com/
// ✗ doesn't match: https://api.example.com/users
```

## Pattern modifiers

Each pattern modifier — [param](#params), [glob](#globs), or [optional](#optionals) — applies only in the same part of the URL where it appears.
As a result:

- Params and globs do not match characters that appear outside of their part of the route pattern
- Optionals must begin and end within the same part of the route pattern

### Params

|            | protocol | hostname | pathname | search |
| ---------- | -------- | -------- | -------- | ------ |
| Supported? | ❌       | ✅       | ✅       | ❌     |

Params match dynamic parts of a URL within a segment.

They are written as a `:` optionally followed by a [JavaScript identifier](#javascript-identifier) that acts as its name:

```ts
'products/:id';
// /products/wireless-headphones → { id: 'wireless-headphones' }
// /products/123 → { id: '123' }
```

When a param name is not given, the matched value won't be returned:

```ts
'products/:-shoes';
// /products/tennis-shoes -> {}
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

Params can be mixed with static text and even other params:

```ts
'users/@:id';
// /users/@sarah → { id: 'sarah' }

'downloads/:filename.pdf';
// /downloads/report.pdf → { filename: 'report' }

'api/v:major.:minor-:channel';
// /api/v2.1-beta → { major: '2', minor: '1', channel: 'beta' }

'://us-:region.:env.api.example.com';
// us-east.staging.api.example.com → { region: 'east', env: 'staging' }
```

### Globs

|            | protocol | hostname | pathname | search |
| ---------- | -------- | -------- | -------- | ------ |
| Supported? | ❌       | ✅       | ✅       | ❌     |

Globs match dynamic parts of a URL, but — unlike [params](#params) — they are not limited to a single segment.

They are written as a `*` optionally followed by a [JavaScript identifier](#javascript-identifier) that acts as its name:

```ts
// todo
```

When a glob name is not given, the matched value won't be returned:

```ts
// todo
```

Globs share a namespace with params:

```ts
// todo
```

### Optionals

|            | protocol | hostname | pathname | search |
| ---------- | -------- | -------- | -------- | ------ |
| Supported? | ✅       | ✅       | ✅       | ❌     |

You can mark any part of a pattern as optional by enclosing it in parentheses `()`.

```ts
'products/:id(/edit)';
// /products/winter-jacket → { id: 'winter-jacket' }
// /products/winter-jacket/edit → { id: 'winter-jacket' }

'http(s)://api.example.com';
// http://api.example.com → {}
// https://api.example.com → {}
```

Optionals can span any characters and contain static text, params, or wildcards:

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

'users/:userId(/files/:)';
// /users/sarah → { userId: 'sarah' }
// /users/sarah/files/document.pdf → { userId: 'sarah' }

'users/:userId(/docs/*)';
// /users/sarah → { userId: 'sarah' }
// /users/sarah/docs/projects/readme.md → { userId: 'sarah' }

'users/:userId(/files/*path)';
// /users/sarah → { userId: 'sarah' }
// /users/sarah/files/projects/docs/readme.md → { userId: 'sarah', path: 'projects/docs/readme.md' }

'://(www.)shop.example.com';
// shop.example.com → {}
// www.shop.example.com → {}

'://(:.)api.example.com(/v:)';
// api.example.com → {}
// cdn.api.example.com/v2 → {}
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

### Escaping special characters

Use backslash `\` to escape special characters in the patterns language: `:`, `*`, `(` and `)`.

**Note:** In JavaScript code, you'll need `\\` since backslash itself needs to be escaped in a string:

```ts
'/api\\:v2/users';
// ✅ Matches: /api:v2/users (literal colon)
// ❌ Does NOT match: /apiv2/users (param :v2 would consume "v2")

'/files\\*.backup';
// ✅ Matches: /files*.backup (literal asterisk)
// ❌ Does NOT match: /files/document.backup (wildcard * would match "document")

'/docs\\*\\*/readme.md';
// ✅ Matches: /docs**/readme.md (literal asterisks)
// ❌ Does NOT match: /docs/api/v1/readme.md (** would match "api/v1")

'/wiki/Mercury\\(planet\\)';
// ✅ Matches: /wiki/Mercury(planet) (literal parentheses for disambiguation)
// ❌ Does NOT match: /wiki/Mercury (optionals would make "(planet)" optional)

'://api\\*.example.com';
// ✅ Matches: ://api*.example.com (literal asterisk in hostname)
// ❌ Does NOT match: ://api-cdn.example.com (wildcard * would match "-cdn")

'/search\\:query\\(\\*\\*\\)';
// ✅ Matches: /search:query(**) (all literal characters)
```

## Definitions

### JavaScript identifier

For the purposes of this spec, JavaScript identifiers match this regular expression: [`/[a-zA-Z_$0-9][a-zA-Z_$0-9]*/`](https://regexr.com/8fcn3)
