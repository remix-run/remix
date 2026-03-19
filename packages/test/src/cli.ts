#!/usr/bin/env node
import { parseArgs } from 'node:util'
import * as fs from 'node:fs'
import type * as http from 'node:http'
import { tsImport } from 'tsx/esm/api'
import { discoverTests } from './lib/server/discovery.ts'
import { runBrowserTests } from './lib/server/runner.ts'
import { runNodeTests } from './lib/server/node-runner.ts'
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

function isBrowserTest(file: string): boolean {
  return /\.test\.browser\.[^.]+$/.test(file)
}

let hasExited = false
let latestExitCode = 0
let running = false
let queued = false
let rerunTimer: NodeJS.Timeout | undefined
let browserServer: http.Server | undefined

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
  browserServer?.close()
  process.exit(code)
}

function updateWatchers(testFiles: string[]) {
  if (!isWatchMode) return

  closeWatchers()

  for (let file of testFiles) {
    try {
      let watcher = fs.watch(file, { recursive: false }, () => {
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

    let browserFiles = files.filter(isBrowserTest)
    let serverFiles = files.filter((f) => !isBrowserTest(f))

    console.log(`Found ${files.length} test file(s)\n`)
    updateWatchers(files)

    let serverFailed = false
    let browserFailed = false

    if (serverFiles.length > 0) {
      let { failed } = await runNodeTests(serverFiles)
      serverFailed = failed
      console.log('\n\n')
    }

    if (browserFiles.length > 0) {
      if (!browserServer) {
        browserServer = await startServer(port, browserFiles)
      }

      let { results, close, disconnected } = await runBrowserTests({
        baseUrl: `http://localhost:${port}`,
        debug: values.debug,
        devtools: values.devtools,
        ui: values.ui,
      })

      displayResults(results)
      browserFailed = results.failed > 0

      if (values.ui) {
        console.log('\nBrowser is open. Press Ctrl+C to close.')
        await Promise.race([
          disconnected,
          new Promise<void>((resolve) => {
            process.once('SIGINT', resolve)
            process.once('SIGTERM', resolve)
          }),
        ])
        await close()
      }
    }

    latestExitCode = serverFailed || browserFailed ? 1 : 0
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
