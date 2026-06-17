import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import type { CliContext } from '../cli-context.ts'
import { CliError, renderCliError, toCliError, unexpectedExtraArgument } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'

const DATABASE_MODULE_PATH = path.join('app', 'data', 'database.ts')

type DatabaseCommandAction = 'create' | 'drop'

export async function runDbCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDbCommandHelpText())
    return 0
  }

  try {
    let action = parseDbCommandArgs(argv)
    let appRoot = await findDatabaseAppRoot(context.cwd)
    let databaseFile = path.join(appRoot, DATABASE_MODULE_PATH)

    await runDatabaseResourceAction(databaseFile, action, appRoot)
    return 0
  } catch (error) {
    process.stderr.write(renderCliError(toCliError(error), { helpText: getDbCommandHelpText(process.stderr) }))
    return 1
  }
}

export function getDbCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Create or drop the configured database for the current app.',
      examples: ['remix db create', 'remix db drop'],
      usage: ['remix db <create|drop> [--no-color]'],
    },
    target,
  )
}

function parseDbCommandArgs(argv: string[]): DatabaseCommandAction {
  let parsed = parseArgs(argv, {}, { maxPositionals: 1 })
  let action = parsed.positionals[0]

  if (action === 'create' || action === 'drop') {
    return action
  }

  if (action == null) {
    throw new CliError({
      code: 'RMX_DB_ACTION_MISSING',
      message: 'Expected a database action: create or drop.',
      showHelp: true,
      title: 'Missing database action',
    })
  }

  throw unexpectedExtraArgument(action)
}

async function runDatabaseResourceAction(
  databaseFile: string,
  action: DatabaseCommandAction,
  cwd: string,
): Promise<void> {
  let workerPath = getDatabaseResourceWorkerPath()
  let child = spawn(process.execPath, [workerPath, databaseFile, action], {
    cwd,
    env: createDatabaseResourceWorkerEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
  })

  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })

  let exitResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => {
        resolve({ code, signal })
      })
    },
  )

  if (exitResult.signal != null) {
    throw new CliError({
      code: 'RMX_DB_RESOURCE_SIGNAL',
      message: `Database resource action exited from signal ${exitResult.signal}.`,
      title: 'Database resource action exited from a signal',
    })
  }

  if (exitResult.code !== 0) {
    let message = stderr.trim()
    if (message.length === 0) {
      message = `Database resource ${action} failed.`
    }

    throw new CliError({
      code: 'RMX_DB_RESOURCE_FAILED',
      message,
      title: 'Database resource action failed',
    })
  }

  if (stdout.length > 0) {
    process.stdout.write(stdout)
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

function getDatabaseResourceWorkerPath(): string {
  let currentFilePath = fileURLToPath(import.meta.url)
  let extension = currentFilePath.endsWith('.ts') ? '.ts' : '.js'

  return fileURLToPath(new URL(`../load-database-resource-worker${extension}`, import.meta.url))
}

function createDatabaseResourceWorkerEnv(): NodeJS.ProcessEnv {
  let env = { ...process.env }

  for (let key of Object.keys(env)) {
    if (key.startsWith('NODE_TEST_')) {
      delete env[key]
    }
  }

  return env
}
