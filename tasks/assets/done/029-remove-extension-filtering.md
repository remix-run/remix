# Remove hard-coded extension filtering

**The problem:**

Currently, the middleware hard-codes which file extensions can be served (`transformableExtensions = ['.ts', '.tsx', '.js', '.jsx']` on line 208). This creates a secondary filter beyond `allow`/`deny` patterns and blocks importing other file types:

```typescript
// Line 374-377: Rejects non-JS files before checking allow patterns
let ext = path.extname(pathname)
if (!transformableExtensions.has(ext)) {
  return next()
}

// Line 488-495: Same check for /@workspace/ files
let ext = path.extname(posixPath)
if (!transformableExtensions.has(ext)) {
  return new Response(`Cannot serve non-JS file: ${posixPath}`, ...)
}
```

**MVP approach:**

Use `allow`/`deny` patterns as the **only** gatekeeper. Remove the `transformableExtensions` check entirely.

- `allow`/`deny` patterns control both paths AND extensions (via regex)
- Users can be permissive (`/^app\//`) or restrictive (`/^app\/.*\.(tsx?|jsx?)$/`)
- Middleware handles any file that passes allow/deny checks
- If middleware can't handle an extension (no loader), return clear error
- Users explicitly control what's accessible - no magic defaults

**Examples:**

```typescript
// Permissive - let middleware handle whatever it can
devAssets({ allow: [/^app\//] })

// Restrictive - only specific extensions
devAssets({ allow: [/^app\/.*\.(tsx?|jsx?|json)$/] })

// Block specific files
devAssets({
  allow: [/^app\//],
  deny: [/\.env/, /\.test\./],
})
```

**Implementation:**

1. Remove `transformableExtensions` constant
2. Remove extension checks on lines 374-377 and 488-495
3. Let files through to the transform stage based solely on allow/deny
4. If esbuild can't handle the extension, the transform will error naturally
5. Return clear error message when extension isn't supported

**Benefits:**

- Simpler mental model - one place controls access
- No conflicting rules (extension check vs path patterns)
- Explicit user control via patterns
- Can expand supported file types without API changes

**Acceptance Criteria:**

- [x] Remove `transformableExtensions` Set from code
- [x] Remove extension check before allow/deny check (lines 374-377)
- [x] Remove extension check in `handleWorkspaceRequest` (lines 488-495)
- [x] Files pass through to transform based solely on allow/deny patterns
- [x] Return clear error when esbuild can't handle an extension (esbuild naturally errors)
- [x] Update tests to verify allow/deny controls everything (all 74 tests pass)
- [x] Demo still works with `/^app\//` pattern

**Implementation notes:**

- Added file existence and type check before allow/deny
- If file doesn't exist OR is a directory, calls `next()` to let router handle it
- Only regular files go through allow/deny checks
- This fixes the issue where `/` (which maps to root directory) was being blocked
- Esbuild will naturally error if it can't handle an extension
- All 74 tests passing, demo works correctly (both routes and assets)
