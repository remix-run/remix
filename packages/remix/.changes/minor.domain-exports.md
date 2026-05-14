Updated the `remix` package to use domain-oriented exports, no longer always mapping
1:1 to underlying `@remix-run/*` packages.  1:1 package exports are left to ease migrations,
but are marked deprecated and will be removed before a Remix 3.0.0 stable release.

Changed package mappings:

- `remix/middleware/async-context` → `remix/middleware/async-context`
- `remix/middleware/auth` → `remix/middleware/auth`
- `remix/middleware/compression` → `remix/middleware/compression`
- `remix/middleware/cop` → `remix/middleware/cop`
- `remix/middleware/cors` → `remix/middleware/cors`
- `remix/middleware/csrf` → `remix/middleware/csrf`
- `remix/data-table/mysql` → `remix/data-table/mysql`
- `remix/data-table/postgres` → `remix/data-table/postgres`
- `remix/data-table/sqlite` → `remix/data-table/sqlite`
- `remix/router` → `remix/router`
- `remix/routes` → `remix/routes`
- `remix/file-storage/s3` → `remix/file-storage/s3`
- `remix/middleware/form-data` → `remix/middleware/form-data`
- `remix/middleware/logger` → `remix/middleware/logger`
- `remix/middleware/method-override` → `remix/middleware/method-override`
- `remix/middleware/render` → `remix/middleware/render`
- `remix/middleware/session` → `remix/middleware/session`
- `remix/session-storage/memcache` → `remix/session-storage/memcache`
- `remix/session-storage/redis` → `remix/session-storage/redis`
- `remix/session-storage/cookie` → `remix/session-storage/cookie`
- `remix/session-storage/fs` → `remix/session-storage/fs`
- `remix/session-storage/memory` → `remix/session-storage/memory`
- `remix/middleware/static` → `remix/middleware/static`
