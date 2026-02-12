// Test-only bridge to the sqlite adapter source package.
// We intentionally avoid a `@remix-run/data-table-sqlite` devDependency here because it creates
// a cyclic workspace dependency warning in pnpm (`data-table` <-> `data-table-sqlite`).
export type { SqliteDatabaseAdapterOptions } from '../../data-table-sqlite/src/lib/adapter.ts'
export { createSqliteDatabaseAdapter } from '../../data-table-sqlite/src/lib/adapter.ts'
