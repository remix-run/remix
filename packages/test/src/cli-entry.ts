#!/usr/bin/env node
import * as process from 'node:process'

import { runRemixTest } from './cli.ts'

try {
  let exitCode = await runRemixTest({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
  })
  exitProcess(exitCode)
} catch (error) {
  console.error('Error running tests:', error)
  exitProcess(1)
}

function exitProcess(exitCode: number): never {
  process.exit(exitCode)
}
