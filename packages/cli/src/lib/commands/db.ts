import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { Database, DatabaseResource } from '@remix-run/data-table'
import { createMigrator } from '@remix-run/data-table/migrations'
import { loadMigrations } from '@remix-run/data-table/migrations/node'

import type { CliContext } from '../cli-context.ts'
import { CliError, renderCliError, toCliError, unexpectedExtraArgument } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'

const DATABASE_MODULE_PATH = path.join('app', 'data', 'database.ts')
const SEED_MODULE_PATH = path.join('db', 'seed.ts')

type DatabaseCommandAction =
  | { kind: 'create' }
  | { kind: 'drop' }
  | { kind: 'migrate'; to?: string }
  | { kind: 'migrate-status' }
  | { kind: 'seed' }
  | { kind: 'reset' }

export async function runDbCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDbCommandHelpText())
    return 0
  }

  try {
    let action = parseDbCommandArgs(argv)
    let appRoot = await findDatabaseAppRoot(context.cwd)
    let databaseFile = path.join(appRoot, DATABASE_MODULE_PATH)
    let database = await loadDatabaseResource(databaseFile)

    await runDatabaseResourceAction(database, action, appRoot)
    return 0
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getDbCommandHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getDbCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description:
        'Create, drop, migrate, seed, or inspect the configured database for the current app.',
      examples: [
        'remix db create',
        'remix db drop',
        'remix db migrate',
        'remix db migrate --to 20260101000000_create_users',
        'remix db migrate status',
        'remix db seed',
        'remix db reset',
      ],
      options: [{ description: 'Apply migrations up to and including an id', label: '--to <id>' }],
      usage: ['remix db <create|drop|migrate|seed|reset> [--to <id>]', 'remix db migrate status'],
    },
    target,
  )
}

function parseDbCommandArgs(argv: string[]): DatabaseCommandAction {
  let parsed = parseArgs(
    argv,
    {
      to: { flag: '--to', type: 'string' },
    },
    { maxPositionals: 2 },
  )
  let [action, subaction] = parsed.positionals

  if (action === 'create') {
    if (parsed.options.to !== undefined) {
      throw unexpectedExtraArgument('--to')
    }
    return { kind: 'create' }
  }

  if (action === 'drop') {
    if (parsed.options.to !== undefined) {
      throw unexpectedExtraArgument('--to')
    }
    return { kind: 'drop' }
  }

  if (action === 'reset') {
    if (parsed.options.to !== undefined) {
      throw unexpectedExtraArgument('--to')
    }

    if (subaction !== undefined) {
      throw unexpectedExtraArgument(subaction)
    }

    return { kind: 'reset' }
  }

  if (action === 'seed') {
    if (parsed.options.to !== undefined) {
      throw unexpectedExtraArgument('--to')
    }

    if (subaction !== undefined) {
      throw unexpectedExtraArgument(subaction)
    }

    return { kind: 'seed' }
  }

  if (action === 'migrate') {
    if (subaction === 'status') {
      if (parsed.options.to !== undefined) {
        throw unexpectedExtraArgument('--to')
      }
      return { kind: 'migrate-status' }
    }

    if (subaction !== undefined) {
      throw unexpectedExtraArgument(subaction)
    }

    return parsed.options.to === undefined
      ? { kind: 'migrate' }
      : { kind: 'migrate', to: parsed.options.to }
  }

  if (action == null) {
    throw new CliError({
      code: 'RMX_DB_ACTION_MISSING',
      message: 'Expected a database action: create, drop, migrate, seed, or reset.',
      showHelp: true,
      title: 'Missing database action',
    })
  }

  throw unexpectedExtraArgument(action)
}

async function loadDatabaseResource(databaseFile: string): Promise<DatabaseResource> {
  let moduleExports: unknown = await import(databaseFile)
  let database = getNamedExport(moduleExports, 'database')
  assertDatabaseResource(database)
  return database
}

