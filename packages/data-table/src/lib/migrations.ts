import type { Database } from './database.ts'
import type { ColumnDefinition, ForeignKeyAction, IndexDefinition } from './adapter.ts'
import type { ColumnBuilder } from './column.ts'
import type { SqlStatement } from './sql.ts'
import type { AnyTable } from './table.ts'

/**
 * Controls how each migration is wrapped in transactions.
 */
export type MigrationTransactionMode = 'auto' | 'required' | 'none'

/**
 * Runtime context passed to migration `up`/`down` handlers.
 */
export type MigrationContext = {
  /**
   * Immediate data runtime (`query/create/update/exec/transaction`).
   */
  db: Database
  /**
   * Migration schema runtime (`createTable/alterTable/createIndex/...`).
   */
  schema: MigrationSchema
}

/**
 * Authoring shape for `createMigration(...)`.
 */
export type CreateMigrationInput = {
  up: (context: MigrationContext) => Promise<void> | void
  down: (context: MigrationContext) => Promise<void> | void
  transaction?: MigrationTransactionMode
}

/**
 * Normalized migration object consumed by the registry/runner.
 */
export type Migration = {
  up: CreateMigrationInput['up']
  down: CreateMigrationInput['down']
  transaction: MigrationTransactionMode
}

/**
 * Creates a migration descriptor with normalized defaults.
 * @param input Migration handlers and transaction mode.
 * @returns A normalized migration object.
 * @example
 * ```ts
 * import { column as c, table } from 'remix/data-table'
 * import { createMigration } from 'remix/data-table/migrations'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer().primaryKey().autoIncrement(),
 *     email: c.varchar(255).notNull().unique(),
 *   },
 * })
 *
 * export default createMigration({
 *   async up({ db, schema }) {
 *     await schema.createTable(users)
 *
 *     if (db.adapter.dialect === 'sqlite') {
 *       await db.exec('pragma foreign_keys = on')
 *     }
 *   },
 *   async down({ schema }) {
 *     await schema.dropTable('users', { ifExists: true })
 *   },
 * })
 * ```
 */
export function createMigration(input: CreateMigrationInput): Migration {
  return {
    up: input.up,
    down: input.down,
    transaction: input.transaction ?? 'auto',
  }
}

/**
 * Migration metadata stored in registries and returned by loaders.
 */
export type MigrationDescriptor = {
  id: string
  name: string
  path?: string
  checksum?: string
  migration: Migration
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
 * Effective status for a known migration.
 */
export type MigrationStatus = 'applied' | 'pending' | 'drifted'

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
   * Compiled SQL statements for operations processed during this run.
   * Includes planned SQL when running with `dryRun: true`.
   */
  sql: SqlStatement[]
}

/**
 * Options for `schema.createTable(...)` migration operations.
 */
export type CreateTableOptions = { ifNotExists?: boolean }
/**
 * Options for `schema.alterTable(...)` migration operations.
 */
export type AlterTableOptions = { ifExists?: boolean }
/**
 * Options for `schema.dropTable(...)` migration operations.
 */
export type DropTableOptions = { ifExists?: boolean; cascade?: boolean }
/**
 * Accepts either one index column or multiple (compound index).
 */
export type IndexColumns = string | string[]

/**
 * Accepts either one key column or multiple (compound key).
 */
export type KeyColumns = string | string[]

/**
 * Accepts either a SQL table name or a `table(...)` object.
 */
export type TableInput = string | AnyTable

/**
 * Optional name override for constraints and indexes.
 */
export type NamedConstraintOptions = {
  name?: string
}

/**
 * Foreign key options for migration APIs.
 */
export type ForeignKeyOptions = NamedConstraintOptions & {
  onDelete?: ForeignKeyAction
  onUpdate?: ForeignKeyAction
}

/**
 * Index options for migration APIs.
 */
export type CreateIndexOptions = NamedConstraintOptions &
  Omit<IndexDefinition, 'table' | 'name' | 'columns'> & {
    ifNotExists?: boolean
  }

/**
 * Builder API available inside `schema.alterTable(name, table => ...)`.
 */
