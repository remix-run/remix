import type { MigrationDescriptor, Seed } from './migrations.ts';
/**
 * Loads SQL-file migrations from a directory on Node.js.
 *
 * Each migration is a directory named `YYYYMMDDHHmmss_<slug>` containing:
 * - `up.sql` (required)
 * - `down.sql` (optional; omit for irreversible migrations)
 *
 * `id` and `name` are inferred from the directory name.
 * @param directory Absolute or relative directory containing migration directories.
 * @returns A sorted list of loaded migration descriptors.
 * @example
 * ```ts
 * import { loadMigrations } from 'remix/data-table/migrations/node'
 *
 * let migrations = await loadMigrations('./app/db/migrations')
 * ```
 */
export declare function loadMigrations(directory: string): Promise<MigrationDescriptor[]>;
/**
 * Loads a SQL seed file on Node.js.
 *
 * The file may contain multiple SQL statements. Seeds that must be safe to
 * run against an already-seeded database should use idempotent statements
 * (for example, `insert or ignore` on SQLite).
 *
 * @param filename Absolute or relative path to a SQL seed file.
 * @returns A seed function that executes the file's SQL script.
 * @example
 * ```ts
 * import { loadSeed } from 'remix/data-table/migrations/node'
 *
 * let seed = await loadSeed('./app/data/seed.sql')
 * await db.reset({ migrations, seed })
 * ```
 */
export declare function loadSeed(filename: string): Promise<Seed>;
//# sourceMappingURL=migrations-node.d.ts.map