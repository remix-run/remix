import type { Database } from './database.ts';
/**
 * Controls how each migration is wrapped in transactions.
 *
 * - `auto` (default): wrap when the database supports transactional DDL.
 * - `required`: wrap; throws when the database does not support transactional DDL.
 * - `none`: never wrap.
 */
export type MigrationTransactionMode = 'auto' | 'required' | 'none';
/**
 * Migration metadata and SQL consumed by `Database.migrate()`.
 */
export type MigrationDescriptor = {
    /** Migration id (typically a `YYYYMMDDHHmmss` timestamp). */
    id: string;
    /** Human-readable migration slug. */
    name: string;
    /** SQL executed when applying the migration. May contain multiple statements. */
    up: string;
    /**
     * SQL executed when reverting the migration. May contain multiple statements.
     * Omit (or pass `undefined`) for irreversible migrations.
     */
    down?: string;
    /** Transaction wrapping mode. Defaults to `auto`. */
    transaction?: MigrationTransactionMode;
    /** Optional source path used in error messages. */
    path?: string;
};
/**
 * Direction used by `Database.migrate()`.
 */
export type MigrationDirection = 'up' | 'down';
/**
 * Row shape persisted in the migration journal table.
 */
export type MigrationJournalRow = {
    id: string;
    name: string;
    checksum: string;
    batch: number;
    appliedAt: Date;
};
/**
 * Effective migration status.
 *
 * - `applied`: the current migration matches its journal entry.
 * - `pending`: the current migration has not been applied.
 * - `drifted`: the current migration differs from its journal entry.
 * - `missing`: an applied journal entry has no migration in the current set.
 */
export type MigrationStatus = 'applied' | 'pending' | 'drifted' | 'missing';
/**
 * Status entry returned by database migration operations.
 */
export type MigrationStatusEntry = {
    id: string;
    name: string;
    status: MigrationStatus;
    appliedAt?: Date;
    batch?: number;
    checksum?: string;
};
/**
 * Bounds and dry-run options for a migration operation.
 * `to` and `step` are mutually exclusive.
 *
 * `to` accepts a bare migration id (`20260301113000`) or the full `id_name`
 * directory form (`20260301113000_add_user_status`).
 */
export type MigrationOperationOptions = {
    to: string;
    step?: never;
    dryRun?: boolean;
} | {
    to?: never;
    step: number;
    dryRun?: boolean;
} | {
    to?: undefined;
    step?: undefined;
    dryRun?: boolean;
};
/**
 * Result returned by `Database.migrate()`.
 */
export type MigrateResult = {
    applied: MigrationStatusEntry[];
    reverted: MigrationStatusEntry[];
    /**
     * SQL scripts that were (or, for `dryRun`, would have been) executed.
     */
    sql: string[];
};
/**
 * Runtime-agnostic migration registry abstraction.
 */
export type MigrationRegistry = {
    register(migration: MigrationDescriptor): void;
    list(): MigrationDescriptor[];
};
/**
 * Migration collection accepted by `db.migrate(...)` and `db.migrationStatus(...)`.
 */
export type Migrations = MigrationDescriptor[] | MigrationRegistry;
/**
 * Function that initializes application data in a database.
 */
export type Seed = (db: Database) => void | Promise<void>;
/**
 * Options for applying or reverting migrations through `Database.migrate()`.
 */
export type DatabaseMigrateOptions = MigrationOperationOptions & {
    /** Migration direction. Defaults to `up`. */
    direction?: MigrationDirection;
    /**
     * Journal table used to record applied migrations.
     * Defaults to `data_table_migrations`.
     */
    journalTable?: string;
};
/**
 * Options for reading migration status through `Database.migrationStatus()`.
 */
export interface DatabaseMigrationStatusOptions {
    /**
     * Journal table used to record applied migrations.
     * Defaults to `data_table_migrations`.
     */
    journalTable?: string;
}
/**
 * Options for rebuilding a database through `Database.reset()`.
 */
export interface DatabaseResetOptions {
    /** Migrations to apply after wiping the database. */
    migrations: Migrations;
    /** Function that initializes application data after migrations finish. */
    seed?: Seed;
    /**
     * Journal table used to record applied migrations.
     * Defaults to `data_table_migrations`.
     */
    journalTable?: string;
}
//# sourceMappingURL=migrations.d.ts.map