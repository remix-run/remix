import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'

import { createDatabase, type Database, type Seed } from '@remix-run/data-table'
import { runRemixDb } from '@remix-run/data-table/cli'
import { loadMigrations } from '@remix-run/data-table/migrations/node'
import { createMysqlDatabaseAdapter } from '@remix-run/data-table-mysql'
import { createPostgresDatabaseAdapter } from '@remix-run/data-table-postgres'
import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'
import { loadModule } from '@remix-run/node-tsx/load-module'

import { isDatabaseCommand, type DatabaseCommandPlan } from './database-command.ts'
import type { RemixDbAdapterConfig, RemixDbString } from './remix-config.ts'

class ExpectedWorkerError extends Error {}

void run().then(exit, fail)

async function run(): Promise<number> {
  let plan = parsePlan(process.argv[2])
  let db = await createConfiguredDatabase(plan.adapter)

  if (plan.command === 'wipe') {
    return runRemixDb({ command: plan.command, db })
  }

  if (plan.command === 'seed') {
    return runRemixDb({ command: plan.command, db, seed: await loadSeed(plan.seed) })
  }

  if (plan.migrations === undefined) {
    throw new ExpectedWorkerError(`Missing migrations for database command "${plan.command}"`)
  }

  let migrations = await loadMigrations(plan.migrations)

  if (plan.command === 'migrate') {
    return runRemixDb({
      command: plan.command,
      db,
      migrations,
      to: plan.to,
      journalTable: plan.journalTable,
    })
  }

  if (plan.command === 'reset') {
    let seed = plan.seed === undefined ? undefined : await loadSeed(plan.seed)
    return runRemixDb({
      command: plan.command,
      db,
      migrations,
      seed,
      journalTable: plan.journalTable,
    })
  }

  return runRemixDb({
    command: plan.command,
    db,
    migrations,
    journalTable: plan.journalTable,
  })
}

async function createConfiguredDatabase(adapter: RemixDbAdapterConfig): Promise<Database> {
  if (adapter.type === 'sqlite') {
    let filename = resolveDbString(adapter.filename)
    if (filename !== ':memory:') {
      filename = path.resolve(filename)
      await fs.mkdir(path.dirname(filename), { recursive: true })
    }
    return createDatabase(
      createSqliteDatabaseAdapter({
        filename,
        foreignKeys: adapter.foreignKeys,
        busyTimeout: adapter.busyTimeout,
      }),
    )
  }

  if (adapter.type === 'postgres') {
    return createDatabase(
      createPostgresDatabaseAdapter(
        { connectionString: resolveDbString(adapter.connectionString) },
        {
          maintenanceDatabase: adapter.maintenanceDatabase,
          template: adapter.template,
        },
      ),
    )
  }

  if (adapter.type === 'mysql') {
    return createDatabase(
      createMysqlDatabaseAdapter(
        { uri: resolveDbString(adapter.uri), multipleStatements: true },
        { characterSet: adapter.characterSet, collation: adapter.collation },
      ),
    )
  }

  let module = await loadModule(adapter.module, import.meta.url)
  let factory = readModuleExport(module, adapter.export, adapter.module)
  if (typeof factory !== 'function') {
    throw new ExpectedWorkerError(
      `Database module ${adapter.module} must export a ${adapter.export} function`,
    )
  }
  let value: unknown = await factory()
  if (!isDatabase(value)) {
    throw new ExpectedWorkerError(
      `Database factory ${adapter.export} from ${adapter.module} must return a Database`,
    )
  }
  return value
}

function isDatabase(value: unknown): value is Database {
  return (
    typeof value === 'object' &&
    value !== null &&
    'migrate' in value &&
    typeof value.migrate === 'function' &&
    'migrationStatus' in value &&
    typeof value.migrationStatus === 'function' &&
    'reset' in value &&
    typeof value.reset === 'function' &&
    'wipe' in value &&
    typeof value.wipe === 'function'
  )
}

async function loadSeed(configured: DatabaseCommandPlan['seed'] | undefined): Promise<Seed> {
  if (configured === undefined) throw new ExpectedWorkerError('Missing database seed configuration')
  let module = await loadModule(configured.module, import.meta.url)
  let seed = readModuleExport(module, configured.export, configured.module)
  if (!isSeed(seed)) {
    throw new ExpectedWorkerError(
      `Seed module ${configured.module} must export a ${configured.export} function`,
    )
  }
  return seed
}

