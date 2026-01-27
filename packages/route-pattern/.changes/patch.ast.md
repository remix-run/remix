Add `ast` property to `RoutePattern`

The AST is a read-only, "bare-metal" API designed for advanced use cases. For example, optimized matchers like `TrieMatcher` can't just delegate matching to `RoutePattern.match()` for each of their patterns and need direct access to the pattern AST.

```ts
let ast: AST = pattern.ast

type AST = {
  protocol: PartPattern
  hostname: PartPattern
  port: string | null
  pathname: PartPattern
  search: SearchConstraints
}
```

```ts
type PartPattern = {
  tokens: Array<Token>
  paramNames: Array<string>
  /** Map of `(` token index to its corresponding `)` token index for optional segments */
  optionals: Map<number, number>
  separator: '.' | '/' | ''
}

type Token =
  | { type: 'text'; text: string }
  | { type: 'separator' }
  | { type: '(' | ')' }
  | { type: ':' | '*'; nameIndex: number } // nameIndex references paramNames array

// `posts/:id(/edit)`
let part: PartPattern = {
  tokens: [
    { type: 'text', text: 'posts' },
    { type: 'separator' },
    { type: ':', nameIndex: 0 },
    { type: '(' },
    { type: 'separator' },
    { type: 'text', text: 'edit' },
    { type: ')' },
  ],
  paramNames: ['id'],
  optionals: new Map([[3, 6]]), // token at index 3 '(' maps to token at index 6 ')'
  separator: '/',
}
```

```ts
type SearchConstraints = Map<string, Set<string> | null>

// - `null`: key must be present (matches ?q, ?q=, ?q=1)
// - Empty Set: key must be present with a value (matches ?q=1)
// - Non-empty Set: key must be present with all these values (matches ?q=x&q=y)
```
