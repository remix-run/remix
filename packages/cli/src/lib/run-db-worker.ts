import * as path from 'node:path'
import * as process from 'node:process'

import type { Database, GetMigrations, Seed } from '@remix-run/data-table'
import { runDataTableCommand } from '@remix-run/data-table/cli'
import { loadModule } from '@remix-run/node-tsx/load-module'

type DatabaseCommand = 'migrate' | 'reset' | 'seed' | 'status' | 'wipe'

interface DatabaseCommandInvocation {
  command: DatabaseCommand
  to?: string
}

interface DatabaseModule {
  db?: Database
  getMigrations?: GetMigrations
  seed?: Seed
}

void run().then(exit, fail)

async function run(): Promise<number> {
  let invocation = parseInvocation(process.argv[2])
  let databaseModule = await loadDatabaseModule()
  let db = databaseModule.db

  if (db === undefined) {
    throw new Error('app/db.ts must export db')
  }

  if (invocation.command === 'wipe') {
    return runDataTableCommand({ command: invocation.command, db })
  }

  if (invocation.command === 'seed') {
    let seed = databaseModule.seed
    if (seed === undefined) {
      throw new Error('app/db.ts must export a seed function to run db seed')
    }

    return runDataTableCommand({ command: invocation.command, db, seed })
  }

  let getMigrations = databaseModule.getMigrations
  if (getMigrations === undefined) {
    throw new Error(`app/db.ts must export getMigrations to run db ${invocation.command}`)
  }

  if (invocation.command === 'migrate') {
    return runDataTableCommand({
      command: invocation.command,
      db,
      getMigrations,
      to: invocation.to,
    })
  }

  if (invocation.command === 'reset') {
    return runDataTableCommand({
      command: invocation.command,
      db,
      getMigrations,
      seed: databaseModule.seed,
    })
  }

  return runDataTableCommand({ command: invocation.command, db, getMigrations })
}

async function loadDatabaseModule(): Promise<DatabaseModule> {
  let databaseModulePath = path.resolve('app/db.ts')
  let value: unknown = await loadModule(databaseModulePath, import.meta.url)

  if (typeof value !== 'object' || value === null) {
    throw new Error('app/db.ts must export a database module')
  }

  return value
}

function parseInvocation(value: string | undefined): DatabaseCommandInvocation {
  if (value === undefined) {
    throw new Error('Missing database command invocation.')
  }

  let parsed: unknown = JSON.parse(value)

  if (typeof parsed !== 'object' || parsed === null || !('command' in parsed)) {
    throw new Error('Invalid database command invocation.')
  }

  let command = parsed.command
  if (!isDatabaseCommand(command)) {
    throw new Error('Invalid database command invocation.')
  }

  let to = 'to' in parsed ? parsed.to : undefined
  if (to !== undefined && typeof to !== 'string') {
    throw new Error('Invalid database migration target.')
  }

  return { command, to }
}

function isDatabaseCommand(value: unknown): value is DatabaseCommand {
  return (
    value === 'migrate' ||
    value === 'reset' ||
    value === 'seed' ||
    value === 'status' ||
    value === 'wipe'
  )
}

function exit(code: number): void {
  process.stdout.write('', () => process.exit(code))
}

function fail(error: unknown): void {
  let message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`, () => process.exit(1))
}
