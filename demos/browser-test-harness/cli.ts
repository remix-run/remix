#!/usr/bin/env node
import { parseArgs } from 'node:util'
import * as path from 'node:path'
import * as fs from 'node:fs'
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
    watch: { type: 'boolean', short: 'w' },
    port: { type: 'string', default: '44101' },
  },
  allowPositionals: true,
})

let pattern = positionals[0] || '**/*.test.ts'
let port = Number(values.port)
let isWatchMode = values.watch ?? false

let demoDir = __dirname
let server = await startServer(port)

let hasExited = false
let latestExitCode = 0
let running = false
let queued = false
let rerunTimer: NodeJS.Timeout | undefined

let watchers = new Set<fs.FSWatcher>()

function closeWatchers() {
  for (let watcher of watchers) {
    watcher.close()
  }
  watchers.clear()
}

function cleanupAndExit(code: number) {
  if (hasExited) return
  hasExited = true
  closeWatchers()
  server.close()
  process.exit(code)
}

function updateWatchers(testFiles: string[]) {
  if (!isWatchMode) return

  closeWatchers()

  let watchPaths = new Set<string>()
  watchPaths.add(path.join(demoDir, 'lib'))
  watchPaths.add(path.join(demoDir, 'browser'))
  watchPaths.add(path.join(demoDir, 'server.tsx'))

  for (let file of testFiles) {
    watchPaths.add(file)
  }

  for (let watchPath of watchPaths) {
    try {
      let watcher = fs.watch(watchPath, { recursive: false }, () => {
        queueRerun('file changed')
      })
      watchers.add(watcher)
    } catch {
      continue
    }
  }
}

async function executeRun() {
  if (hasExited) return

  running = true

  try {
    let files = await discoverTests(pattern, demoDir)

    if (files.length === 0) {
      console.error(`No test files found matching pattern: ${pattern}`)
      latestExitCode = 1
      return
    }

    console.log(`Found ${files.length} test file(s)\n`)
    updateWatchers(files)

    let results = await runTests(files, {
      baseUrl: `http://localhost:${port}`,
      headless: values.headless,
      debug: values.debug,
      devtools: values.devtools,
    })

    displayResults(results)
    latestExitCode = results.failed > 0 ? 1 : 0
  } catch (error) {
    console.error('Error running tests:', error)
    latestExitCode = 1
  } finally {
    running = false
    if (queued) {
      queued = false
      await executeRun()
    } else if (!isWatchMode) {
      cleanupAndExit(latestExitCode)
    }
  }
}

function queueRerun(reason: string) {
  if (!isWatchMode || hasExited) return

  if (rerunTimer) {
    clearTimeout(rerunTimer)
  }

  rerunTimer = setTimeout(() => {
    rerunTimer = undefined
    if (running) {
      queued = true
      return
    }

    console.log(`\n↻ Change detected (${reason}), re-running tests...\n`)
    void executeRun()
  }, 100)
}

if (isWatchMode) {
  process.on('SIGINT', () => cleanupAndExit(latestExitCode))
  process.on('SIGTERM', () => cleanupAndExit(latestExitCode))
}

try {
  await executeRun()

  if (isWatchMode) {
    console.log('Watching for changes. Press Ctrl+C to stop.')
  }
} catch {
  cleanupAndExit(1)
}
