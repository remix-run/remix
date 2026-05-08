BREAKING CHANGE: Replace `ArrayMatcher` and `TrieMatcher` exports with a single `createMatcher` function.

The package now ships one matcher implementation. `Matcher` and `Match` types are unchanged.

```ts
// before
import { ArrayMatcher, TrieMatcher } from '@remix-run/route-pattern'
let matcher = new ArrayMatcher<string>()
// or
let matcher = new TrieMatcher<string>()

// after
import { createMatcher } from '@remix-run/route-pattern'
let matcher = createMatcher<string>()
```
