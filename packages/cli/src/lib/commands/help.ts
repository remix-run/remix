import * as process from 'node:process'

import { getCompletionCommandHelpText } from './completion.ts'
import { renderCliError, unknownHelpTopic } from '../errors.ts'
import { getDoctorCommandHelpText } from './doctor.ts'
import { getNewCommandHelpText } from './new.ts'
import { getRoutesCommandHelpText } from './routes.ts'
import {
  getSkillsCommandHelpText,
  getSkillsInstallCommandHelpText,
  getSkillsListCommandHelpText,
} from './skills.ts'
import { getVersionCommandHelpText } from './version.ts'

export async function runHelpCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getHelpCommandHelpText())
    return 0
  }

  try {
    process.stdout.write(getCommandHelpText(argv))
    return 0
  } catch (error) {
    process.stderr.write(renderCliError(error, { helpText: getCliHelpText() }))
    return 1
  }
}

export function getCliHelpText(): string {
  return `Usage:
  remix <command> [options]

Commands:
  completion     Print shell completion scripts for Remix
  help [command]  Show help for Remix commands
  new <name>      Create a new Remix project
  doctor          Check project health for the current project
  routes          Show the route tree for the current project
  skills          Manage Remix skills for the current project
  version         Show the current Remix version

Options:
  -h, --help      Show help
  --no-color      Disable ANSI color output
  -v, --version   Show version

Examples:
  remix completion bash
  remix help
  remix help completion
  remix help doctor
  remix help skills install
  remix doctor
  remix new my-remix-app
  remix new my-remix-app --app-name "My Remix App"
  remix routes
  remix skills install
  remix version
`
}

export function getHelpCommandHelpText(): string {
  return `Usage:
  remix help [command]

Show help for Remix commands.

Examples:
  remix help
  remix help completion
  remix help doctor
  remix help new
  remix help routes
  remix help skills install
  remix help version
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

  if (command === 'completion' && rest.length === 0) {
    return getCompletionCommandHelpText()
  }

  if (command === 'doctor' && rest.length === 0) {
    return getDoctorCommandHelpText()
  }

  if (command === 'routes' && rest.length === 0) {
    return getRoutesCommandHelpText()
  }

  if (command === 'skills') {
    return getSkillsHelpText(rest)
  }

  if (command === 'version' && rest.length === 0) {
    return getVersionCommandHelpText()
  }

  throw unknownHelpTopic(argv.join(' '))
}

function getNestedHelpText(command: string, argv: string[]): string {
  throw unknownHelpTopic(`${command} ${argv.join(' ')}`)
}

function getSkillsHelpText(argv: string[]): string {
  if (argv.length === 0) {
    return getSkillsCommandHelpText()
  }

  let [subcommand, ...rest] = argv
  if (rest.length > 0) {
    throw unknownHelpTopic(`skills ${argv.join(' ')}`)
  }

  if (subcommand === 'install') {
    return getSkillsInstallCommandHelpText()
  }

  if (subcommand === 'list') {
    return getSkillsListCommandHelpText()
  }

  throw unknownHelpTopic(`skills ${argv.join(' ')}`)
}
