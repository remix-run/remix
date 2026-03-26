import * as process from 'node:process'

import type { BootstrapProjectOptions } from '../bootstrap-project.ts'
import { bootstrapProject } from '../bootstrap-project.ts'
import { UsageError } from '../errors.ts'

export async function runNewCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getNewCommandHelpText())
    return 0
  }

  try {
    let result = await bootstrapProject(parseNewCommandArgs(argv))
    process.stdout.write(`Created ${result.appDisplayName} at ${result.targetDir}\n`)
    return 0
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getNewCommandHelpText())
      return 1
    }

    throw error
  }
}

export function getNewCommandHelpText(): string {
  return `Usage:
  remix new <target-dir> [--app-name <name>] [--force]

Create a new Remix project in the target directory.

Examples:
  remix new ./my-remix-app
  remix new ./my-remix-app --app-name "My Remix App"
  remix new ./my-remix-app --force
`
}

function parseNewCommandArgs(argv: string[]): BootstrapProjectOptions {
  let appName: string | null = null
  let force = false
  let targetDir: string | null = null
  let index = 0

  while (index < argv.length) {
    let arg = argv[index]

    if (arg === '--app-name') {
      let next = argv[index + 1]
      if (!next) {
        throw new UsageError('--app-name requires a value.')
      }

      appName = next
      index += 2
      continue
    }

    if (arg === '--force') {
      force = true
      index++
      continue
    }

    if (arg.startsWith('--')) {
      throw new UsageError(`Unknown argument: ${arg}`)
    }

    if (targetDir != null) {
      throw new UsageError(`Unexpected extra argument: ${arg}`)
    }

    targetDir = arg
    index++
  }

  if (targetDir == null) {
    throw new UsageError('A target directory is required.')
  }

  return { appName, force, targetDir }
}
