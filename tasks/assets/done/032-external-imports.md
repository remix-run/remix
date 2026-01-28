# External imports

Honor esbuild's `external` config to skip import rewriting for specified patterns.

This enables import map support by allowing bare specifiers to be left unchanged so the browser can resolve them (e.g., via an import map that maps `@remix-run/component` to a CDN URL). It also supports marking CDN URLs as external so they're not processed by the dev server.

**Acceptance Criteria:**

- [x] Honors esbuild's `external` config in the dev middleware
- [x] Supports strings (exact match) and regex patterns (pattern match)
- [x] External imports are not rewritten (left as-is for browser to resolve)
- [x] Works for both static and dynamic imports
- [x] No automatic special-casing (all imports, including HTTP/HTTPS URLs, require explicit configuration)

## Implementation Notes

**Key decisions:**

1. **External config comes from esbuild config, not a separate option** - Following the esbuild config support pattern from task 031, the `external` option is part of `esbuildConfig` rather than a top-level `DevAssetsOptions` property. This makes sense because it's an esbuild concept that should be shared between dev and prod.

2. **Added `external` to `SUPPORTED_ESBUILD_OPTIONS`** - The external option is now whitelisted and extracted from the esbuild config, but NOT passed to esbuild itself (since we always use `external: ['*']` internally to maintain unbundled dev).

3. **Runtime filtering in import rewriting** - Created `isExternalSpecifier()` helper that checks if a specifier matches user-configured external patterns. This is called in two places:

   - Before collecting uncached specifiers for resolution
   - Before rewriting imports with MagicString

4. **Supports both strings and regex** - The `external` option accepts `string | RegExp | (string | RegExp)[]` following esbuild's type. Strings are exact matches, regexes are pattern matches.

5. **No automatic special-casing** - For dev/prod parity, all imports (including HTTP/HTTPS URLs) must be explicitly configured in the `external` array to be treated as external. This matches esbuild's behavior exactly and prevents dev-only code from breaking in production.

**Example usage:**

```typescript
// esbuild.config.ts
export const esbuildConfig = {
  entryPoints: ['app/entry.tsx'],
  external: [
    '@remix-run/component', // Bare specifier for import maps
    'https://unpkg.com/lodash', // CDN URL (must be explicit)
    /^https:\/\/unpkg\.com\//, // Pattern for all unpkg URLs
  ],
  // ... other options
}

// With import map in HTML:
// <script type="importmap">
// { "imports": { "@remix-run/component": "https://unpkg.com/@remix-run/component" } }
// </script>

// In your code:
import { createRoot } from '@remix-run/component' // External: left unchanged for import map
import { map } from 'https://unpkg.com/lodash' // External: left unchanged (matches pattern)
import { utils } from './utils.ts' // Not external: rewritten to /app/utils.ts
```

**Files changed:**

- `packages/dev-assets-middleware/src/lib/assets.ts`:

  - Added `external` to `SUPPORTED_ESBUILD_OPTIONS` constant
  - Added `isExternalSpecifier()` helper function
  - Updated `devAssets()` to extract external patterns from esbuildConfig
  - Updated all function signatures to pass `externalPatterns` through the call chain
  - Updated `rewriteImports()` to skip external specifiers
  - Removed special case for root-relative paths (now treated like any other specifier)
  - Cleaned up dead code (empty exports loop)
  - Updated JSDoc to document `external` support

- `packages/dev-assets-middleware/src/lib/assets.test.ts`:
  - Added `external imports` test suite with 4 tests:
    - HTTP/HTTPS URLs unchanged when explicitly configured
    - Bare specifiers matching string patterns
    - Bare specifiers matching regex patterns
    - Both static and dynamic imports
  - Uses `@remix-run/component` and `@external/package` examples (not third-party packages)
  - Uses `unpkg.com` for CDN examples
