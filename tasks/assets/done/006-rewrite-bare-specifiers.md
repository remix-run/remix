### Rewrite bare specifiers to `/@node_modules/` URLs

Transform resolved bare specifiers into `/@node_modules/` URLs.

**Acceptance Criteria:**

- [x] `import { x } from 'pkg'` becomes `import { x } from '/@node_modules/pkg/path/to/file.js'`
- [x] Path is `{packageName}/{pathWithinPackage}`
- [x] Works with workspace packages (symlinked in node_modules)
- [x] Works with regular node_modules packages
- [x] Scoped packages work (`@remix-run/component`)
