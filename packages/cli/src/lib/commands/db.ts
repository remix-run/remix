import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'

import type { Database } from '@remix-run/data-table'
import { runRemixDb } from '@remix-run/data-table/cli'
import { loadMigrations, loadSeed } from '@remix-run/data-table/migrations/node'

import { findAppRoot } from '../app-root.ts'
import type { CliContext } from '../cli-context.ts'
import {
  isDatabaseCommand,
  type DatabaseCommandInvocation,
  type DatabaseCommandPlan,
} from '../database-command.ts'
import {
  dbConfigRequired,
  dbForceRequired,
  invalidOptionValue,
  remixConfigNotFound,
  renderCliError,
  toCliError,
  unknownCommand,
} from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'
import {
  loadRemixConfig,
  type RemixDbAdapterConfig,
  type RemixDbCommandConfig,
  type RemixDbString,
} from '../remix-config.ts'

const connectionOption = { flag: '--connection-env', type: 'string' } as const
const journalOption = { flag: '--journal-table', type: 'string' } as const
const migrationsOption = { flag: '--migrations', type: 'string' } as const
const seedOption = { flag: '--seed', type: 'string' } as const

export async function runDbCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDbCommandHelpText())
    return 0
  }

  try {
    let invocation = parseDbCommandArgs(argv)
    let resolved = await resolveDbConfig(context)
    let plan = resolveDatabaseCommandPlan(invocation, resolved.config, context.cwd)
    return await runDatabaseCommand(plan, resolved.configDir)
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
      description: 'Manage the current app database.',
      examples: [
        'remix db wipe --force',
        'remix db migrate',
        'remix db migrate --to 20260715123000_add_users',
        'remix db status',
        'remix db seed',
        'remix db reset --force',
      ],
      options: [
        {
          description: 'Read the database connection from an environment variable',
          label: '--connection-env <name>',
        },
        { description: 'Confirm a destructive command (wipe and reset only)', label: '--force' },
        {
          description: 'Use a migration journal table (migrate, status, and reset only)',
          label: '--journal-table <name>',
        },
        {
          description: 'Load migrations from a directory (migrate, status, and reset only)',
          label: '--migrations <path>',
        },
        { description: 'Run a SQL seed file (seed and reset only)', label: '--seed <path>' },
        {
          description: 'Stop after applying the specified migration (migrate only)',
          label: '--to <migration>',
        },
      ],
      usage: [
        'remix db wipe --force [options]',
        'remix db migrate [--to <migration>] [options]',
        'remix db status [options]',
        'remix db seed [options]',
        'remix db reset --force [options]',
      ],
    },
    target,
  )
}

function parseDbCommandArgs(argv: string[]): DatabaseCommandInvocation {
  let [command, ...commandArgv] = argv

  if (!isDatabaseCommand(command)) {
    throw unknownCommand(`db ${command}`)
  }

  if (command === 'migrate') {
    let parsed = parseArgs(
      commandArgv,
      {
        connectionEnv: connectionOption,
        journalTable: journalOption,
        migrations: migrationsOption,
        to: { flag: '--to', type: 'string' },
      },
      { maxPositionals: 0 },
    )
    return { command, ...parsed.options }
  }

  if (command === 'reset') {
    let parsed = parseArgs(
      commandArgv,
      {
        connectionEnv: connectionOption,
        force: { flag: '--force', type: 'boolean' },
        journalTable: journalOption,
        migrations: migrationsOption,
        seed: seedOption,
      },
      { maxPositionals: 0 },
    )
    if (!parsed.options.force) throw dbForceRequired(command)
    let { force: _, ...options } = parsed.options
    return { command, ...options }
  }

  if (command === 'wipe') {
    let parsed = parseArgs(
      commandArgv,
      {
        connectionEnv: connectionOption,
        force: { flag: '--force', type: 'boolean' },
      },
      { maxPositionals: 0 },
    )
    if (!parsed.options.force) throw dbForceRequired(command)
    return { command, connectionEnv: parsed.options.connectionEnv }
  }

  if (command === 'seed') {
    let parsed = parseArgs(
      commandArgv,
      { connectionEnv: connectionOption, seed: seedOption },
      { maxPositionals: 0 },
    )
    return { command, ...parsed.options }
  }

  let parsed = parseArgs(
    commandArgv,
    {
      connectionEnv: connectionOption,
      journalTable: journalOption,
      migrations: migrationsOption,
    },
    { maxPositionals: 0 },
  )
  return { command, ...parsed.options }
}

async function resolveDbConfig(
  context: CliContext,
): Promise<{ config: RemixDbCommandConfig; configDir: string }> {
  let configPath: string
  let config

  if (context.configPath !== undefined) {
    configPath = path.resolve(context.cwd, context.configPath)
    config = await context.loadConfig()
  } else {
    let configDir = await findAppRoot(context.cwd, 'remix.json')
    if (configDir === null) throw remixConfigNotFound(path.join(context.cwd, 'remix.json'))
    configPath = path.join(configDir, 'remix.json')
    config = await loadRemixConfig(configDir, undefined)
  }

  if (config.db === undefined) throw dbConfigRequired(configPath)
  return { config: config.db, configDir: path.dirname(configPath) }
}

