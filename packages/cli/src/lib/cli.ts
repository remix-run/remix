import * as process from 'node:process'

import { runCompletionCommand } from './commands/completion.ts'
import { runDoctorCommand } from './commands/doctor.ts'
import { getCliHelpText, runHelpCommand } from './commands/help.ts'
import { runNewCommand } from './commands/new.ts'
import { runRoutesCommand } from './commands/routes.ts'
import { runSkillsCommand } from './commands/skills.ts'
import { runVersionCommand } from './commands/version.ts'
import { renderCliError, unknownCommand } from './errors.ts'
import { setCliRuntimeContext, type CliRuntimeContext } from './runtime-context.ts'
import {
  configureColors,
  restoreTerminalFormatting,
  writeCommandEpilogue,
  writeCommandPreamble,
} from './terminal.ts'

export async function run(
  argv: string[] = process.argv.slice(2),
  context: CliRuntimeContext = {},
): Promise<number> {
  let previousContext = setCliRuntimeContext({
    cwd: process.cwd(),
    ...context,
  })
  let shouldWriteCommandSpacing = false

  try {
    while (argv[0] === '--') {
      argv = argv.slice(1)
    }

    let globalOptions = extractGlobalOptions(argv)
    argv = globalOptions.argv
    configureColors({ disabled: globalOptions.noColor })
    shouldWriteCommandSpacing = shouldWriteCommandPreambleForArgs(argv)

    if (argv.length === 0) {
      if (shouldWriteCommandSpacing) {
        writeCommandPreamble()
      }
      process.stdout.write(getCliHelpText())
      return 0
    }

    let [command, ...rest] = argv

    if (command === '-h' || command === '--help') {
      if (shouldWriteCommandSpacing) {
        writeCommandPreamble()
      }
      process.stdout.write(getCliHelpText())
      return 0
    }

    if (shouldWriteCommandSpacing) {
      writeCommandPreamble()
    }

    return await runCommand(command, rest)
  } finally {
    setCliRuntimeContext(previousContext)
    restoreTerminalFormatting()
    if (shouldWriteCommandSpacing) {
      writeCommandEpilogue()
    }
  }
}

async function runCommand(command: string, argv: string[]): Promise<number> {
  if (command === 'help') {
    return runHelpCommand(argv)
  }

  if (command === '-v' || command === '--version') {
    return runVersionCommand([])
  }

  if (command === 'new') {
    return runNewCommand(argv)
  }

  if (command === 'completion') {
    return runCompletionCommand(argv)
  }

  if (command === 'doctor') {
    return runDoctorCommand(argv)
  }

  if (command === 'skills') {
    return runSkillsCommand(argv)
  }

  if (command === 'routes') {
    return runRoutesCommand(argv)
  }

  if (command === 'version') {
    return runVersionCommand(argv)
  }

  process.stderr.write(renderCliError(unknownCommand(command), { helpText: getCliHelpText() }))
  return 1
}

function shouldWriteCommandPreambleForArgs(argv: string[]): boolean {
  if (argv.length === 0) {
    return true
  }

  let [command, ...rest] = argv

  if (command === '-v' || command === '--version') {
    return false
  }

  if (command === 'completion' || command === 'version') {
    return rest.includes('-h') || rest.includes('--help')
  }

  if (command === 'doctor' || command === 'routes') {
    return !rest.includes('--json')
  }

  if (command === 'skills') {
    let [subcommand, ...subcommandArgs] = rest
    if ((subcommand === 'list' || subcommand === 'status') && subcommandArgs.includes('--json')) {
      return false
    }
  }

  return true
}

function extractGlobalOptions(argv: string[]): { argv: string[]; noColor: boolean } {
  let filteredArgv: string[] = []
  let noColor = false

  for (let index = 0; index < argv.length; index++) {
    let arg = argv[index]!

    if (arg === '--') {
      filteredArgv.push(...argv.slice(index))
      break
    }

    if (arg === '--no-color') {
      noColor = true
      continue
    }

    filteredArgv.push(arg)
  }

  return {
    argv: filteredArgv,
    noColor,
  }
}
