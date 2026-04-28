#!/usr/bin/env node
// IMPORTANT: This file is auto-generated, please do not edit manually.
import * as process from 'node:process'

import { runRemix } from './cli.ts'

try {
  let exitCode = await runRemix(process.argv.slice(2))
  process.exit(exitCode)
} catch (error) {
  console.error(error)
  process.exit(1)
}
