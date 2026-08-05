import type { Database } from './database.ts'

/**
 * Controls how each migration is wrapped in transactions.
 *
 * - `auto` (default): wrap when the adapter supports transactional DDL.
 * - `required`: wrap; throws when the adapter does not support transactional DDL.
 * - `none`: never wrap.
 */
export type MigrationTransactionMode = 'auto' | 'required' | 'none'

/**
 * Migration metadata + SQL consumed by the registry/runner.
 */
export type MigrationDescriptor = {
  /** Migration id (typically a `YYYYMMDDHHmmss` timestamp). */
  id: string
  /** Human-readable migration slug. */
  name: string
  /** SQL executed for `runner.up(...)`. May contain multiple statements. */
  up: string
  /**
   * SQL executed for `runner.down(...)`. May contain multiple statements.
   * Omit (or pass `undefined`) for irreversible migrations.
   */
  down?: string
  /** Transaction wrapping mode. Defaults to `auto`. */
  transaction?: MigrationTransactionMode
  /** Optional source path used in error messages. */
  path?: string
}

/**
 * Direction used by migration runner operations.
 */
export type MigrationDirection = 'up' | 'down'

/**
 * Row shape persisted in the migration journal table.
 */
export type MigrationJournalRow = {
  id: string
  name: string
  checksum: string
  batch: number
  appliedAt: Date
}

/**
 * Effective migration status.
 *
 * - `applied`: the current migration matches its journal entry.
 * - `pending`: the current migration has not been applied.
 * - `drifted`: the current migration differs from its journal entry.
 * - `missing`: an applied journal entry has no migration in the current set.
 */
export type MigrationStatus = 'applied' | 'pending' | 'drifted' | 'missing'

/**
 * Status row returned by `runner.status()` and `runner.up/down(...)`.
 */
export type MigrationStatusEntry = {
  id: string
  name: string
  status: MigrationStatus
  appliedAt?: Date
  batch?: number
  checksum?: string
}

/**
 * Common options for `runner.up(...)` and `runner.down(...)`.
 * `to` and `step` are mutually exclusive.
 *
 * `to` accepts a bare migration id (`20260301113000`) or the full `id_name`
 * directory form (`20260301113000_add_user_status`).
 */
export type MigrateOptions =
  | {
      to: string
      step?: never
      dryRun?: boolean
    }
  | {
      to?: never
      step: number
      dryRun?: boolean
    }
  | {
      to?: undefined
      step?: undefined
      dryRun?: boolean
    }

/**
 * Result shape returned by migration runner commands.
 */
export type MigrateResult = {
  applied: MigrationStatusEntry[]
  reverted: MigrationStatusEntry[]
  /**
   * SQL scripts that were (or, for `dryRun`, would have been) executed.
   */
  sql: string[]
}

/**
 * Runtime-agnostic migration registry abstraction.
 */
export type MigrationRegistry = {
  register(migration: MigrationDescriptor): void
  list(): MigrationDescriptor[]
}

/**
 * Migration collection accepted by `db.migrate(...)` and `db.migrationStatus(...)`.
 */
export type Migrations = MigrationDescriptor[] | MigrationRegistry

/**
 * Lazy migration loader exported by app database modules.
 */
export type GetMigrations = () => Migrations | Promise<Migrations>

/**
 * Database seed function exported by app database modules.
 */
export type Seed = (db: Database) => void | Promise<void>

/**
 * Options for creating a migration runner.
 */
export type MigrationRunnerOptions = {
  /**
   * Journal table used to record applied migrations.
   * Defaults to `data_table_migrations`.
   */
  journalTable?: string
}

/**
 * Migration runner API for applying, reverting, and inspecting migration state.
 */
export type MigrationRunner = {
  up(options?: MigrateOptions): Promise<MigrateResult>
  down(options?: MigrateOptions): Promise<MigrateResult>
  status(): Promise<MigrationStatusEntry[]>
}
