BREAKING CHANGE: Updated the `remix` package to use domain-oriented exports, no longer always mapping 1:1 to underlying `@remix-run/*` packages

Removed `package.json` `exports`:

**Router**

- `remix/fetch-router` → `remix/router`
- `remix/fetch-router/routes` → `remix/routes`

**Middleware**

- `remix/async-context-middleware` → `remix/middleware/async-context`
- `remix/auth-middleware` → `remix/middleware/auth`
- `remix/compression-middleware` → `remix/middleware/compression`
- `remix/cop-middleware` → `remix/middleware/cop`
- `remix/cors-middleware` → `remix/middleware/cors`
- `remix/csrf-middleware` → `remix/middleware/csrf`
- `remix/form-data-middleware` → `remix/middleware/form-data`
- `remix/logger-middleware` → `remix/middleware/logger`
- `remix/method-override-middleware` → `remix/middleware/method-override`
- `remix/render-middleware` → `remix/middleware/render`
- `remix/session-middleware` → `remix/middleware/session`
- `remix/static-middleware` → `remix/middleware/static`

**Session storage**

- `remix/session/cookie-storage` → `remix/session-storage/cookie`
- `remix/session/fs-storage` → `remix/session-storage/fs`
- `remix/session/memory-storage` → `remix/session-storage/memory`
- `remix/session-storage-redis` → `remix/session-storage/redis`
- `remix/session-storage-memcache` → `remix/session-storage/memcache`

**Data table adapters**

- `remix/data-table-mysql` → `remix/data-table/mysql`
- `remix/data-table-postgres` → `remix/data-table/postgres`
- `remix/data-table-sqlite` → `remix/data-table/sqlite`

**File storage**

- `remix/file-storage-s3` → `remix/file-storage/s3`
