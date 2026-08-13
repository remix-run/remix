BREAKING CHANGE: Remix 3 beta.6 includes the following migrations from beta.5:

- Package-aligned aliases have been removed in favor of canonical `remix/*` entrypoints:
  - Middleware imports move from `remix/{async-context,auth,compression,cop,cors,csrf,form-data,logger,method-override,render,session,static}-middleware` to `remix/middleware/{async-context,auth,compression,cop,cors,csrf,form-data,logger,method-override,render,session,static}`.
  - Database adapters move from `remix/data-table-{mysql,postgres,sqlite}` to `remix/data-table/{mysql,postgres,sqlite}`.
  - Use `remix/router` instead of `remix/fetch-router` and `remix/routes` instead of `remix/fetch-router/routes`.
  - Storage adapters move from `remix/file-storage-s3`, `remix/session-storage-{memcache,redis}`, and `remix/session/{cookie,fs,memory}-storage` to `remix/file-storage/s3` and `remix/session-storage/{memcache,redis,cookie,fs,memory}`.
- `createAssetServer()` now uses `allowFiles` and `denyFiles` instead of `allow` and `deny`.
- Run tests with `remix test` instead of the removed `remix-test` executable. Move settings from `remix-test.config.ts` or `.js` to the `test` property in `remix.json`. The programmatic `runRemixTest()` API now accepts typed runner options instead of raw command-line arguments.
- Browser frame resolvers now receive `resolveFrame(src, options)` instead of positional `signal` and `target` arguments. Read those values from `options?.signal` and `options?.target`.
- Route href helpers now take search parameters in a `searchParams` options property. Route params stop at `/` and `.`, but not `-`, so patterns that relied on a hyphen to separate adjacent params must use a single param or separate path segments. Ambiguous patterns are now rejected.
- Session cookies are HTTP-only by default when `httpOnly` is omitted. `Cookie.httpOnly` returns `boolean | undefined`, and custom cookie `encode` and `decode` functions now own the complete cookie value representation without Remix adding its default base64 wrapper.
- Built-in database adapters have been replaced by complete `createPostgresDatabase()`, `createMysqlDatabase()`, and `createSqliteDatabase()` factories. Use the returned `Database` for migrations and lifecycle operations instead of the removed adapter and migration-runner APIs.
