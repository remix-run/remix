import { spawn } from 'node:child_process'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'

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
import { loadRemixConfig, type RemixDbCommandConfig } from '../remix-config.ts'

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
    return await runDatabaseCommandScript(plan, resolved.configDir)
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
        { description: 'Load a seed module (seed and reset only)', label: '--seed <path>' },
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
  let seed = invocation.seed
    ? { module: path.resolve(cwd, invocation.seed), export: 'seed' }
    : config.seed

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
    // command was invoked from (like --migrations and --seed). The worker runs
    // with cwd set to the config directory, which would silently retarget the
    // path.
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
  if (adapter.type === 'mysql') return { ...adapter, uri: { env: environmentName } }
  throw invalidOptionValue('--connection-env cannot override a module database adapter')
}

async function runDatabaseCommandScript(
  plan: DatabaseCommandPlan,
  configDir: string,
): Promise<number> {
  let workerPath = getDatabaseCommandWorkerPath()
  let child = spawn(process.execPath, [workerPath, JSON.stringify(plan)], {
    cwd: configDir,
    env: createDatabaseCommandWorkerEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => process.stdout.write(chunk))
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })

  let result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => resolve({ code, signal }))
    },
  )

  if (result.signal != null)
    throw new Error(`Database command exited from signal ${result.signal}.`)
  if (result.code !== 0) throw new Error(stderr.trim() || 'Database command failed.')
  if (stderr.length > 0) process.stderr.write(stderr)
  return 0
}

function getDatabaseCommandWorkerPath(): string {
  let currentFilePath = fileURLToPath(import.meta.url)
  let extension = currentFilePath.endsWith('.ts') ? '.ts' : '.js'
  return fileURLToPath(new URL(`../run-db-worker${extension}`, import.meta.url))
}

function createDatabaseCommandWorkerEnv(): NodeJS.ProcessEnv {
  let env = { ...process.env }
  for (let key of Object.keys(env)) {
    if (key.startsWith('NODE_TEST_')) delete env[key]
  }
  return env
}
