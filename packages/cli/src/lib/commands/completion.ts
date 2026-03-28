import * as process from 'node:process'

import {
  getCompletionResult,
  getCompletionScript,
  isCompletionShell,
  renderCompletionResult,
} from '../completion.ts'
import {
  invalidCompletionRequest,
  renderCliError,
  toCliError,
  unknownCompletionShell,
} from '../errors.ts'
import { parseArgs } from '../parse-args.ts'

export async function runCompletionCommand(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(getCompletionCommandHelpText())
    return 0
  }

  if (argv[0] === '--') {
    return runCompletionPlumbing(argv.slice(1))
  }

  let [shell, ...rest] = argv

  try {
    parseArgs(rest, {}, { maxPositionals: 0 })

    if (!isCompletionShell(shell)) {
      throw unknownCompletionShell(shell)
    }

    process.stdout.write(getCompletionScript())
    return 0
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getCompletionCommandHelpText() }),
    )
    return 1
  }
}

export function getCompletionCommandHelpText(): string {
  return `Usage:
  remix completion <bash|zsh>

Print a shell completion script for Remix.

Examples:
  remix completion bash >> ~/.bashrc
  remix completion zsh >> ~/.zshrc
`
}

function runCompletionPlumbing(argv: string[]): number {
  try {
    let [currentIndexArg, ...words] = argv
    if (currentIndexArg == null || !/^\d+$/.test(currentIndexArg)) {
      throw invalidCompletionRequest()
    }

    let currentIndex = Number(currentIndexArg)
    process.stdout.write(renderCompletionResult(getCompletionResult(words, currentIndex)))
    return 0
  } catch (error) {
    process.stderr.write(renderCliError(toCliError(error)))
    return 1
  }
}
