#!/usr/bin/env node
import { run } from './lib/cli.ts'
import { readDevRemixVersion } from './lib/dev-remix-version.ts'
import { renderCliError } from './lib/errors.ts'

if (import.meta.main) {
  void run(undefined, { remixVersion: readDevRemixVersion() }).then(
    (exitCode) => {
      setExitCode(exitCode)
    },
    (error: unknown) => {
      process.stderr.write(renderCliError(error))
      setExitCode(1)
    },
  )
}

function setExitCode(exitCode: number) {
  globalThis.process.exitCode = exitCode
}

export { run }
