import type { MigrationDescriptor } from './migrations.ts';
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
//# sourceMappingURL=migrations-node.d.ts.map