#!/usr/bin/env node
import { runRemixTest } from './lib/run-remix-test.ts'

export { getRemixTestHelpText } from './lib/config.ts'
export { runRemixTest, type RunRemixTestOptions } from './lib/run-remix-test.ts'

if (import.meta.main) {
  void runRemixTest().then(
    (exitCode) => {
      exitProcess(exitCode)
    },
    (error: unknown) => {
      console.error('Error running tests:', error)
      exitProcess(1)
    },
  )
}

function exitProcess(exitCode: number): never {
  process.exit(exitCode)
}
