BREAKING CHANGE: Rename match `meta` to `paramsMeta`

For `RoutePattern.match` and `type RoutePatternMatch`:

```ts
import { RoutePattern, type RoutePatternMatch } from 'remix/route-pattern'

let pattern = new RoutePattern('...')
let match = pattern.match(url)

// BEFORE
type Meta = RoutePatternMatch['meta']
match.meta

// AFTER
type ParamsMeta = RoutePatternMatch['paramsMeta']
match.paramsMeta
```

For `Matcher.match` and `type Match`:

```ts
import { Matcher, type Match } from 'remix/route-pattern'

let matcher: Matcher = new ArrayMatcher() // Or TrieMatcher

let match = matcher.match(url)

// BEFORE
type Meta = Match['meta']
match.meta

// AFTER
type ParamsMeta = Match['paramsMeta']
match.paramsMeta
```
