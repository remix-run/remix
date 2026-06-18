import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { Migration } from './migrations.ts'

/**
 * Loads SQL-file migrations from a directory on Node.js.
 *
 * Each `.sql` file is one migration. The migration id is the filename without
 * the `.sql` extension.
 * @param directory Absolute or relative directory containing migration files.
 * @returns A sorted list of loaded migrations.
 * @example
 * ```ts
 * import { loadMigrations } from 'remix/data-table/migrations/node'
 *
 * let migrations = await loadMigrations('./app/db/migrations')
 * ```
 */
export async function loadMigrations(directory: string): Promise<Migration[]> {
  let entries = await fs.readdir(directory, { withFileTypes: true })
  let files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  let migrations: Migration[] = []
  let seenIds = new Set<string>()

  for (let fileName of files) {
    let id = fileName.slice(0, -'.sql'.length)

    if (seenIds.has(id)) {
      throw new Error('Duplicate migration id "' + id + '" inferred from file "' + fileName + '"')
    }

    seenIds.add(id)

    migrations.push({
      id,
      sql: await fs.readFile(path.join(directory, fileName), 'utf8'),
    })
  }

  return migrations
}
