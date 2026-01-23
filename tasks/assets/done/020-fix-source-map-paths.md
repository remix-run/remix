### Fix source map paths to use URLs

Source maps now use URL paths instead of filesystem paths, so browser DevTools shows sources alongside network resources.

**Acceptance Criteria:**

- [x] Source map `sources` array uses URL paths (e.g., `/entry.tsx`)
- [x] App files show as `/path.tsx` in DevTools
- [x] Node modules show as `/@node_modules/pkg/path.ts` in DevTools
- [x] Sources appear next to network resources in DevTools Sources panel
- [x] Unit tests for `parseInlineSourceMap()` helper (5 tests)
