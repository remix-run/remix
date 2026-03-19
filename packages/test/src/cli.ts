#!/usr/bin/env node
import { parseArgs } from 'node:util'
import * as fs from 'node:fs/promises'
import type * as http from 'node:http'
import { tsImport } from 'tsx/esm/api'
import { runBrowserTests } from './lib/runner-browser.ts'
import { runServerTests } from './lib/runner.ts'
import path from 'node:path'

let { startServer } = await tsImport('./app/server.tsx', {
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

let watcherControllers = new Set<AbortController>()

function closeWatchers() {
  for (let controller of watcherControllers) {
    controller.abort()
  }
  watcherControllers.clear()
}

function cleanupAndExit(code: number) {
  if (hasExited) return
  hasExited = true
  closeWatchers()
  browserServer?.close()
  process.exit(code)
}

async function updateWatchers(testFiles: string[]) {
  closeWatchers()

  for (let file of testFiles) {
    try {
      let controller = new AbortController()
      let watcher = fs.watch(file, { recursive: false, signal: controller.signal })
      watcherControllers.add(controller)
      for await (let event of watcher) {
        queueRerun('file changed')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      continue
    }
  }
}

async function executeRun() {
  if (hasExited) return

  running = true

  try {
    let files = await discoverTests(pattern)

    if (files.length === 0) {
      console.error(`No test files found matching pattern: ${pattern}`)
      latestExitCode = 1
      return
    }

    let browserFiles = files.filter(isBrowserTest)
    let serverFiles = files.filter((f) => !isBrowserTest(f))

    console.log(`Found ${files.length} test file(s)\n`)
    if (isWatchMode) {
      updateWatchers(files)
    }

    let serverFailed = false
    let browserFailed = false

    if (serverFiles.length > 0) {
      let { failed } = await runServerTests(serverFiles)
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

async function discoverTests(pattern: string): Promise<string[]> {
  let files: string[] = []
  let exclude = ['node_modules/**', '.git/**']

  for await (let file of fs.glob(pattern, { cwd: process.cwd(), exclude })) {
    files.push(path.resolve(process.cwd(), file))
  }

  return files.sort()
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
