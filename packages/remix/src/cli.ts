#!/usr/bin/env node
// IMPORTANT: This file is auto-generated, please do not edit manually.
import * as process from 'node:process'
import { pathToFileURL } from 'node:url'

import { run as runCli } from '@remix-run/cli'

const remixVersion = "3.0.0-alpha.4"

export async function run(argv?: string[]): Promise<number> {
  let previousCliVersion = process.env.REMIX_CLI_VERSION
  process.env.REMIX_CLI_VERSION = remixVersion

  try {
    return await runCli(argv)
  } finally {
    restoreEnvironmentVariable('REMIX_CLI_VERSION', previousCliVersion)
  }
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
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

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value == null) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}
