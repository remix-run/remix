Do not allow partial matches for variables and wildcards in pathname

```ts
let matcher = createMatcher<string>()
matcher.add('/files/:name.md', 'original')
matcher.add('/files/:name.md.backup', 'backup')

// before: 'original' included since `:name.md` partially matches `readme.md.backup`
matcher.matchAll('https://example.com/files/readme.md.backup').map((match) => match.data)
// ❌ ['backup', 'original']

// after: only matches when the pattern covers the whole segment
matcher.matchAll('https://example.com/files/readme.md.backup').map((match) => match.data)
// ✅ ['backup']
```
