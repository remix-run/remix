import type { MigrationDescriptor, MigrationRegistry } from '../migrations.ts'

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
export function createMigrationRegistry(initial: MigrationDescriptor[] = []): MigrationRegistry {
  let migrations = new Map<string, MigrationDescriptor>()

  for (let migration of initial) {
    if (migrations.has(migration.id)) {
      throw new Error('Duplicate migration id: ' + migration.id)
    }

    migrations.set(migration.id, migration)
  }

  return {
    register(migration: MigrationDescriptor) {
      if (migrations.has(migration.id)) {
        throw new Error('Duplicate migration id: ' + migration.id)
      }

      migrations.set(migration.id, migration)
    },
    list() {
      return Array.from(migrations.values()).sort((left, right) => left.id.localeCompare(right.id))
    },
  }
}
