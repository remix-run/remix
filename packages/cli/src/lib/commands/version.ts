import * as process from 'node:process'

import { readRemixVersion } from '../remix-version.ts'
import { renderCliError, toCliError } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'

export async function runVersionCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getVersionCommandHelpText())
    return 0
  }

  try {
    parseArgs(argv, {}, { maxPositionals: 0 })

    process.stdout.write(`${readRemixVersion()}\n`)
    return 0
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getVersionCommandHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getVersionCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Show the current Remix version.',
      examples: ['remix version', 'remix --version'],
      usage: ['remix version'],
    },
    target,
  )
}
