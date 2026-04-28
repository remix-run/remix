import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { MigrationDescriptor } from './migrations.ts'
import { parseMigrationDirectoryName } from './migrations/directory-name.ts'

/**
 * Loads SQL-file migrations from a directory on Node.js.
 *
 * Each migration is a directory named `YYYYMMDDHHmmss_<slug>` containing:
 * - `up.sql` (required)
 * - `down.sql` (optional; omit for irreversible migrations)
 *
 * `id` and `name` are inferred from the directory name. `checksum` is `sha256(up.sql)`.
 * @param directory Absolute or relative directory containing migration directories.
 * @returns A sorted list of loaded migration descriptors.
 * @example
 * ```ts
 * import { loadMigrations } from 'remix/data-table/migrations/node'
 *
 * let migrations = await loadMigrations('./app/db/migrations')
 * ```
 */
export async function loadMigrations(directory: string): Promise<MigrationDescriptor[]> {
  let entries = await fs.readdir(directory, { withFileTypes: true })
  let directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  let migrations: MigrationDescriptor[] = []
  let seenIds = new Set<string>()

  for (let directoryName of directories) {
    let parsed = parseMigrationDirectoryName(directoryName)

    if (seenIds.has(parsed.id)) {
      throw new Error(
        'Duplicate migration id "' +
          parsed.id +
          '" inferred from directory "' +
          directoryName +
          '"',
      )
    }

    seenIds.add(parsed.id)

    let directoryPath = path.join(directory, directoryName)
    let upPath = path.join(directoryPath, 'up.sql')
    let downPath = path.join(directoryPath, 'down.sql')

    let up: string
    try {
      up = await fs.readFile(upPath, 'utf8')
    } catch (error) {
      if (isNodeFileNotFoundError(error)) {
        throw new Error('Migration directory "' + directoryName + '" is missing up.sql')
      }
      throw error
    }

    let down: string | undefined
    try {
      down = await fs.readFile(downPath, 'utf8')
    } catch (error) {
      if (!isNodeFileNotFoundError(error)) {
        throw error
      }
    }

    migrations.push({
      id: parsed.id,
      name: parsed.name,
      up,
      down,
      path: directoryPath,
      checksum: createHash('sha256').update(up).digest('hex'),
    })
  }

  return migrations
}

function isNodeFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}
