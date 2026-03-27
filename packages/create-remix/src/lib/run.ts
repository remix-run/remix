import * as process from 'node:process'

import { run as runCli } from '@remix-run/cli'

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  while (argv[0] === '--') {
    argv = argv.slice(1)
  }

  return runCli(['new', ...argv])
}
