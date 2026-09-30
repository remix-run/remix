const migrationDirectoryPattern = /^(\d+)_(.+)$/

/**
 * Parses a migration directory name into `{ id, name }`.
 *
 * Expected format: `<digits>_<name>`, such as `0001_create_users` or `20260101000000_create_users`.
 * @param name Migration directory basename.
 * @returns Parsed migration id and name.
 */
export function parseMigrationDirectoryName(name: string): { id: string; name: string } {
  let match = name.match(migrationDirectoryPattern)

  if (!match) {
    throw new Error(
      'Invalid migration directory name "' + name + '". Expected format <digits>_<name>',
    )
  }

  return {
    id: match[1],
    name: match[2],
  }
}
