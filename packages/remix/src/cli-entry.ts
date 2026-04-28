#!/usr/bin/env node
// IMPORTANT: This file is auto-generated, please do not edit manually.
import * as fs from 'node:fs/promises'
import * as process from 'node:process'

import { runRemix } from './cli.ts'

try {
  let exitCode = await runRemix(process.argv.slice(2), { remixVersion: await readRemixVersion() })
  process.exit(exitCode)
} catch (error) {
  console.error(error)
  process.exit(1)
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
