#!/usr/bin/env node
import * as process from 'node:process'

import { runRemix } from './lib/cli.ts'
import { readDevRemixVersion } from './lib/dev-remix-version.ts'
import { renderCliError } from './lib/errors.ts'

try {
  let exitCode = await runRemix(process.argv.slice(2), {
    remixVersion: await readDevRemixVersion(),
  })
  exitProcess(exitCode)
} catch (error) {
  process.stderr.write(renderCliError(error))
  exitProcess(1)
}

function exitProcess(exitCode: number): never {
  process.exit(exitCode)
}
