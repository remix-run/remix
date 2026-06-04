#!/usr/bin/env node
import process from 'node:process'

import { runNodeHmr } from './cli.ts'

try {
  let exitCode = await runNodeHmr({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
  })
  process.exit(exitCode)
} catch (error) {
  console.error(error)
  process.exit(1)
}
