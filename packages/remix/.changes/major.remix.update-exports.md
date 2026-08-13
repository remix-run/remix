BREAKING CHANGE: Legacy package-aligned `remix/*` aliases have been removed in favor of canonical entrypoints that group related APIs together. Update imports when moving from beta.5 to beta.6:

```diff
- import { requireAuth } from 'remix/auth-middleware'
- import { createPostgresDatabase } from 'remix/data-table-postgres'
- import { createRouter } from 'remix/fetch-router'
+ import { requireAuth } from 'remix/middleware/auth'
+ import { createPostgresDatabase } from 'remix/data-table/postgres'
+ import { createRouter } from 'remix/router'
```

The same canonical structure applies to the other entrypoints: middleware lives under `remix/middleware/*`, database dialects under `remix/data-table/*`, storage adapters under `remix/file-storage/*` and `remix/session-storage/*`, and route definitions move from `remix/fetch-router/routes` to `remix/routes`.
