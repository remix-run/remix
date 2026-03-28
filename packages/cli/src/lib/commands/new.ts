import * as process from 'node:process'

import type {
  BootstrapProjectOptions,
  BootstrapProjectPhase,
  BootstrapProgressReporter,
} from '../bootstrap-project.ts'
import { bootstrapProject } from '../bootstrap-project.ts'
import {
  renderCliError,
  missingOptionValue,
  missingTargetDirectory,
  toCliError,
  unknownArgument,
  unexpectedExtraArgument,
} from '../errors.ts'
import { getDisplayPath } from '../display-path.ts'
import {
  createCommandReporter,
  createStepProgressReporter,
  type CommandReporter,
} from '../reporter.ts'

const NEW_PROGRESS_LABELS = {
  'finalize-package-json': 'Finalize package.json',
  'generate-scaffold-files': 'Generate scaffold files',
  'prepare-target-directory': 'Prepare target directory',
} satisfies Record<BootstrapProjectPhase, string>

export async function runNewCommand(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getNewCommandHelpText())
    return 0
  }

  let reporter = createCommandReporter()
  let progress = createNewProgressReporter(reporter)

  try {
    let options = parseNewCommandArgs(argv)
    await reporter.status.commandHeader('new')
    let result = await bootstrapProject(options, progress)
    progress.writeSummaryGap()
    reporter.out.line(`Created ${result.appDisplayName} at ${getDisplayPath(result.targetDir)}`)
    reporter.finish()
    return 0
  } catch (error) {
    progress.writeSummaryGap()
    process.stderr.write(renderCliError(toCliError(error), { helpText: getNewCommandHelpText() }))
    reporter.finish()
    return 1
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
        throw missingOptionValue('--app-name')
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
      throw unknownArgument(arg)
    }

    if (targetDir != null) {
      throw unexpectedExtraArgument(arg)
    }

    targetDir = arg
    index++
  }

  if (targetDir == null) {
    throw missingTargetDirectory()
  }

  return { appName, force, targetDir }
}

function createNewProgressReporter(reporter: CommandReporter): BootstrapProgressReporter {
  return createStepProgressReporter(reporter.status, NEW_PROGRESS_LABELS)
}