function resolveDatabaseCommandPlan(
  invocation: DatabaseCommandInvocation,
  config: RemixDbCommandConfig,
  cwd: string,
): DatabaseCommandPlan {
  let adapter = overrideConnection(config.adapter, invocation.connectionEnv, cwd)
  let migrations = invocation.migrations
    ? path.resolve(cwd, invocation.migrations)
    : config.migrations?.directory
  let journalTable = invocation.journalTable ?? config.migrations?.journalTable
  let seed = invocation.seed ? path.resolve(cwd, invocation.seed) : config.seed

  if (
    (invocation.command === 'migrate' ||
      invocation.command === 'reset' ||
      invocation.command === 'status') &&
    migrations === undefined
  ) {
    throw invalidOptionValue(
      `Database command "${invocation.command}" requires db.migrations.directory or --migrations`,
    )
  }

  if (invocation.command === 'seed' && seed === undefined) {
    throw invalidOptionValue('Database command "seed" requires db.seed or --seed')
  }

  return {
    adapter,
    command: invocation.command,
    journalTable,
    migrations,
    seed,
    to: invocation.to,
  }
}

function overrideConnection(
  adapter: RemixDbCommandConfig['adapter'],
  environmentName: string | undefined,
  cwd: string,
): RemixDbCommandConfig['adapter'] {
  if (environmentName === undefined) return adapter
  if (adapter.type === 'sqlite') {
    // Resolve a relative sqlite filename here, against the directory the
    // command was invoked from (like --migrations and --seed). Filenames from
    // remix.json resolve against the config directory instead, which would
    // silently retarget the path.
    let filename = process.env[environmentName]
    if (filename === undefined || filename === '') {
      throw invalidOptionValue(`Database environment variable ${environmentName} is not set`)
    }
    return {
      ...adapter,
      filename: filename === ':memory:' ? filename : path.resolve(cwd, filename),
    }
  }
  if (adapter.type === 'postgres') {
    return { ...adapter, connectionString: { env: environmentName } }
  }
  return { ...adapter, uri: { env: environmentName } }
}

async function runDatabaseCommand(plan: DatabaseCommandPlan, configDir: string): Promise<number> {
  let db = await createConfiguredDatabase(plan.adapter, configDir)
  let result: number

  try {
    result = await executeDatabaseCommand(plan, db)
  } catch (error) {
    try {
      await db.close()
    } catch (closeError) {
      throw new AggregateError([error, closeError], 'Database command and close both failed', {
        cause: error,
      })
    }
    throw error
  }

  await db.close()
  return result
}

async function executeDatabaseCommand(plan: DatabaseCommandPlan, db: Database): Promise<number> {
  if (plan.command === 'wipe') {
    return runRemixDb({ command: plan.command, db })
  }

  if (plan.command === 'seed') {
    if (plan.seed === undefined) {
      throw invalidOptionValue('Database command "seed" requires db.seed or --seed')
    }
    return runRemixDb({ command: plan.command, db, seed: await loadSeed(plan.seed) })
  }

  if (plan.migrations === undefined) {
    throw invalidOptionValue(
      `Database command "${plan.command}" requires db.migrations.directory or --migrations`,
    )
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

async function createConfiguredDatabase(
  adapter: RemixDbAdapterConfig,
  configDir: string,
): Promise<Database> {
  // Adapter packages are imported lazily because their database drivers are
  // optional peer dependencies; only the configured adapter's driver needs to
  // be installed.
  if (adapter.type === 'sqlite') {
    let { createSqliteDatabase } = await import('@remix-run/data-table-sqlite')
    let filename = resolveDbString(adapter.filename)
    if (filename !== ':memory:') {
      // Filenames from remix.json are config-relative; explicit flag overrides
      // arrive here already resolved against the invocation directory.
      filename = path.resolve(configDir, filename)
      await fs.mkdir(path.dirname(filename), { recursive: true })
    }
    return createSqliteDatabase({
      filename,
      foreignKeys: adapter.foreignKeys,
      busyTimeout: adapter.busyTimeout,
    })
  }

  if (adapter.type === 'postgres') {
    let { createPostgresDatabase } = await import('@remix-run/data-table-postgres')
    return createPostgresDatabase(
      { connectionString: resolveDbString(adapter.connectionString) },
      {
        maintenanceDatabase: adapter.maintenanceDatabase,
        template: adapter.template,
      },
    )
  }

  let { createMysqlDatabase } = await import('@remix-run/data-table-mysql')
  return createMysqlDatabase(
    { uri: resolveDbString(adapter.uri), multipleStatements: true },
    { characterSet: adapter.characterSet, collation: adapter.collation },
  )
}

function resolveDbString(value: RemixDbString): string {
  if (typeof value === 'string') return value
  // An env var that is set but empty is treated as unset so it falls back to
  // the configured default instead of producing an empty connection value.
  let resolved = process.env[value.env] || value.default
  if (resolved === undefined || resolved === '') {
    throw invalidOptionValue(`Database environment variable ${value.env} is not set`)
  }
  return resolved
}
