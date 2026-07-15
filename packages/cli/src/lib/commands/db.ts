import * as process from 'node:process'
import { formatHelpText } from '../help-text.ts'
import type { CliContext } from '../cli-context.ts'

export async function runDbCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getDbCommandHelpText())
    return 0
  }

  let [command, ...rest] = argv
  let dbCli = await import('@remix-run/data-table/cli')
  let options = { argv: rest, cwd: context.cwd }

  if (command === 'create') {
    return dbCli.create(options)
  }

  if (command === 'drop') {
    return dbCli.drop(options)
  }

  if (command === 'migrate') {
    return dbCli.migrate(options)
  }

  if (command === 'reset') {
    return dbCli.reset(options)
  }

  if (command === 'seed') {
    return dbCli.seed(options)
  }

  if (command === 'status') {
    return dbCli.status(options)
  }

  throw new Error('Unknown db command: ' + command)
}

export function getDbCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Manage the current app database.',
      examples: [
        'remix db create',
        'remix db drop',
        'remix db migrate',
        'remix db migrate --to 20260715123000_add_users',
        'remix db status',
        'remix db seed',
        'remix db reset',
      ],
      usage: [
        'remix db create',
        'remix db drop',
        'remix db migrate [--to <migration>]',
        'remix db status',
        'remix db seed',
        'remix db reset',
      ],
    },
    target,
  )
}
