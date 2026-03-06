import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Migration, MigrationDescriptor } from './migrations.ts'
import { parseMigrationFilename } from './migrations/filename.ts'

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
export async function loadMigrations(directory: string): Promise<MigrationDescriptor[]> {
  let allFiles = (await fs.readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
  let files: Array<{ file: string; id: string; name: string }> = []

  for (let file of allFiles) {
    if (!/\.(?:m?ts|m?js|cts|cjs)$/.test(file)) {
      continue
    }

    let parsed = parseMigrationFilename(file)
    files.push({ file, id: parsed.id, name: parsed.name })
  }

  let migrations: MigrationDescriptor[] = []
  let seenIds = new Set<string>()

  for (let entry of files) {
    if (seenIds.has(entry.id)) {
      throw new Error(
        'Duplicate migration id "' + entry.id + '" inferred from filename "' + entry.file + '"',
      )
    }

    seenIds.add(entry.id)
    let fullPath = path.join(directory, entry.file)
    let source = await fs.readFile(fullPath, 'utf8')
    let checksum = createHash('sha256').update(source).digest('hex')
    let module = (await import(pathToFileURL(fullPath).href)) as { default?: Migration }
    let migration = module.default

    if (!migration || typeof migration.up !== 'function' || typeof migration.down !== 'function') {
      throw new Error(
        'Migration file "' + entry.file + '" must default-export createMigration(...)',
      )
    }

    migrations.push({
      id: entry.id,
      name: entry.name,
      path: fullPath,
      checksum,
      migration,
    })
  }

  return migrations
}
