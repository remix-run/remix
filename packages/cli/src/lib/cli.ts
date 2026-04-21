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
import { configureColors, restoreTerminalFormatting } from './terminal.ts'

export async function run(
  argv: string[] = process.argv.slice(2),
  context: CliRuntimeContext = {},
): Promise<number> {
  let previousContext = setCliRuntimeContext({
    cwd: process.cwd(),
    ...context,
  })

  try {
    while (argv[0] === '--') {
      argv = argv.slice(1)
    }

    let globalOptions = extractGlobalOptions(argv)
    argv = globalOptions.argv
    configureColors({ disabled: globalOptions.noColor })

    if (argv.length === 0) {
      process.stdout.write(getCliHelpText())
      return 0
    }

    let [command, ...rest] = argv

    if (command === '-h' || command === '--help') {
      process.stdout.write(getCliHelpText())
      return 0
    }

    return await runCommand(command, rest)
  } finally {
    setCliRuntimeContext(previousContext)
    restoreTerminalFormatting()
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

  process.stderr.write(
    renderCliError(unknownCommand(command), { helpText: getCliHelpText(process.stderr) }),
  )
  return 1
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
