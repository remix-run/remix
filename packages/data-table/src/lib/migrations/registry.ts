import type { MigrationDescriptor, MigrationRegistry } from '../migrations.ts'

/**
 * Returns a new array of migrations ordered by migration id.
 * @param migrations Migration descriptors to sort.
 * @returns A newly sorted migration descriptor array.
 */
export function sortMigrations(migrations: MigrationDescriptor[]): MigrationDescriptor[] {
  return [...migrations].sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Resolves a migration source into a sorted migration list.
 * @param input Migration list or registry.
 * @returns A sorted migration descriptor list.
 */
export function resolveMigrations(
  input: MigrationDescriptor[] | MigrationRegistry,
): MigrationDescriptor[] {
  if (Array.isArray(input)) {
    return sortMigrations(input)
  }

  return input.list()
}

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
      return sortMigrations(Array.from(migrations.values()))
    },
  }
}
