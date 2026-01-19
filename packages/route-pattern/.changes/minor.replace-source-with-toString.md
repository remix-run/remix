BREAKING CHANGE: Use `toString()` instead of `source`

**Before:**
```typescript
let pattern = new RoutePattern('/posts/:id')
console.log(pattern.source) // '/posts/:id'
```

**After:**
```typescript
let pattern = RoutePattern.parse('/posts/:id')
console.log(pattern.toString()) // '/posts/:id'
```

**Why:** After parsing, patterns are normalized and can be joined with other patterns without messing with source strings. The `source` property becomes meaningless for patterns that weren't created from a source string (e.g., joined patterns). Plus, you already have access to the original source string. Instead, `RoutePattern.toString()` will provide a string representation of the canonical, normalized pattern based on the AST (the source-of-truth).
