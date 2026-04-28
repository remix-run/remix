import * as process from 'node:process'

import { getCompletionCommandHelpText } from './completion.ts'
import { renderCliError, toCliError, unknownHelpTopic } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { getDoctorCommandHelpText } from './doctor.ts'
import { getNewCommandHelpText } from './new.ts'
import { getRoutesCommandHelpText } from './routes.ts'
import {
  getSkillsCommandHelpText,
  getSkillsInstallCommandHelpText,
  getSkillsListCommandHelpText,
} from './skills.ts'
import { getTestCommandHelpText } from './test.ts'
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
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getCliHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getCliHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      commands: [
        { description: 'Print shell completion scripts for Remix', label: 'completion' },
        { description: 'Show help for Remix commands', label: 'help [command]' },
        { description: 'Create a new Remix project', label: 'new <name>' },
        { description: 'Check project health for the current project', label: 'doctor' },
        { description: 'Show the route tree for the current project', label: 'routes' },
        { description: 'Manage Remix skills for the current project', label: 'skills' },
        { description: 'Run tests for the current project', label: 'test [glob]' },
        { description: 'Show the current Remix version', label: 'version' },
      ],
      examples: [
        'remix completion bash',
        'remix help',
        'remix help completion',
        'remix help doctor',
        'remix help skills install',
        'remix doctor',
        'remix new my-remix-app',
        'remix new my-remix-app --app-name "My Remix App"',
        'remix routes',
        'remix skills install',
        'remix test',
        'remix version',
      ],
      options: [
        { description: 'Show help', label: '-h, --help' },
        { description: 'Disable ANSI color output', label: '--no-color' },
        { description: 'Show version', label: '-v, --version' },
      ],
      usage: ['remix <command> [options]'],
    },
    target,
  )
}

export function getHelpCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Show help for Remix commands.',
      examples: [
        'remix help',
        'remix help completion',
        'remix help doctor',
        'remix help new',
        'remix help routes',
        'remix help skills install',
        'remix help test',
        'remix help version',
      ],
      usage: ['remix help [command]'],
    },
    target,
  )
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

  if (command === 'test' && rest.length === 0) {
    return getTestCommandHelpText()
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
