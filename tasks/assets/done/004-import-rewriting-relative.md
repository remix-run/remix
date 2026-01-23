### Import rewriting for relative imports

Rewrite relative imports to include file extensions.

**Acceptance Criteria:**

- [x] `import { foo } from './utils'` becomes `import { foo } from './utils.ts'`
- [x] Resolution uses esbuild's resolver
- [x] Handles `.ts`, `.tsx`, `.js`, `.jsx` extensions
- [x] Handles index files (`./components` → `./components/index.ts`)
- [x] Handles subpath imports (`./components/Button` → `./components/Button.tsx`)
