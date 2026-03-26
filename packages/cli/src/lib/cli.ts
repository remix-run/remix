import * as fs from 'node:fs/promises'
import * as process from 'node:process'

import { UsageError } from './errors.ts'
import { getNewCommandHelpText, runNewCommand } from './commands/new.ts'
import { getRoutesCommandHelpText, runRoutesCommand } from './commands/routes.ts'
import { getSkillsCommandHelpText, runSkillsCommand } from './commands/skills.ts'

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  while (argv[0] === '--') {
    argv = argv.slice(1)
  }

  if (argv.length === 0) {
    process.stdout.write(getCliHelpText())
    return 0
  }

  let [command, ...rest] = argv

  if (command === '-h' || command === '--help' || command === 'help') {
    process.stdout.write(getCliHelpText())
    return 0
  }

  if (command === '-v' || command === '--version') {
    process.stdout.write(`${await readCliVersion()}\n`)
    return 0
  }

  if (command === 'new') {
    return runNewCommand(rest)
  }

  if (command === 'skills') {
    return runSkillsCommand(rest)
  }

  if (command === 'routes') {
    return runRoutesCommand(rest)
  }

  process.stderr.write(`Unknown command: ${command}\n\n`)
  process.stderr.write(getCliHelpText())
  return 1
}

export function getCliHelpText(): string {
  return `Usage:
  remix <command> [options]

Commands:
  new <name>     Create a new Remix project
  routes         Show the route tree for the current project
  skills         Manage Remix skills for the current project

Options:
  -h, --help     Show help
  -v, --version  Show version

Examples:
  remix new my-remix-app
  remix new my-remix-app --app-name "My Remix App"
  remix routes
  remix skills install
`
}

async function readCliVersion(): Promise<string> {
  let overriddenVersion = process.env.REMIX_CLI_VERSION?.trim()
  if (overriddenVersion) {
    return overriddenVersion
  }

  let packageJson = await readPackageJson(new URL('../../package.json', import.meta.url))
  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new UsageError('Could not determine the current Remix CLI version.')
  }

  return packageJson.version
}

async function readPackageJson(url: URL): Promise<{ version?: unknown }> {
  return JSON.parse(await fs.readFile(url, 'utf8')) as { version?: unknown }
}

export { getNewCommandHelpText }
export { getRoutesCommandHelpText }
export { getSkillsCommandHelpText }
