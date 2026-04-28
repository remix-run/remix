#!/usr/bin/env node
// IMPORTANT: This file is auto-generated, please do not edit manually.
import * as fs from 'node:fs/promises'
import * as process from 'node:process'

import { runRemix as runRemixCli } from '@remix-run/cli'

export async function runRemix(argv?: string[]): Promise<number> {
  return await runRemixCli(argv, { remixVersion: await readRemixVersion() })
}

if (import.meta.main) {
  void runRemix().then(
    (exitCode) => {
      exitProcess(exitCode)
    },
    (error: unknown) => {
      console.error(error)
      exitProcess(1)
    },
  )
}

function exitProcess(exitCode: number): never {
  process.exit(exitCode)
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

