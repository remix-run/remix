#!/usr/bin/env node
// IMPORTANT: This file is auto-generated, please do not edit manually.
import * as fs from 'node:fs/promises'
import * as process from 'node:process'

import { run as runCli } from '@remix-run/cli'

export async function run(argv?: string[]): Promise<number> {
  return await runCli(argv, { remixVersion: await readRemixVersion() })
}

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
  let runtimeProcess = process
  Reflect.set(runtimeProcess, 'exitCode', exitCode)
}

async function readRemixVersion(): Promise<string> {
  let packageJson = JSON.parse(
    await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as {
    name?: unknown
    version?: unknown
  }

  if (packageJson.name !== 'remix') {
    throw new Error('Could not determine the current Remix version.')
  }

  if (typeof packageJson.version !== 'string' || packageJson.version.trim().length === 0) {
    throw new Error('Could not determine the current Remix version.')
  }

  return packageJson.version.trim()
}
