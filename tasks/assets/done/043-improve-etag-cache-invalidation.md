# Improve ETag cache invalidation

**The problem:**

ETags are currently based on source file mtime/size. But the transformed output depends on more than just the source:

- Middleware transform logic (esbuild config, import rewriting rules)
- esbuild version
- Other dependencies

If transform logic changes but source files don't, the browser can serve stale cached transforms with outdated import paths (e.g., old URL patterns after renaming).

**The solution:**

Hash the final transformed output and use that as the ETag. This is simpler than trying to track all inputs - we just care if the output is the same.

**Two caching layers:**

1. **Server-side cache (in-memory):**

   - Uses `lastModified` (file mtime) to know when to re-transform
   - Avoids re-transforming unchanged files (performance optimization)
   - Lost on server restart (acceptable in dev)

2. **Browser cache (persistent):**
   - Uses hash-based ETag as cache validator
   - Persists between server restarts
   - Automatically invalidates when transform output changes (even if source didn't)

**Key insight:** The module graph already stores the final, fully transformed output (after esbuild, import rewriting, HMR transform, and source map inlining). Nothing is applied after retrieval from cache. So we can hash the cached result once per transform.

**Implementation:**

1. Add `hash` field to `moduleNode.transformResult`: `{ code, map, hash }`
2. After all transforms complete, hash the final code string
3. Use Web Crypto API for fast, web-standard hashing (avoid Node deps)
4. Replace `generateETag(mtime, size)` with `generateETag(hash)`
5. Keep mtime checking for server-side cache invalidation

**Flow:**

1. Request arrives with `If-None-Match: W/"hash123"`
2. Server checks: `stat(file).mtimeMs === moduleNode.lastModified`?
   - **Yes** → use cached `{ code, map, hash }`
   - **No** → transform, hash output, cache `{ code, map, hash, lastModified }`
3. Server responds with `ETag: W/"hashXYZ"`
4. Browser compares hash - if match, uses cached version

**Acceptance Criteria:**

- [x] `ModuleNode.transformResult` includes `hash` field
- [x] Hash computed once per transform (not per request)
- [x] Hash computed from final transformed code string
- [x] Uses Web Crypto API (web-standard, fast)
- [x] `generateETag()` uses hash instead of mtime/size
- [x] Server still uses mtime for cache invalidation (don't re-transform unchanged files)
- [x] ETags automatically invalidate when transform output changes
- [x] Unit tests verify hash-based ETags work correctly
- [x] Unit tests verify server-side mtime caching still works
