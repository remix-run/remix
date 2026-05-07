import type { MigrationDescriptor, MigrationRegistry } from '../migrations.ts';
/**
 * Returns a new array of migrations ordered by migration id.
 * @param migrations Migration descriptors to sort.
 * @returns A newly sorted migration descriptor array.
 */
export declare function sortMigrations(migrations: MigrationDescriptor[]): MigrationDescriptor[];
/**
 * Resolves a migration source into a sorted migration list.
 * @param input Migration list or registry.
 * @returns A sorted migration descriptor list.
 */
export declare function resolveMigrations(input: MigrationDescriptor[] | MigrationRegistry): MigrationDescriptor[];
/**
 * Creates an in-memory migration registry.
 * @param initial Optional initial migration list.
 * @returns A migration registry with duplicate-id protection.
 * @example
 * ```ts
 * import { createMigrationRegistry } from 'remix/data-table/migrations'
 *
 * let registry = createMigrationRegistry()
 * registry.register({ id, name, migration })
 * ```
 */
export declare function createMigrationRegistry(initial?: MigrationDescriptor[]): MigrationRegistry;
//# sourceMappingURL=registry.d.ts.map