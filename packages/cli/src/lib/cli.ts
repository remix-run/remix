import * as process from 'node:process'

import { getCliHelpText, runHelpCommand } from './commands/help.ts'
import { resolveCliContext, type CliContext } from './cli-context.ts'
import { renderCliError, unknownCommand } from './errors.ts'
import { configureColors, restoreTerminalFormatting } from './terminal.ts'

/**
 * Options accepted by {@link runRemix}.
 */
export interface RunRemixOptions {
  /**
   * Directory used as the working root when resolving project files (default
   * `process.cwd()`).
   */
  cwd?: string
  /**
   * Override for the Remix version reported by `remix --version`. Defaults to
   * the version of the installed `@remix-run/cli` package.
   */
  remixVersion?: string
}

/**
 * Entry point for the `remix` CLI. Parses `argv`, dispatches to the matching
 * subcommand (`new`, `doctor`, `routes`, `test`, `version`, `completion`,
 * `help`), and resolves with the exit code the process should use.
 *
 * @param argv Argument vector to parse, excluding the node and script paths
 *             (default `process.argv.slice(2)`).
 * @param options Overrides for CLI context resolution.
 * @returns The numeric exit code (`0` on success, non-zero on failure).
 *
 * @example
 * ```ts
 * import { runRemix } from '@remix-run/cli'
 *
 * let exitCode = await runRemix(process.argv.slice(2))
 * process.exit(exitCode)
 * ```
 */
export async function runRemix(
  argv: string[] = process.argv.slice(2),
  options: RunRemixOptions = {},
): Promise<number> {
  let context = await resolveCliContext(options)

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

    return await runCommand(command, rest, context)
  } finally {
    restoreTerminalFormatting()
  }
}

async function runCommand(command: string, argv: string[], context: CliContext): Promise<number> {
  if (command === 'help') {
    return runHelpCommand(argv)
  }

  if (command === '-v' || command === '--version') {
    let { runVersionCommand } = await import('./commands/version.ts')
    return runVersionCommand([], context)
  }

  if (command === 'new') {
    let { runNewCommand } = await import('./commands/new.ts')
    return runNewCommand(argv, context)
  }

  if (command === 'completion') {
    let { runCompletionCommand } = await import('./commands/completion.ts')
    return runCompletionCommand(argv)
  }

  if (command === 'doctor') {
    let { runDoctorCommand } = await import('./commands/doctor.ts')
    return runDoctorCommand(argv, context)
  }

  if (command === 'routes') {
    let { runRoutesCommand } = await import('./commands/routes.ts')
    return runRoutesCommand(argv, context)
  }

  if (command === 'test') {
    let { runTestCommand } = await import('./commands/test.ts')
    return runTestCommand(argv, context)
  }

  if (command === 'version') {
    let { runVersionCommand } = await import('./commands/version.ts')
    return runVersionCommand(argv, context)
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
