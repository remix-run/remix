Add functions for comparing match specificity

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
import assert from 'node:assert'

let url = 'https://example.com/posts/new'

let pattern1 = new RoutePattern('/posts/:id')
let pattern2 = new RoutePattern('/posts/new')

let match1 = pattern1.match(url)
let match2 = pattern2.match(url)

assert(Specificity.lessThan(match1, match2))
```

**Hostname segments are compared right-to-left** (e.g., `example.com` compares `com` first, then `example`), though characters within a segment are still compared left-to-right:

```typescript
import assert from 'node:assert'

let url = 'https://app-api.example.com'

let pattern1 = new RoutePattern('https://app-*.example.com')
let match1 = pattern1.match(url)

let pattern2 = new RoutePattern('https://*-api.example.com')
let match2 = pattern2.match(url)

assert(Specificity.lessThan(match1, match2))
```
