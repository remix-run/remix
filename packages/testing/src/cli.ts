#!/usr/bin/env node
import { parseArgs } from 'node:util'
import * as fs from 'node:fs'
import { tsImport } from 'tsx/esm/api'
import { discoverTests } from './lib/server/test-discovery.ts'
import { runTests } from './lib/server/test-runner.ts'
import { displayResults } from './lib/server/result-collector.ts'

let { startServer } = await tsImport('./lib/server/server.tsx', {
  parentURL: import.meta.url,
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
})

let { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    debug: { type: 'boolean', short: 'd' },
    devtools: { type: 'boolean' },
    ui: { type: 'boolean', short: 'u' },
    watch: { type: 'boolean', short: 'w' },
    port: { type: 'string', short: 'p', default: '44101' },
  },
  allowPositionals: true,
})

let pattern = positionals[0] || '**/*.test.{ts,tsx}'
let port = Number(values.port)
let isWatchMode = values.watch ?? false

let server = await startServer(port, pattern)

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
    let files = await discoverTests(pattern, process.cwd())

    if (files.length === 0) {
      console.error(`No test files found matching pattern: ${pattern}`)
      latestExitCode = 1
      return
    }

    console.log(`Found ${files.length} test file(s)\n`)
    updateWatchers(files)

    let { results, close } = await runTests({
      baseUrl: `http://localhost:${port}`,
      debug: values.debug,
      devtools: values.devtools,
      ui: values.ui,
    })

    displayResults(results)
    latestExitCode = results.failed > 0 ? 1 : 0

    if (values.ui) {
      console.log('\nBrowser is open. Press Ctrl+C to close.')
      await new Promise<void>((resolve) => {
        process.once('SIGINT', resolve)
        process.once('SIGTERM', resolve)
      })
      await close()
    }
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

// Handle clean shutdown in non-watch mode too
process.on('SIGINT', () => cleanupAndExit(latestExitCode))
process.on('SIGTERM', () => cleanupAndExit(latestExitCode))

try {
  await executeRun()

  if (isWatchMode) {
    console.log('Watching for changes. Press Ctrl+C to stop.')
  }
} catch {
  cleanupAndExit(1)
}
