#!/usr/bin/env node
import { run } from './lib/cli.ts'
import { readDevRemixVersion } from './lib/dev-remix-version.ts'
import { renderCliError } from './lib/errors.ts'

if (import.meta.main) {
  void runMain().then(
    (exitCode) => {
      exitProcess(exitCode)
    },
    (error: unknown) => {
      process.stderr.write(renderCliError(error))
      exitProcess(1)
    },
  )
}

async function runMain(): Promise<number> {
  return await run(undefined, {
    remixVersion: await readDevRemixVersion(),
  })
}

function exitProcess(exitCode: number): never {
  globalThis.process.exit(exitCode)
}

export { run }
