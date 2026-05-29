Matchers now normalize percent-encoded pathname during matching

Pathname matching now uses the URL parser's normalized pathname, splits it into segments, and canonicalizes each segment as percent-encoded text before matching. This allows equivalent path text like `a` and `%61`, or `café` and `caf%C3%A9`, to match consistently:

```ts
let matcher = createMatcher('/a')

matcher.match('https://example.com/%61')
// before: null
// after:  { params: {} }
```

```ts
let matcher = createMatcher('/café')

matcher.match('https://example.com/caf%C3%A9')
// before: null
// after:  { params: {} }
```

Also keeps encoded path separators like `%2F` inside the segment where they appear instead of treating them as `/` separators during matching:

```ts
let matcher = createMatcher('/files/:dir/:name')

matcher.match('https://example.com/files/docs/readme.md')
// before: { params: { dir: 'docs', name: 'readme.md' } }
// after:  { params: { dir: 'docs', name: 'readme.md' } }

matcher.match('https://example.com/files/docs%2Freadme.md')
// before: { params: { dir: 'docs', name: 'readme.md' } }
// after:  null
```

Matched pathname params are still returned decoded.

```ts
let matcher = createMatcher('/posts/:slug')
let href = createHref('/posts/:slug', { slug: 'hello/world?draft=true#preview' })

matcher.match(`https://example.com${href}`)
// before: null
// after:  { params: { slug: 'hello/world?draft=true#preview' } }
```
