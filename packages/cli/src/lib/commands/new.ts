import * as process from 'node:process'

import type {
  BootstrapProjectOptions,
  BootstrapProjectPhase,
  BootstrapProgressReporter,
} from '../bootstrap-project.ts'
import { bootstrapProject } from '../bootstrap-project.ts'
import { renderCliError, missingTargetDirectory, toCliError } from '../errors.ts'
import { getDisplayPath } from '../display-path.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'
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

  let reporter: CommandReporter | null = null
  let progress: BootstrapProgressReporter | null = null

  try {
    let options = parseNewCommandArgs(argv)
    reporter = createCommandReporter()
    progress = createNewProgressReporter(reporter)

    await reporter.status.commandHeader('new')
    let result = await bootstrapProject(options, progress)
    progress.writeSummaryGap()
    reporter.out.line(`Created ${result.appDisplayName} at ${getDisplayPath(result.targetDir)}`)
    reporter.finish()
    return 0
  } catch (error) {
    progress?.writeSummaryGap()
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getNewCommandHelpText(process.stderr) }),
    )
    reporter?.finish()
    return 1
  }
}

export function getNewCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Create a new Remix project in the target directory.',
      examples: [
        'remix new ./my-remix-app',
        'remix new ./my-remix-app --app-name "My Remix App"',
        'remix new ./my-remix-app --force',
      ],
      usage: ['remix new <target-dir> [--app-name <name>] [--force]'],
    },
    target,
  )
}

function parseNewCommandArgs(argv: string[]): BootstrapProjectOptions {
  let parsed = parseArgs(
    argv,
    {
      appName: { flag: '--app-name', type: 'string' },
      force: { flag: '--force', type: 'boolean' },
    },
    { maxPositionals: 1 },
  )
  let targetDir = parsed.positionals[0] ?? null

  if (targetDir == null) {
    throw missingTargetDirectory()
  }

  return {
    appName: parsed.options.appName ?? null,
    force: parsed.options.force,
    targetDir,
  }
}

function createNewProgressReporter(reporter: CommandReporter): BootstrapProgressReporter {
  return createStepProgressReporter(reporter.status, NEW_PROGRESS_LABELS)
}
