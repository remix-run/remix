import type { Database } from './lib/database.ts'
import type { Migrations, Seed } from './lib/migrations.ts'

interface DatabaseCommandOptions {
  /** Database instance used by the command. */
  db: Database
}

/** Structured invocation options accepted by {@link runRemixDb}. */
export type RunRemixDbOptions =
  | (DatabaseCommandOptions & {
      /** Applies pending migrations. */
      command: 'migrate'
      /** Migrations to apply. */
      migrations: Migrations
      /**
       * Stops after applying this migration. Accepts a bare migration id or
       * the full `id_name` directory form.
       */
      to?: string
      /** Migration journal table. */
      journalTable?: string
    })
  | (DatabaseCommandOptions & {
      /** Wipes, migrates, and optionally seeds the database. */
      command: 'reset'
      /** Migrations to apply after wiping the database. */
      migrations: Migrations
      /** Initializes database data after migrations finish. */
      seed?: Seed
      /** Migration journal table. */
      journalTable?: string
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
      /** Migrations to inspect. */
      migrations: Migrations
      /** Migration journal table. */
      journalTable?: string
    })
  | (DatabaseCommandOptions & {
      /** Destructively recreates the configured database. */
      command: 'wipe'
    })

/**
 * Runs a data-table database command from structured invocation options.
 *
 * @param options Database command and application database values.
 * @returns The exit code the host CLI should use. Always resolves `0`;
 * command failures throw.
 */
export async function runRemixDb(options: RunRemixDbOptions): Promise<number> {
  if (options.command === 'migrate') {
    let migrateOptions =
      options.to === undefined
        ? { journalTable: options.journalTable }
        : { to: options.to, journalTable: options.journalTable }
    let result = await options.db.migrate(options.migrations, migrateOptions)

    if (result.applied.length === 0) {
      console.log('no pending migrations')
    }

    for (let entry of result.applied) {
      console.log('applied ' + entry.id + '_' + entry.name)
    }

    return 0
  }

  if (options.command === 'reset') {
    await options.db.reset({
      migrations: options.migrations,
      seed: options.seed,
      journalTable: options.journalTable,
    })

    console.log('database reset')

    return 0
  }

  if (options.command === 'seed') {
    await options.seed(options.db)
    return 0
  }

  if (options.command === 'status') {
    let entries = await options.db.migrationStatus(options.migrations, {
      journalTable: options.journalTable,
    })

    for (let entry of entries) {
      console.log(entry.id + ' ' + entry.name + ' ' + entry.status)
    }

    return 0
  }

  if (options.command === 'wipe') {
    await options.db.wipe()
    return 0
  }

  // Guard against unchecked command strings from plain-JS callers so an
  // unknown command can never fall through to a destructive operation.
  let command = (options as { command: string }).command
  throw new Error('Unknown database command: ' + command)
}
