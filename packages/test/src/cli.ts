#!/usr/bin/env node
import * as util from 'node:util'
import * as fsp from 'node:fs/promises'
import type * as http from 'node:http'
import * as path from 'node:path'
import { tsImport } from 'tsx/esm/api'
import { runBrowserTests } from './lib/runner-browser.ts'
import { runServerTests } from './lib/runner.ts'
import { createReporter } from './lib/reporter.ts'
import { createWatcher } from './lib/watcher.ts'

let { startServer } = await tsImport('./app/server.tsx', {
  parentURL: import.meta.url,
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
})

let { values, positionals } = util.parseArgs({
  args: process.argv.slice(2),
  options: {
    browserConsole: { type: 'boolean', short: 'd' },
    browserDevtools: { type: 'boolean' },
    browserOpen: { type: 'boolean', short: 'u' },
    watch: { type: 'boolean', short: 'w' },
    browserPort: { type: 'string', short: 'p', default: '44101' },
    browserGlob: { type: 'string', default: '**/*.test.browser.{ts,tsx}' },
    reporter: { type: 'string', short: 'r', default: 'spec' },
  },
  allowPositionals: true,
})

const pattern = positionals[0] || '**/*.test?(.browser).{ts,tsx}'
const port = Number(values.browserPort)

let hasExited = false
let latestExitCode = 0
let watcher: ReturnType<typeof createWatcher> | undefined
let running = false
let queued = false
let rerunTimer: NodeJS.Timeout | undefined
let browserServer: http.Server | undefined

process.on('SIGINT', () => cleanupAndExit(latestExitCode))
process.on('SIGTERM', () => cleanupAndExit(latestExitCode))

try {
  await executeRun()

  if (values.watch) {
    console.log('Watching for changes. Press Ctrl+C to stop.')
  }
} catch {
  cleanupAndExit(1)
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

    let browserSet = new Set(await discoverTests(values.browserGlob!))
    let browserFiles = files.filter((f) => browserSet.has(f))
    let serverFiles = files.filter((f) => !browserSet.has(f))

    console.log(
      `Found ${files.length} test file(s) (${serverFiles.length} server, ${browserFiles.length} browser)\n`,
    )
    if (values.watch) {
      watcher ??= createWatcher((file) => queueRerun(file))
      watcher.update(files)
    }

    if (browserFiles.length > 0 && !browserServer) {
      browserServer = await startServer(port, browserFiles)
    }

    let reporter = createReporter(values.reporter!)
    let startTime = performance.now()
    let [serverResult, browserResult] = await Promise.all([
      serverFiles.length > 0 ? runServerTests(serverFiles, reporter) : null,
      browserFiles.length > 0
        ? runBrowserTests({
            baseUrl: `http://localhost:${port}`,
            console: values.browserConsole,
            devtools: values.browserDevtools,
            open: values.browserOpen,
            reporter,
          })
        : null,
    ])

    let totalPassed = (serverResult?.passed ?? 0) + (browserResult?.results.passed ?? 0)
    let totalFailed = (serverResult?.failed ?? 0) + (browserResult?.results.failed ?? 0)
    reporter.onSummary(totalPassed, totalFailed, performance.now() - startTime)

    if (values.browserOpen && browserResult) {
      console.log('\nBrowser is open. Press Ctrl+C to close.')
      await Promise.race([
        browserResult.disconnected,
        new Promise<void>((resolve) => {
          process.once('SIGINT', resolve)
          process.once('SIGTERM', resolve)
        }),
      ])
      await browserResult.close()
    }

    latestExitCode = totalFailed > 0 ? 1 : 0
  } catch (error) {
    console.error('Error running tests:', error)
    latestExitCode = 1
  } finally {
    running = false
    if (queued) {
      queued = false
      queueRerun('queued change')
    } else if (!values.watch) {
      cleanupAndExit(latestExitCode)
    }
  }
}

async function discoverTests(pattern: string): Promise<string[]> {
  let files: string[] = []
  let exclude = ['node_modules/**', '.git/**']

  for await (let file of fsp.glob(pattern, { cwd: process.cwd(), exclude })) {
    files.push(path.resolve(process.cwd(), file))
  }

  return files.sort()
}

function queueRerun(reason: string) {
  if (!values.watch || hasExited) return

  clearTimeout(rerunTimer)

  rerunTimer = setTimeout(() => {
    rerunTimer = undefined
    if (running) {
      queued = true
    } else {
      console.log(`\n↻ Change detected (${reason}), re-running tests...\n`)
      void executeRun()
    }
  }, 100)
}

function cleanupAndExit(code: number) {
  if (hasExited) return
  hasExited = true
  watcher?.close()
  browserServer?.close()
  process.exit(code)
}
