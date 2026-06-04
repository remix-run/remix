import * as process from 'node:process'

import type { CliContext } from '../cli-context.ts'
import { renderCliError, toCliError } from '../errors.ts'

const commandName = 'remix node-hmr'

export async function runNodeHmrCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(`${await getNodeHmrCommandHelpText()}\n`)
    return 0
  }

  try {
    let { runNodeHmr } = await import('@remix-run/node-hmr/cli')
    return await runNodeHmr({ argv, commandName, cwd: context.cwd })
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), {
        helpText: await getNodeHmrCommandHelpText(process.stderr),
      }),
    )
    return 1
  }
}

export async function getNodeHmrCommandHelpText(
  target: NodeJS.WriteStream = process.stdout,
): Promise<string> {
  let { getNodeHmrHelpText } = await import('@remix-run/node-hmr/cli')
  let helpText = getNodeHmrHelpText(commandName)

  if (target === process.stderr) {
    return helpText
  }

  return helpText
}
