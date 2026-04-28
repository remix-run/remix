import { getRemixTestHelpText, runRemixTest } from '@remix-run/test/cli'
import * as process from 'node:process'

import type { CliContext } from '../cli-context.ts'
import { renderCliError, toCliError } from '../errors.ts'

export async function runTestCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(`${getTestCommandHelpText()}\n`)
    return 0
  }

  try {
    return await runRemixTest({ argv, cwd: context.cwd })
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getTestCommandHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getTestCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return getRemixTestHelpText(target)
}
