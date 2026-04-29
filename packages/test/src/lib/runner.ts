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
const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 10_000

interface WorkerRun {
  worker: Worker
  finished: Promise<void>
  exited: Promise<number>
}

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
    workerShutdownTimeoutMs?: number
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
      !options.open,
      options.workerShutdownTimeoutMs ?? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS,
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
      true,
      options.workerShutdownTimeoutMs ?? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS,
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
  runFile: (file: string) => WorkerRun,
  onError: () => void,
  terminateWhenFinished: boolean,
  workerShutdownTimeoutMs: number,
): Promise<void> {
  let index = 0
  let active = 0

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (active < concurrency && index < files.length) {
        let file = files[index]
        index++
        active++

        let run = runFile(file)

        function complete() {
          active--
          if (index < files.length) {
            dispatch()
          } else if (active === 0) {
            resolve()
          }
        }

        async function terminate(): Promise<boolean> {
          try {
            await run.worker.terminate()
            return true
          } catch (err) {
            console.error(
              `Error terminating worker for ${file}:`,
              err instanceof Error ? err.message : err,
            )
            console.error(err)
            return false
          }
        }

        run.finished.then(
          async () => {
            try {
              if (terminateWhenFinished) {
                let exited = await waitForWorkerExit(run.exited, workerShutdownTimeoutMs)
                if (!exited) {
                  let terminated = await terminate()
                  if (!terminated) {
                    onError()
                  }
                }
              }
            } finally {
              complete()
            }
          },
          async (err) => {
            try {
              console.error(`Error running ${file}:`, err instanceof Error ? err.message : err)
              console.error(err)
              onError()
              await terminate()
            } finally {
              complete()
            }
          },
        )
      }

      if (index >= files.length && active === 0) resolve()
    }

    dispatch()
  })
}

function waitForWorkerExit(exited: Promise<number>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timeout = setTimeout(() => resolve(false), timeoutMs)
    exited.then(() => {
      clearTimeout(timeout)
      resolve(true)
    })
  })
}

export function runFileInWorker(
  file: string,
  type: 'server' | 'e2e',
  onResults: (results: TestResults) => void,
  options: {
    cwd?: string
    coverage?: CoverageConfig
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
  } = {},
): WorkerRun {
  let receivedResults = false
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

  let exited = new Promise<number>((resolve) => {
    worker.once('exit', (code) => resolve(code))
  })

  let finished = new Promise<void>((resolve, reject) => {
    worker.once('message', (msg: TestResults) => {
      receivedResults = true
      try {
        onResults(msg)
      } catch (error) {
        reject(error)
        return
      }
      if (!options.open) {
        resolve()
      }
    })
    worker.once('error', reject)
    exited.then((code) => {
      if (receivedResults || code === 0) {
        resolve()
      } else {
        reject(new Error(`Worker exited with code ${code}`))
      }
    })
  })

  return {
    worker,
    finished,
    exited,
  }
}
