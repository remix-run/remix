// Migration ids must fit the journal's varchar(64) primary key.
const migrationDirectoryPattern = /^(\d{1,64})_(.+)$/

/**
 * Parses a migration directory name into `{ id, name }`.
 *
 * Expected format: `<digits>_<name>`, such as `0001_create_users` or `20260101000000_create_users`.
 * The prefix must contain 1 to 64 digits.
 * @param name Migration directory basename.
 * @returns Parsed migration id and name.
 */
export function parseMigrationDirectoryName(name: string): { id: string; name: string } {
  let match = name.match(migrationDirectoryPattern)

  if (!match) {
    throw new Error(
      'Invalid migration directory name "' +
        name +
        '". Expected format <digits>_<name> with 1 to 64 digits',
    )
  }

  return {
    id: match[1],
    name: match[2],
  }
}
