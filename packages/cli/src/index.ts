#!/usr/bin/env node
import * as process from 'node:process'

export { run } from './lib/cli.ts'
import { run } from './lib/cli.ts'

if (import.meta.main) {
  void run().then(
    (exitCode) => {
      setExitCode(exitCode)
    },
    (error: unknown) => {
      console.error(error)
      setExitCode(1)
    },
  )
}

function setExitCode(exitCode: number) {
  globalThis.process.exitCode = exitCode
}
