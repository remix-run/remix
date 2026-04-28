import { getRemixTestHelpText, runRemixTest, runRemixTestCli } from '@remix-run/test/cli'
import * as process from 'node:process'

import { renderCliError, toCliError } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { getRuntimeCwd, shouldExitProcess } from '../runtime-context.ts'

export async function runTestCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getTestCommandHelpText())
    return 0
  }

  try {
    if (shouldExitProcess()) {
      await runRemixTestCli({ argv, cwd: getRuntimeCwd() })
    }

    return await runRemixTest({ argv, cwd: getRuntimeCwd() })
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getTestCommandHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getTestCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  let commandHelpText = formatHelpText(
    {
      description: 'Run tests for the current project.',
      examples: [
        'remix test',
        'remix test --watch',
        'remix test --coverage',
        'remix test --glob.test "src/**/*.test.ts"',
      ],
      usage: ['remix test [glob] [options]'],
    },
    target,
  )
  let runnerHelpText = getRemixTestHelpText().replace(
    /^Usage: remix-test \[glob\] \[options\]\n\n/,
    '',
  )
  return `${commandHelpText}\n${runnerHelpText}\n`
}
