# Implementation Plan

- Introduce a `DatabaseResource` abstraction that owns database construction/configuration.
- Make database adapters an implementation detail of resources instead of exporting them from data-table packages.
- Keep migration APIs adapter-based for now; migration resource work will happen later.

## Steps

- [x] Author types for `DatabaseResource`
- [x] Implement `createSqliteDatabase`
  - Should detect if using `bun` runtime and use `bun:sqlite` in that case
- [x] Implement `createPostgresDatabase`
  - Ignore standalone client, just create a pool always
- [x] Implement `createMysqlDatabase`
  - Ignore standalone client, just create a pool always
- [x] Update SQLite resource behavior
  - File-backed SQLite should create a new SQLite client for each `connect()` call.
  - `:memory:` should throw if `connect()` is called more than once for the same resource.
  - Do not add shared-cache or connection-reuse behavior for `:memory:`.
- [ ] Update Postgres/MySQL resource options to support mutually exclusive connection modes
  - Accept an opaque `url` and pass it through to the driver without database-name overrides.
  - Accept structured fields like `host`, `port`, `database`, `user`, and `password` for tests and explicit configuration.
  - Reject options that mix `url` with structured connection identity fields.
  - Keep pool creation as the default implementation.
- [x] Replace `createDatabase(adapter)` usages in tests with `create{Sqlite,Postgres,Mysql}Database`
- [ ] Refactor adapter integration contract helper around database resources
  - Generate a unique database name per test.
  - Let each dialect-specific test create a resource from that name.
  - Use temporary file-backed SQLite for contract tests that rely on state persisting across multiple clients.
  - Read feature support from `db.adapter.capabilities` instead of passing separate flags like `supportsReturning`.
  - Keep database create/drop lifecycle in test utilities for now; do not add `create()`/`drop()` to `DatabaseResource` yet.
- [x] Update demos to use database resources instead of `createDatabase(adapter)` directly






- [ ] Update READMEs to use database resources instead of `createDatabase(adapter)` directly
- [ ] Remove adapter APIs from public exports.
  - Do this last, after all consumer-facing call sites use resources.
  - Keep internal adapter imports for dialect implementation tests if those tests still need low-level coverage.
- [ ] Run validation in narrow-to-broad order.
  - Start with affected package tests/typecheck.
  - Then run changed-package validation before broader repo validation if needed.
