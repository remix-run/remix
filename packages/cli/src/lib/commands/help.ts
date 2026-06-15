import * as process from 'node:process'

import { renderCliError, toCliError, unknownHelpTopic } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'

export async function runHelpCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getHelpCommandHelpText())
    return 0
  }

  try {
    process.stdout.write(await getCommandHelpText(argv))
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
        { description: 'Run tests for the current project', label: 'test [glob]' },
        { description: 'Show the current Remix version', label: 'version' },
      ],
      examples: [
        'remix completion bash',
        'remix help',
        'remix help completion',
        'remix help doctor',
        'remix doctor',
        'remix new my-remix-app',
        'remix new my-remix-app --app-name "My Remix App"',
        'remix routes',
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
        'remix help test',
        'remix help version',
      ],
      usage: ['remix help [command]'],
    },
    target,
  )
}

async function getCommandHelpText(argv: string[]): Promise<string> {
  if (argv.length === 0) {
    return getCliHelpText()
  }

  let [command, ...rest] = argv

  if (command === 'help') {
    return rest.length === 0 ? getHelpCommandHelpText() : getNestedHelpText(command, rest)
  }

  if (command === 'new' && rest.length === 0) {
    let { getNewCommandHelpText } = await import('./new.ts')
    return getNewCommandHelpText()
  }

  if (command === 'completion' && rest.length === 0) {
    let { getCompletionCommandHelpText } = await import('./completion.ts')
    return getCompletionCommandHelpText()
  }

  if (command === 'doctor' && rest.length === 0) {
    let { getDoctorCommandHelpText } = await import('./doctor.ts')
    return getDoctorCommandHelpText()
  }

  if (command === 'routes' && rest.length === 0) {
    let { getRoutesCommandHelpText } = await import('./routes.ts')
    return getRoutesCommandHelpText()
  }

  if (command === 'test' && rest.length === 0) {
    let { getTestCommandHelpText } = await import('./test.ts')
    return await getTestCommandHelpText()
  }

  if (command === 'version' && rest.length === 0) {
    let { getVersionCommandHelpText } = await import('./version.ts')
    return getVersionCommandHelpText()
  }

  throw unknownHelpTopic(argv.join(' '))
}

function getNestedHelpText(command: string, argv: string[]): string {
  throw unknownHelpTopic(`${command} ${argv.join(' ')}`)
}
