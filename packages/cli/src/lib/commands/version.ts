import * as fs from 'node:fs/promises'
import * as process from 'node:process'

import {
  cliVersionUnavailable,
  renderCliError,
  toCliError,
  unknownArgument,
  unexpectedExtraArgument,
} from '../errors.ts'

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

    process.stdout.write(`${await readCliVersion()}\n`)
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

Show the current Remix CLI version.

Examples:
  remix version
  remix --version
`
}

async function readCliVersion(): Promise<string> {
  let overriddenVersion = process.env.REMIX_CLI_VERSION?.trim()
  if (overriddenVersion) {
    return overriddenVersion
  }

  let packageJsonUrl = new URL('../../../package.json', import.meta.url)
  let packageJson = await readPackageJson(packageJsonUrl)
  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw cliVersionUnavailable(packageJsonUrl.pathname)
  }

  return packageJson.version
}

async function readPackageJson(url: URL): Promise<{ version?: unknown }> {
  return JSON.parse(await fs.readFile(url, 'utf8')) as { version?: unknown }
}
