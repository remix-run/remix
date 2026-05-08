import type { MigrationDescriptor } from './migrations.ts';
/**
 * Loads migration modules from a directory on Node.js.
 *
 * Filenames are used to infer migration `id` and `name`.
 * Each file must default-export `createMigration(...)`.
 * @param directory Absolute or relative directory containing migration files.
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