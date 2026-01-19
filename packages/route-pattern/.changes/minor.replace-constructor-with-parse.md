BREAKING CHANGE: Use `RoutePattern.parse()` instead of `new RoutePattern()`

**Before:**
```typescript
let pattern = new RoutePattern('/posts/:id')
```

**After:**
```typescript
let pattern = RoutePattern.parse('/posts/:id')
```

**Why:** `RoutePattern.join()` is now more efficient because it no longer needs to reparse the pattern being joined. This means we construct RoutePattern instances from an AST (not a source string), which isn't intended as a public API. The canonical AST-based constructor is now private, and `parse()` is the user-facing API for creating patterns from strings.