export interface AlterTableBuilder {
  /** Adds a column during an `alterTable` migration. */
  addColumn(name: string, definition: ColumnDefinition | ColumnBuilder): void
  /** Changes an existing column during an `alterTable` migration. */
  changeColumn(name: string, definition: ColumnDefinition | ColumnBuilder): void
  /** Renames a column during an `alterTable` migration. */
  renameColumn(from: string, to: string): void
  /** Drops a column during an `alterTable` migration. */
  dropColumn(name: string, options?: { ifExists?: boolean }): void
  /** Adds a primary key during an `alterTable` migration. */
  addPrimaryKey(columns: KeyColumns, options?: NamedConstraintOptions): void
  /** Drops a primary key during an `alterTable` migration. */
  dropPrimaryKey(name: string): void
  /** Adds a unique constraint during an `alterTable` migration. */
  addUnique(columns: KeyColumns, options?: NamedConstraintOptions): void
  /** Drops a unique constraint during an `alterTable` migration. */
  dropUnique(name: string): void
  /** Adds a foreign key during an `alterTable` migration. */
  addForeignKey(
    columns: KeyColumns,
    refTable: TableInput,
    refColumns?: KeyColumns,
    options?: ForeignKeyOptions,
  ): void
  /** Drops a foreign key during an `alterTable` migration. */
  dropForeignKey(name: string): void
  /** Adds a check constraint during an `alterTable` migration. */
  addCheck(expression: string, options?: NamedConstraintOptions): void
  /** Drops a check constraint during an `alterTable` migration. */
  dropCheck(name: string): void
  /** Adds an index during an `alterTable` migration. */
  addIndex(columns: IndexColumns, options?: CreateIndexOptions): void
  /** Drops an index during an `alterTable` migration. */
  dropIndex(name: string): void
  /** Sets the table comment during an `alterTable` migration. */
  comment(text: string): void
}

/**
 * DDL-focused operations mixed into the migration `db` object.
 */
export interface MigrationSchema {
  /** Creates a table in the migration schema. */
  createTable<table extends AnyTable>(table: table, options?: CreateTableOptions): Promise<void>
  /** Alters an existing table in the migration schema. */
  alterTable(
    table: TableInput,
    migrate: (table: AlterTableBuilder) => void,
    options?: AlterTableOptions,
  ): Promise<void>
  /** Renames a table in the migration schema. */
  renameTable(from: TableInput, to: string): Promise<void>
  /** Drops a table from the migration schema. */
  dropTable(table: TableInput, options?: DropTableOptions): Promise<void>
  /** Creates an index in the migration schema. */
  createIndex(table: TableInput, columns: IndexColumns, options?: CreateIndexOptions): Promise<void>
  /** Drops an index from the migration schema. */
  dropIndex(table: TableInput, name: string, options?: { ifExists?: boolean }): Promise<void>
  /** Renames an index in the migration schema. */
  renameIndex(table: TableInput, from: string, to: string): Promise<void>
  /** Adds a foreign key in the migration schema. */
  addForeignKey(
    table: TableInput,
    columns: KeyColumns,
    refTable: TableInput,
    refColumns?: KeyColumns,
    options?: ForeignKeyOptions,
  ): Promise<void>
  /** Drops a foreign key in the migration schema. */
  dropForeignKey(table: TableInput, name: string): Promise<void>
  /** Adds a check constraint in the migration schema. */
  addCheck(table: TableInput, expression: string, options?: NamedConstraintOptions): Promise<void>
  /** Drops a check constraint in the migration schema. */
  dropCheck(table: TableInput, name: string): Promise<void>
  /**
   * Adds raw SQL to the migration plan as a migration operation.
   */
  plan(sql: string | SqlStatement): Promise<void>
  /**
   * Returns `true` when the table exists in the current database.
   */
  hasTable(table: TableInput): Promise<boolean>
  /**
   * Returns `true` when the column exists on the given table.
   */
  hasColumn(table: TableInput, column: string): Promise<boolean>
}

/**
 * Runtime-agnostic migration registry abstraction.
 */
export type MigrationRegistry = {
  register(migration: MigrationDescriptor): void
  list(): MigrationDescriptor[]
}

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
