import * as process from 'node:process'

import type { CliContext } from '../cli-context.ts'
import { renderCliError, toCliError } from '../errors.ts'

export async function runTestCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(`${await getTestCommandHelpText()}\n`)
    return 0
  }

  try {
    let { runRemixTest } = await import('@remix-run/test/cli')
    return await runRemixTest({ argv, cwd: context.cwd })
  } catch (error) {
    let helpText = await getTestCommandHelpText(process.stderr)
    process.stderr.write(
      renderCliError(toCliError(error), {
        helpText,
      }),
    )
    return 1
  }
}

export async function getTestCommandHelpText(
  target: NodeJS.WriteStream = process.stdout,
): Promise<string> {
  let { getRemixTestHelpText } = await import('@remix-run/test/cli')
  return getRemixTestHelpText(target)
}
