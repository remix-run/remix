import { spawn } from 'node:child_process'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'

import type { CliContext } from '../cli-context.ts'
import { renderCliError, toCliError, unknownCommand } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'

type DatabaseCommand = 'migrate' | 'reset' | 'seed' | 'status' | 'wipe'

interface DatabaseCommandInvocation {
  command: DatabaseCommand
  to?: string
}

export async function runDbCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDbCommandHelpText())
    return 0
  }

  try {
    let invocation = parseDbCommandArgs(argv)
    return await runDatabaseCommandScript(invocation, context.cwd)
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
        'remix db wipe',
        'remix db migrate',
        'remix db migrate --to 20260715123000_add_users',
        'remix db status',
        'remix db seed',
        'remix db reset',
      ],
      options: [
        { description: 'Stop after applying the specified migration', label: '--to <migration>' },
      ],
      usage: [
        'remix db wipe',
        'remix db migrate [--to <migration>]',
        'remix db status',
        'remix db seed',
        'remix db reset',
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
        to: { flag: '--to', type: 'string' },
      },
      { maxPositionals: 0 },
    )

    return { command, to: parsed.options.to }
  }

  parseArgs(commandArgv, {}, { maxPositionals: 0 })
  return { command }
}

function isDatabaseCommand(value: string | undefined): value is DatabaseCommand {
  return (
    value === 'migrate' ||
    value === 'reset' ||
    value === 'seed' ||
    value === 'status' ||
    value === 'wipe'
  )
}

async function runDatabaseCommandScript(
  invocation: DatabaseCommandInvocation,
  cwd: string,
): Promise<number> {
  let workerPath = getDatabaseCommandWorkerPath()
  let child = spawn(process.execPath, [workerPath, JSON.stringify(invocation)], {
    cwd,
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

  if (result.signal != null) {
    throw new Error(`Database command exited from signal ${result.signal}.`)
  }

  if (result.code !== 0) {
    throw new Error(stderr.trim() || 'Database command failed.')
  }

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
    if (key.startsWith('NODE_TEST_')) {
      delete env[key]
    }
  }

  return env
}