function isSeed(value: unknown): value is Seed {
  return typeof value === 'function'
}

function readModuleExport(module: unknown, exportName: string, modulePath: string): unknown {
  if (typeof module !== 'object' || module === null) {
    throw new ExpectedWorkerError(`Configured module ${modulePath} did not load as a module`)
  }
  return exportName in module ? Reflect.get(module, exportName) : undefined
}

function resolveDbString(value: RemixDbString): string {
  if (typeof value === 'string') return value
  let resolved = process.env[value.env] ?? value.default
  if (resolved === undefined) {
    throw new ExpectedWorkerError(`Database environment variable ${value.env} is not set`)
  }
  return resolved
}

function parsePlan(value: string | undefined): DatabaseCommandPlan {
  if (value === undefined) throw new Error('Missing database command plan.')
  let parsed: unknown = JSON.parse(value)
  if (!isDatabaseCommandPlan(parsed)) throw new Error('Invalid database command plan.')
  return parsed
}

function isDatabaseCommandPlan(value: unknown): value is DatabaseCommandPlan {
  if (typeof value !== 'object' || value === null) return false
  if (!('command' in value) || !isDatabaseCommand(value.command)) return false
  if (!('adapter' in value) || !isAdapterConfig(value.adapter)) return false
  if ('journalTable' in value && !isOptionalString(value.journalTable)) return false
  if ('migrations' in value && !isOptionalString(value.migrations)) return false
  if ('to' in value && !isOptionalString(value.to)) return false
  if ('seed' in value && !isOptionalModuleExport(value.seed)) return false
  return true
}

function isAdapterConfig(value: unknown): value is RemixDbAdapterConfig {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false

  if (value.type === 'sqlite') {
    return (
      'filename' in value &&
      isDbString(value.filename) &&
      (!('foreignKeys' in value) ||
        value.foreignKeys === undefined ||
        typeof value.foreignKeys === 'boolean') &&
      (!('busyTimeout' in value) ||
        value.busyTimeout === undefined ||
        typeof value.busyTimeout === 'number')
    )
  }

  if (value.type === 'postgres') {
    return (
      'connectionString' in value &&
      isDbString(value.connectionString) &&
      (!('maintenanceDatabase' in value) || isOptionalString(value.maintenanceDatabase)) &&
      (!('template' in value) || isOptionalString(value.template))
    )
  }

  if (value.type === 'mysql') {
    return (
      'uri' in value &&
      isDbString(value.uri) &&
      (!('characterSet' in value) || isOptionalString(value.characterSet)) &&
      (!('collation' in value) || isOptionalString(value.collation))
    )
  }

  return (
    value.type === 'module' &&
    'module' in value &&
    typeof value.module === 'string' &&
    'export' in value &&
    typeof value.export === 'string'
  )
}

function isDbString(value: unknown): value is RemixDbString {
  return (
    typeof value === 'string' ||
    (typeof value === 'object' &&
      value !== null &&
      'env' in value &&
      typeof value.env === 'string' &&
      (!('default' in value) || isOptionalString(value.default)))
  )
}

function isOptionalModuleExport(value: unknown): value is DatabaseCommandPlan['seed'] {
  return (
    value === undefined ||
    (typeof value === 'object' &&
      value !== null &&
      'module' in value &&
      typeof value.module === 'string' &&
      'export' in value &&
      typeof value.export === 'string')
  )
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function exit(code: number): void {
  exitAfterFlushing(code)
}

function fail(error: unknown): void {
  process.stderr.write(`${getFailureOutput(error)}\n`)
  exitAfterFlushing(1)
}

function getFailureOutput(error: unknown): string {
  if (error instanceof ExpectedWorkerError) return error.message
  if (error instanceof Error) return error.stack ?? error.message
  return String(error)
}

function exitAfterFlushing(code: number): void {
  let pendingStreams = 2
  function onFlushed(): void {
    pendingStreams -= 1
    if (pendingStreams === 0) process.exit(code)
  }
  process.stdout.write('', onFlushed)
  process.stderr.write('', onFlushed)
}
