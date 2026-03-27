import * as process from 'node:process'

import { configureColors } from './color.ts'
import { runDoctorCommand } from './commands/doctor.ts'
import { getCliHelpText, runHelpCommand } from './commands/help.ts'
import { runNewCommand } from './commands/new.ts'
import { runRoutesCommand } from './commands/routes.ts'
import { runSkillsCommand } from './commands/skills.ts'
import { runVersionCommand } from './commands/version.ts'
import { renderCliError, unknownCommand } from './errors.ts'

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
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

  if (command === 'help') {
    return runHelpCommand(rest)
  }

  if (command === '-v' || command === '--version') {
    return runVersionCommand([])
  }

  if (command === 'new') {
    return runNewCommand(rest)
  }

  if (command === 'doctor') {
    return runDoctorCommand(rest)
  }

  if (command === 'skills') {
    return runSkillsCommand(rest)
  }

  if (command === 'routes') {
    return runRoutesCommand(rest)
  }

  if (command === 'version') {
    return runVersionCommand(rest)
  }

  process.stderr.write(renderCliError(unknownCommand(command), { helpText: getCliHelpText() }))
  return 1
}

function extractGlobalOptions(argv: string[]): { argv: string[]; noColor: boolean } {
  let filteredArgv: string[] = []
  let noColor = false

  for (let arg of argv) {
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
