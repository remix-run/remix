import type { Database } from './database.ts'

/**
 * SQL migration consumed by `createMigrator()`.
 */
export type Migration = {
  /** Migration id. */
  id: string
  /** SQL executed when applying the migration. May contain multiple statements. */
  sql: string
}

/**
 * Programmatic migration API for applying and inspecting migrations through a connected database.
 */
export type Migrator = {
  migrate(
    database: Database,
    options?: {
      /** Apply pending migrations up to and including this migration id. */
      to?: string
    },
  ): Promise<{
    applied: Migration[]
  }>
  status(database: Database): Promise<
    Array<{
      id: string
      status: 'applied' | 'pending' | 'drifted'
      appliedAt?: Date
      batch?: number
      hash?: string
    }>
  >
}
