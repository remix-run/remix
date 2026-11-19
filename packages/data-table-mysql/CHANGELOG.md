# `data-table-mysql` CHANGELOG

This is the changelog for [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql). It follows [semantic versioning](https://semver.org/).

## v1.1.0

### Minor Changes

- Query builder results now read `boolean()` columns as `true` or `false`. MySQL stores booleans as `tinyint(1)`, which mysql2 returns as `1` or `0`. `db.exec()` results keep the values mysql2 returns. ([#12337](https://github.com/remix-run/remix/pull/12337))

### Patch Changes

- Bind every query parameter as exactly one value. Previously, mysql2 expanded array parameters into lists and plain-object parameters into column assignments, and it substituted values into question marks inside quoted strings, quoted identifiers, and comments. The adapter now binds parameters itself: it rejects objects other than `Date`, `Buffer`, typed arrays, and `DataView` (including mysql2 `raw()` and `toSqlString()` objects, which mysql2 inlined as SQL), binds bigints as integers instead of quoted strings, rejects `NaN` and `Infinity`, leaves question marks inside quotes and comments as written, and rejects statements whose placeholder and value counts differ. ([#12335](https://github.com/remix-run/remix/pull/12335))

  Raw SQL that relied on mysql2's array expansion, object expansion, or `??` identifier placeholder must be rewritten. Use `JSON.stringify(value)` for JSON data, `inList()` or one placeholder per item for lists of values, and quoted identifiers in the SQL text.

  ```diff
  -await db.exec('select * from accounts where id in (?)', [[1, 2]])
  +await db.exec('select * from accounts where id in (?, ?)', [1, 2])
  -await db.exec('select ?? from accounts', ['email'])
  +await db.exec('select `email` from accounts')
  ```

- Fix upserts with a separate `update` object binding values in the wrong order. Compiled statements bound the `on duplicate key update` values before the inserted values, so an upsert such as `upsert({ status: 'enabled', email: 'info@remix.run' }, { update: { email: 'contact@remix.run' } })` wrote the update value into the first inserted column. Inserted values are now bound first, matching their placeholders. ([#12276](https://github.com/remix-run/remix/pull/12276))

- Bumped `@remix-run/*` dependencies:
  - [`data-table@1.1.0`](https://github.com/remix-run/remix/releases/tag/data-table@1.1.0)

## v1.0.0

### Major Changes

- First stable release.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@1.0.0`](https://github.com/remix-run/remix/releases/tag/data-table@1.0.0)

## v0.5.4

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.7.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.7.0)

## v0.5.3

### Patch Changes

- Reject invalid `orderBy` direction values at runtime before interpolating them into generated MySQL queries.

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.6.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.6.0)

## v0.5.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.5.1`](https://github.com/remix-run/remix/releases/tag/data-table@0.5.1)

## v0.5.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.5.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.5.0)

## v0.5.0

### Minor Changes

- Added `createMysqlDatabase()` with config-backed construction, connection-scoped migration locking, database wiping for `remix db`, and `close()` for releasing an internally created pool. Existing `mysql2` pools and connections remain supported for applications that own the driver lifecycle, but wiping requires config-backed construction (see #11608, #11639).

  `wipe()` throws when no database name can be resolved from the connection config instead of guessing one. Failed migration runs and failed transaction startup destroy the reserved connection instead of returning a dirty session to the pool, and nested lock acquisition throws instead of deadlocking.

  BREAKING CHANGE: Removed `MysqlDatabaseAdapter` and `createMysqlDatabaseAdapter()` from the public entry point. Use `MysqlDatabase` and `createMysqlDatabase()` to get a complete MySQL-backed `Database`; `MysqlDatabaseAdapterOptions` was renamed to `MysqlDatabaseOptions`.

### Patch Changes

- Use bound parameters for compiled `limit` and `offset` clauses.

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.4.0)

## v0.4.0

### Minor Changes

- BREAKING CHANGE: removed `migrate(request)` and `compileSql(DataMigrationOperation)`

  The DDL operation ADT has been removed from `@remix-run/data-table`, so this adapter no longer implements `migrate()` and `compileSql()` only accepts `DataManipulationOperation`. SQL-file migrations run through the new `executeScript(sql, transaction?)` method, which forwards to `connection.query(sql)`.

  mysql2 only accepts multi-statement scripts when the underlying connection or pool was created with `multipleStatements: true`. Set that option when running migrations whose `up.sql` / `down.sql` contains more than one statement.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.3.0)

## v0.3.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.2.1`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.1)

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Removed adapter options

  **Affected APIs**
  - `MysqlDatabaseAdapterOptions` type: removed
  - `createMysqlDatabaseAdapter` function: `options` arg removed
  - `MysqlDatabaseAdapter` constructor: `options` arg removed

  **Why**

  Adapter options existed solely for tests to override adapter capabilities. If you must override capabilities, you can do so directly via mutation:

  ```ts
  let adapter = createMysqlDatabaseAdapter(mysql)
  adapter.capabilities = {
    ...adapter.capabilities,
    upsert: false,
  }
  ```

## v0.2.0

### Minor Changes

- Add first-class migration execution support to the mysql adapter. It now compiles and executes `DataMigrationOperation` plans for `remix/data-table/migrations`, including create/alter/drop table and index flows, migration journal writes, and adapter-managed migration locking.

  Normal reads/writes continue through `execute(...)`, while migration/DDL work runs through `migrate(...)`.

  SQL compilation remains adapter-owned and can share helpers from `remix/data-table/sql-helpers`.

- Add transaction-aware migration introspection to the mysql adapter.

  `hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now use the provided migration transaction connection when present, so planning and execution can inspect schema state inside the active migration transaction.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.0)

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/data-table-mysql`.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.1.0)

## v0.1.0

### Minor Changes

- Initial release.
