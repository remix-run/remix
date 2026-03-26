import * as process from 'node:process'

import { UsageError } from '../errors.ts'
import { getNewCommandHelpText } from './new.ts'
import { getRoutesCommandHelpText } from './routes.ts'
import {
  getSkillsCommandHelpText,
  getSkillsInstallCommandHelpText,
  getSkillsListCommandHelpText,
  getSkillsStatusCommandHelpText,
} from './skills.ts'

export async function runHelpCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getHelpCommandHelpText())
    return 0
  }

  try {
    process.stdout.write(getCommandHelpText(argv))
    return 0
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getCliHelpText())
      return 1
    }

    throw error
  }
}

export function getCliHelpText(): string {
  return `Usage:
  remix <command> [options]

Commands:
  help [command]  Show help for Remix commands
  new <name>      Create a new Remix project
  routes          Show the route tree for the current project
  skills          Manage Remix skills for the current project

Options:
  -h, --help      Show help
  -v, --version   Show version

Examples:
  remix help
  remix help skills install
  remix new my-remix-app
  remix new my-remix-app --app-name "My Remix App"
  remix routes
  remix skills install
`
}

export function getHelpCommandHelpText(): string {
  return `Usage:
  remix help [command]

Show help for Remix commands.

Examples:
  remix help
  remix help new
  remix help routes
  remix help skills install
`
}

function getCommandHelpText(argv: string[]): string {
  if (argv.length === 0) {
    return getCliHelpText()
  }

  let [command, ...rest] = argv

  if (command === 'help') {
    return rest.length === 0 ? getHelpCommandHelpText() : getNestedHelpText(command, rest)
  }

  if (command === 'new' && rest.length === 0) {
    return getNewCommandHelpText()
  }

  if (command === 'routes' && rest.length === 0) {
    return getRoutesCommandHelpText()
  }

  if (command === 'skills') {
    return getSkillsHelpText(rest)
  }

  throw new UsageError(`Unknown help topic: ${argv.join(' ')}`)
}

function getNestedHelpText(command: string, argv: string[]): string {
  throw new UsageError(`Unknown help topic: ${command} ${argv.join(' ')}`)
}

function getSkillsHelpText(argv: string[]): string {
  if (argv.length === 0) {
    return getSkillsCommandHelpText()
  }

  let [subcommand, ...rest] = argv
  if (rest.length > 0) {
    throw new UsageError(`Unknown help topic: skills ${argv.join(' ')}`)
  }

  if (subcommand === 'install') {
    return getSkillsInstallCommandHelpText()
  }

  if (subcommand === 'list') {
    return getSkillsListCommandHelpText()
  }

  if (subcommand === 'status') {
    return getSkillsStatusCommandHelpText()
  }

  throw new UsageError(`Unknown help topic: skills ${argv.join(' ')}`)
}
