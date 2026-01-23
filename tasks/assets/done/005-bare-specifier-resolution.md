### Bare specifier resolution

Resolve bare specifiers (package imports) to full file paths.

**Acceptance Criteria:**

- [x] `import { x } from 'package'` resolves to the package's entry point
- [x] Uses esbuild's resolver for consistency with prod builds
- [x] Handles scoped packages (`@remix-run/component`)
- [x] Handles subpath exports (`@remix-run/component/jsx-runtime`)
- [x] Handles `package.json` `exports` field correctly
