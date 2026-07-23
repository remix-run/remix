import type { Database } from './lib/database.ts'
import type { GetMigrations, Seed } from './lib/migrations.ts'

interface DatabaseCommandOptions {
  /** Database instance exported by the application database module. */
  db: Database
}

/** Structured invocation options accepted by {@link runDataTableCommand}. */
export type RunDataTableCommandOptions =
  | (DatabaseCommandOptions & {
      /** Applies pending migrations. */
      command: 'migrate'
      /** Loads the migrations to apply. */
      getMigrations: GetMigrations
      /** Stops after applying this migration id. */
      to?: string
    })
  | (DatabaseCommandOptions & {
      /** Wipes, migrates, and optionally seeds the database. */
      command: 'reset'
      /** Loads the migrations to apply after wiping the database. */
      getMigrations: GetMigrations
      /** Initializes database data after migrations finish. */
      seed?: Seed
    })
  | (DatabaseCommandOptions & {
      /** Runs the application's seed function. */
      command: 'seed'
      /** Initializes application database data. */
      seed: Seed
    })
  | (DatabaseCommandOptions & {
      /** Reports the status of known migrations. */
      command: 'status'
      /** Loads the migrations to inspect. */
      getMigrations: GetMigrations
    })
  | (DatabaseCommandOptions & {
      /** Destructively recreates the configured database. */
      command: 'wipe'
    })

/**
 * Runs a data-table database command from structured invocation options.
 *
 * @param options Database command and application database values.
 * @returns The exit code the host CLI should use.
 */
export async function runDataTableCommand(options: RunDataTableCommandOptions): Promise<number> {
  if (options.command === 'migrate') {
    let migrateOptions = options.to === undefined ? undefined : { to: options.to }
    await options.db.migrate(await options.getMigrations(), migrateOptions)
    return 0
  }

  if (options.command === 'reset') {
    await options.db.reset({
      migrations: await options.getMigrations(),
      seed: options.seed,
    })
    return 0
  }

  if (options.command === 'seed') {
    await options.seed(options.db)
    return 0
  }

  if (options.command === 'status') {
    let entries = await options.db.migrationStatus(await options.getMigrations())

    for (let entry of entries) {
      console.log(entry.id + ' ' + entry.name + ' ' + entry.status)
    }

    return 0
  }

  await options.db.wipe()
  return 0
}
