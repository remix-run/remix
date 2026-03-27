import * as fs from 'node:fs/promises'
import * as process from 'node:process'

import { UsageError } from '../errors.ts'

export async function runVersionCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getVersionCommandHelpText())
    return 0
  }

  if (argv.length > 0) {
    let [arg] = argv

    if (arg.startsWith('-')) {
      process.stderr.write(`Unknown argument: ${arg}\n\n`)
      process.stderr.write(getVersionCommandHelpText())
      return 1
    }

    process.stderr.write(`Unexpected extra argument: ${arg}\n\n`)
    process.stderr.write(getVersionCommandHelpText())
    return 1
  }

  process.stdout.write(`${await readCliVersion()}\n`)
  return 0
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

  let packageJson = await readPackageJson(new URL('../../../package.json', import.meta.url))
  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new UsageError('Could not determine the current Remix CLI version.')
  }

  return packageJson.version
}

async function readPackageJson(url: URL): Promise<{ version?: unknown }> {
  return JSON.parse(await fs.readFile(url, 'utf8')) as { version?: unknown }
}
