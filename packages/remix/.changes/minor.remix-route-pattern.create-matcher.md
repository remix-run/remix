BREAKING CHANGE: `remix/route-pattern` no longer exports `ArrayMatcher` or `TrieMatcher`. Use the new `createMatcher` function instead.

```ts
// before
import { ArrayMatcher } from 'remix/route-pattern'
let matcher = new ArrayMatcher<string>()

// after
import { createMatcher } from 'remix/route-pattern'
let matcher = createMatcher<string>()
```
