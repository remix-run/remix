let migrationFilenamePattern = /^(\d{14})_(.+)\.(?:m?ts|m?js|cts|cjs)$/

/**
 * Parses a migration filename into `{ id, name }`.
 *
 * Expected format: `YYYYMMDDHHmmss_name.(ts|js|mts|mjs|cts|cjs)`.
 * @param filename Migration file basename.
 * @returns Parsed migration id and name.
 */
export function parseMigrationFilename(filename: string): { id: string; name: string } {
  let match = filename.match(migrationFilenamePattern)

  if (!match) {
    throw new Error(
      'Invalid migration filename "' +
        filename +
        '". Expected format YYYYMMDDHHmmss_name.ts (or .js/.mts/.mjs/.cts/.cjs)',
    )
  }

  return {
    id: match[1],
    name: match[2],
  }
}
