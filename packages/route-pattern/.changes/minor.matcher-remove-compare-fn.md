BREAKING CHANGE: Remove the `compareFn` parameter from `Matcher.match` and `Matcher.matchAll`.

Matches always sort by specificity (most specific first). If you need a different order, sort the result of `matchAll` yourself.

```ts
import * as Specificity from "remix/route-pattern/specificity"

// before
matcher.matchAll(url, Specificity.ascending)

// after
matcher.matchAll(url).sort(Specificity.ascending)
```
