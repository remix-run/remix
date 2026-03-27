import * as process from 'node:process'

import { readRemixVersion } from '../remix-version.ts'
import { renderCliError, toCliError, unknownArgument, unexpectedExtraArgument } from '../errors.ts'

export async function runVersionCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getVersionCommandHelpText())
    return 0
  }

  try {
    if (argv.length > 0) {
      let [arg] = argv

      if (arg.startsWith('-')) {
        throw unknownArgument(arg)
      }

      throw unexpectedExtraArgument(arg)
    }

    process.stdout.write(`${readRemixVersion()}\n`)
    return 0
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getVersionCommandHelpText() }),
    )
    return 1
  }
}

export function getVersionCommandHelpText(): string {
  return `Usage:
  remix version

Show the current Remix version.

Examples:
  remix version
  remix --version
`
}
