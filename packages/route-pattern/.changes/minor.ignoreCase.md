BREAKING CHANGE: Remove `RoutePatternOptions` type and rework `ignoreCase`

`RoutePattern.ignoreCase` field has been removed and `ignoreCase` now only applies to `pathname` (no longer applies to `search`)

Case sensitivity is now determined only when matching.

- `RoutePattern.match` now accept `ignoreCase` option
- `Matcher` constructors now accept `ignoreCase` option

```ts
// BEFORE
let pattern = new RoutePattern('/Posts/:id', { ignoreCase: true })
pattern.match(url)
pattern.join(other, { ignoreCase: true })

let matcher = new ArrayMatcher()

// AFTER
let pattern = new RoutePattern('/Posts/:id')
pattern.match(url) // default: ignoreCase = false
pattern.match(url, { ignoreCase: true })
pattern.join(other)

let arrayMatcher = new ArrayMatcher() // default: ignoreCase = false
// OR
let arrayMatcher = new ArrayMatcher({ ignoreCase: true })

let trieMatcher = new TrieMatcher() // default: ignoreCase = false
// OR
let trieMatcher = new TrieMatcher({ ignoreCase: true })
```
