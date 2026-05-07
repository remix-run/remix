Fix `createMatcher` from `remix/route-pattern` so dynamic pathname segments and wildcard continuations only match when they cover the full pathname range being tested.

```ts
import { createMatcher } from 'remix/route-pattern'

let matcher = createMatcher<string>()
matcher.add('/files/:name.md', 'markdown')
matcher.add('/files/:name.md.backup', 'backup')

// before: matched both patterns because `/files/:name.md` matched a prefix of the segment
matcher.matchAll('https://example.com/files/readme.md.backup').map((match) => match.data)
// ['backup', 'markdown']

// after: only matches when the pattern covers the whole segment
matcher.matchAll('https://example.com/files/readme.md.backup').map((match) => match.data)
// ['backup']
```
