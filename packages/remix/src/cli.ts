#!/usr/bin/env node
// IMPORTANT: This file is auto-generated, please do not edit manually.
import * as process from 'node:process'

import { run as runCli } from '@remix-run/cli'

const remixVersion = '3.0.0-alpha.4'

export async function run(argv?: string[]): Promise<number> {
  return runCli(argv, { remixVersion })
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
