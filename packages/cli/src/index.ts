#!/usr/bin/env node
import { run } from './lib/cli.ts'
import { readDevRemixVersion } from './lib/dev-remix-version.ts'
import { renderCliError } from './lib/errors.ts'

if (import.meta.main) {
  void runMain().then(
    (exitCode) => {
      setExitCode(exitCode)
    },
    (error: unknown) => {
      process.stderr.write(renderCliError(error))
      setExitCode(1)
    },
  )
}

async function runMain(): Promise<number> {
  return await run(undefined, { remixVersion: await readDevRemixVersion() })
}

function setExitCode(exitCode: number) {
  globalThis.process.exitCode = exitCode
}

export { run }
