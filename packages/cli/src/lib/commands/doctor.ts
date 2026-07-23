import * as process from 'node:process'

import type { CliContext } from '../cli-context.ts'
import { runRemixDoctor, type RunRemixDoctorOptions } from '../doctor/run.ts'
import { renderCliError, toCliError } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'

type DoctorCommandOptions = Pick<RunRemixDoctorOptions, 'fix' | 'json' | 'strict'>

export async function runDoctorCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDoctorCommandHelpText())
    return 0
  }

  try {
    let options = parseDoctorCommandArgs(argv)
    return await runRemixDoctor({
      ...options,
      cwd: context.cwd,
      remixVersion: context.remixVersion,
    })
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getDoctorCommandHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getDoctorCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Check project environment and Remix app conventions for the current project.',
      examples: [
        'remix doctor',
        'remix doctor --json',
        'remix doctor --strict',
        'remix doctor --fix',
      ],
      options: [
        { description: 'Print doctor findings as JSON', label: '--json' },
        {
          description: 'Exit with status 1 when warning-level findings are present',
          label: '--strict',
        },
        { description: 'Apply low-risk project and action fixes', label: '--fix' },
      ],
      usage: ['remix doctor [--json] [--strict] [--fix] [--no-color]'],
    },
    target,
  )
}

function parseDoctorCommandArgs(argv: string[]): DoctorCommandOptions {
  let parsed = parseArgs(
    argv,
    {
      fix: { flag: '--fix', type: 'boolean' },
      json: { flag: '--json', type: 'boolean' },
      strict: { flag: '--strict', type: 'boolean' },
    },
    { maxPositionals: 0 },
  )

  return {
    fix: parsed.options.fix,
    json: parsed.options.json,
    strict: parsed.options.strict,
  }
}
