#!/usr/bin/env node
import { parseArgs } from 'node:util'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverTests } from './lib/test-discovery.ts'
import { startServer } from './server.tsx'
import { runTests } from './lib/test-runner.ts'
import { displayResults } from './lib/result-collector.ts'

let __dirname = path.dirname(fileURLToPath(import.meta.url))

let { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    debug: { type: 'boolean' },
    devtools: { type: 'boolean' },
    headless: { type: 'boolean' },
    port: { type: 'string', default: '44101' },
  },
  allowPositionals: true,
})

let pattern = positionals[0] || '**/*.test.ts'
let port = Number(values.port)

let demoDir = __dirname
let files = await discoverTests(pattern, demoDir)

if (files.length === 0) {
  console.error(`No test files found matching pattern: ${pattern}`)
  process.exit(1)
}

console.log(`Found ${files.length} test file(s)\n`)

let server = await startServer(port)

try {
  let results = await runTests(files, {
    baseUrl: `http://localhost:${port}`,
    headless: values.headless,
    debug: values.debug,
    devtools: values.devtools,
  })

  displayResults(results)

  server.close()
  process.exit(results.failed > 0 ? 1 : 0)
} catch (error) {
  console.error('Error running tests:', error)
  server.close()
  process.exit(1)
}
