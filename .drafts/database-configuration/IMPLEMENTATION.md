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

- [x] Replace `createDatabase(adapter)` usages in tests with `create{Sqlite,Postgres,Mysql}Database`
- [x] Refactor adapter integration contract helper to use transaction rollback
  - Remove migration/DDL coverage from the adapter integration contract; cover migrations separately later.
  - Keep the existing one-env-var-per-provider integration test enablement model for Postgres/MySQL.
  - Use an in-memory SQLite database resource for the SQLite adapter contract, since these tests use a single database client and do not need multiple connections.
  - Create contract tables once in suite setup and drop them in suite teardown.
  - Run each contract test inside an outer transaction that always rolls back.
  - Ensure tests use the transaction-scoped `Database` client so nested `transaction()` calls become savepoints.
  - Read feature support from `db.adapter.capabilities` instead of passing separate flags like `supportsReturning`.
- [x] Update demos to use database resources instead of `createDatabase(adapter)` directly






- [ ] Update READMEs to use database resources instead of `createDatabase(adapter)` directly
- [ ] Remove adapter APIs from public exports.
  - Do this last, after all consumer-facing call sites use resources.
  - Keep internal adapter imports for dialect implementation tests if those tests still need low-level coverage.
- [ ] Run validation in narrow-to-broad order.
  - Start with affected package tests/typecheck.
  - Then run changed-package validation before broader repo validation if needed.