async function runDatabaseResourceAction(
  database: DatabaseResource,
  action: DatabaseCommandAction,
  appRoot: string,
): Promise<void> {
  if (action.kind === 'create' || action.kind === 'drop') {
    await database[action.kind]()
    return
  }

  if (action.kind === 'reset') {
    await database.drop()
    await database.create()
    await using client = await database.connect()
    await runMigrations(client, { cwd: appRoot })
    await runSeed(client, { cwd: appRoot })
    return
  }

  await using client = await database.connect()

  if (action.kind === 'seed') {
    await runSeed(client, { cwd: appRoot })
    return
  }

  if (action.kind === 'migrate') {
    await runMigrations(
      client,
      action.to === undefined ? { cwd: appRoot } : { cwd: appRoot, to: action.to },
    )
    return
  }

  await writeMigrationStatus(client, { cwd: appRoot })
}

async function runMigrations(
  client: Database,
  options: {
    cwd: string
    to?: string
  },
): Promise<void> {
  let migrations = await loadMigrations(path.join(options.cwd, 'db', 'migrations'))
  let migrator = createMigrator(migrations)
  let result =
    options.to === undefined
      ? await migrator.migrate(client)
      : await migrator.migrate(client, { to: options.to })

  if (result.applied.length === 0) {
    process.stdout.write('No pending migrations.\n')
  } else {
    for (let migration of result.applied) {
      process.stdout.write('Applied ' + migration.id + '\n')
    }
  }
}

async function writeMigrationStatus(client: Database, options: { cwd: string }): Promise<void> {
  let migrations = await loadMigrations(path.join(options.cwd, 'db', 'migrations'))
  let migrator = createMigrator(migrations)
  let statuses = await migrator.status(client)

  if (statuses.length === 0) {
    process.stdout.write('No migrations.\n')
  } else {
    for (let status of statuses) {
      process.stdout.write(status.id + ' ' + status.status + '\n')
    }
  }
}

async function runSeed(client: Database, options: { cwd: string }): Promise<void> {
  let seed = await loadSeedFunction(path.join(options.cwd, SEED_MODULE_PATH))
  await seed(client)
}

type SeedFunction = (database: Database) => Promise<void>

async function loadSeedFunction(seedFile: string): Promise<SeedFunction> {
  let moduleExports: unknown = await import(seedFile)
  let seed = getNamedExport(moduleExports, 'seed')
  assertSeedFunction(seed)
  return seed
}

function assertSeedFunction(value: unknown): asserts value is SeedFunction {
  if (typeof value !== 'function') {
    throw new Error('Seed module must export a named "seed" function.')
  }
}

async function findDatabaseAppRoot(startDir: string): Promise<string> {
  let currentDir = path.resolve(startDir)

  while (true) {
    if (await pathExists(path.join(currentDir, DATABASE_MODULE_PATH))) {
      return currentDir
    }

    let parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  throw new CliError({
    code: 'RMX_DATABASE_FILE_NOT_FOUND',
    fix: 'Export the app database resource from app/data/database.ts.',
    message: 'Could not find app/data/database.ts. Run this command inside a Remix app.',
    title: 'Could not find app/data/database.ts',
  })
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

function getNamedExport(moduleExports: unknown, name: string): unknown {
  if (typeof moduleExports !== 'object' || moduleExports == null) {
    throw new Error(`Database module must export a named "${name}" value.`)
  }

  return Reflect.get(moduleExports, name)
}

function assertDatabaseResource(value: unknown): asserts value is DatabaseResource {
  if (typeof value !== 'object' || value == null) {
    throw new Error('Database module must export a named "database" resource.')
  }

  let create = Reflect.get(value, 'create')
  let drop = Reflect.get(value, 'drop')
  let connect = Reflect.get(value, 'connect')

  if (typeof create !== 'function' || typeof drop !== 'function' || typeof connect !== 'function') {
    throw new Error('Database resource must provide create(), drop(), and connect() methods.')
  }
}
