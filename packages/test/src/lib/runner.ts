import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { IS_RUNNING_FROM_SRC } from './config.ts'
import {
  collectCoverageMapFromPlaywright,
  collectServerCoverageMap,
  type CoverageConfig,
  type CoverageMap,
  type V8CoverageEntry,
} from './coverage.ts'
import { type PlaywrightUseOpts } from './playwright.ts'
import type { Reporter } from './reporters/index.ts'
import type { Counts, TestResults } from './reporters/results.ts'

// Ensure we load the right file whether we're running in the monorepo (TS) or
// from a published package (JS)
const ext = IS_RUNNING_FROM_SRC ? '.ts' : '.js'
const workerUrl = new URL(`./worker${ext}`, import.meta.url)
const workerE2EUrl = new URL(`./worker-e2e${ext}`, import.meta.url)

export async function runServerTests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  type: 'server' | 'e2e',
  options: {
    cwd?: string
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
    projectName?: string
    coverage?: CoverageConfig
  } = {},
): Promise<Counts & { coverageMap: CoverageMap | null }> {
  let counts: Counts = { passed: 0, failed: 0, skipped: 0, todo: 0 }
  let coverageMap: CoverageMap | null = null
  let cwd = options.cwd ?? process.cwd()
  let envLabel = options.projectName ? `${type}:${options.projectName}` : type

  function accumulate(results: TestResults, file: string) {
    reporter.onResult(
      { ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) },
      envLabel,
    )
    counts.passed += results.passed
    counts.failed += results.failed
    counts.skipped += results.skipped
    counts.todo += results.todo
  }

  if (type === 'e2e') {
    let allBrowserCoverageEntries: Array<{ entries: V8CoverageEntry[]; baseUrl: string }> = []

    await runInConcurrentWorkers(
      files,
      concurrency,
      (file) =>
        runFileInWorker(
          file,
          type,
          (results) => {
            accumulate(results, file)
            if (results.e2eBrowserCoverageEntries) {
              allBrowserCoverageEntries.push(...results.e2eBrowserCoverageEntries)
            }
          },
          {
            ...options,
            playwrightUseOpts: options.playwrightUseOpts,
          },
        ),
      () => counts.failed++,
    )

    if (options.coverage && allBrowserCoverageEntries.length > 0) {
      coverageMap = await collectCoverageMapFromPlaywright(
        allBrowserCoverageEntries.flatMap((e) => e.entries),
        cwd,
        new Set(files),
        async (urlPath) => (urlPath.startsWith('/') ? urlPath.slice(1) : urlPath),
      )
    }
  } else {
    let coverageDataDir: string | undefined
    if (options.coverage) {
      coverageDataDir = path.resolve(cwd, options.coverage.dir)
      await fsp.mkdir(coverageDataDir, { recursive: true })
      process.env.NODE_V8_COVERAGE = coverageDataDir
    }

    await runInConcurrentWorkers(
      files,
      concurrency,
      (file) => runFileInWorker(file, type, (results) => accumulate(results, file), options),
      () => counts.failed++,
    )

    if (coverageDataDir) {
      delete process.env.NODE_V8_COVERAGE
      let serverMap = await collectServerCoverageMap(coverageDataDir, cwd, new Set(files))
      coverageMap = serverMap
    }
  }

  return { ...counts, coverageMap }
}

async function runInConcurrentWorkers(
  files: string[],
  concurrency: number,
  runFile: (file: string) => Promise<void>,
  onError: () => void,
): Promise<void> {
  let index = 0
  let active = 0

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (active < concurrency && index < files.length) {
        let file = files[index]
        index++
        active++

        runFile(file).then(
          () => {
            active--
            if (index < files.length) {
              dispatch()
            } else if (active === 0) {
              resolve()
            }
          },
          (err) => {
            console.error(`Error running ${file}:`, err.message)
            console.error(err)
            onError()
            active--
            if (active === 0 && index >= files.length) resolve()
            else dispatch()
          },
        )
      }

      if (index >= files.length && active === 0) resolve()
    }

    dispatch()
  })
}

function runFileInWorker(
  file: string,
  type: 'server' | 'e2e',
  onResults: (results: TestResults) => void,
  options: {
    cwd?: string
    coverage?: CoverageConfig
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let didSettle = false
    let worker =
      type === 'e2e'
        ? new Worker(workerE2EUrl, {
            workerData: {
              file: pathToFileURL(file).href,
              type,
              coverage: options.coverage,
              open: options.open,
              playwrightUseOpts: options.playwrightUseOpts,
            },
          })
        : new Worker(workerUrl, {
            workerData: {
              file: pathToFileURL(file).href,
              type,
              coverage: options.coverage,
            },
          })
    worker.once('message', async (msg: TestResults) => {
      onResults(msg)

      try {
        // Explicitly terminate workers to avoid hanging on leaked handles.
        await worker.terminate()
      } catch (error) {
        if (!didSettle) {
          didSettle = true
          reject(error)
        }
        return
      }

      if (!didSettle) {
        didSettle = true
        resolve()
      }
    })
    worker.once('error', (error) => {
      if (!didSettle) {
        didSettle = true
        reject(error)
      }
    })
    worker.once('exit', (code) => {
      if (!didSettle && code !== 0) {
        didSettle = true
        reject(new Error(`Worker exited with code ${code}`))
      }
    })
  })
}
