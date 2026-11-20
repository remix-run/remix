import { fork, type ChildProcess } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { IS_RUNNING_FROM_SRC, type RemixTestPool, type SerializedOnlyPattern } from './config.ts'
import {
  collectCoverageMapFromPlaywright,
  collectServerCoverageMap,
  type CoverageConfig,
  type CoverageMap,
  type V8CoverageEntry,
} from './coverage.ts'
import type { PlaywrightUseOpts } from './playwright.ts'
import { resolveFileTimeout, withFileTimeout } from './file-timeout.ts'
import { createFailedResults } from './worker-results.ts'
import type { Reporter } from './reporters/index.ts'
import type { Counts, TestResults } from './reporters/results.ts'

// Ensure we load the right file whether we're running in the monorepo (TS) or
// from a published package (JS)
const ext = IS_RUNNING_FROM_SRC ? '.ts' : '.js'
const workerUrl = new URL(`./worker${ext}`, import.meta.url)
const workerE2EUrl = new URL(`./worker-e2e${ext}`, import.meta.url)
const workerProcessUrl = new URL(`./worker-process${ext}`, import.meta.url)
const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 10_000

interface WorkerRun {
  finished: Promise<void>
  exited: Promise<number | null>
  terminate(): Promise<boolean>
}

interface RunFileOptions {
  cwd?: string
  coverage?: CoverageConfig
  open?: boolean
  only?: SerializedOnlyPattern[]
  playwrightUseOpts?: PlaywrightUseOpts
  pool?: RemixTestPool
}

export async function runServerTests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  type: 'server' | 'e2e',
  options: {
    cwd?: string
    fileTimeout?: number
    open?: boolean
    only?: SerializedOnlyPattern[]
    playwrightUseOpts?: PlaywrightUseOpts
    projectName?: string
    coverage?: CoverageConfig
    workerShutdownTimeoutMs?: number
    pool?: RemixTestPool
  } = {},
): Promise<Counts & { coverageMap: CoverageMap | null }> {
  let counts: Counts = { passed: 0, failed: 0, skipped: 0, todo: 0 }
  let coverageMap: CoverageMap | null = null
  let cwd = options.cwd ?? process.cwd()
  let envLabel = options.projectName ? `${type}:${options.projectName}` : type
  let pool = options.pool ?? 'forks'
  let fileTimeout = resolveFileTimeout(options.fileTimeout)

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
      (file, signal) =>
        runFileInPool(
          file,
          type,
          (results) => {
            if (signal.aborted) return
            accumulate(results, file)
            if (results.e2eBrowserCoverageEntries) {
              allBrowserCoverageEntries.push(...results.e2eBrowserCoverageEntries)
            }
          },
          {
            ...options,
            pool,
            playwrightUseOpts: options.playwrightUseOpts,
          },
        ),
      (file, error) => accumulate(createFailedResults(error), file),
      !options.open,
      options.workerShutdownTimeoutMs ?? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS,
      fileTimeout,
      envLabel,
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
      (file, signal) =>
        runFileInPool(
          file,
          type,
          (results) => {
            if (!signal.aborted) accumulate(results, file)
          },
          { ...options, pool },
        ),
      (file, error) => accumulate(createFailedResults(error), file),
      true,
      options.workerShutdownTimeoutMs ?? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS,
      fileTimeout,
      envLabel,
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
  runFile: (file: string, signal: AbortSignal) => WorkerRun,
  onError: (file: string, error: unknown) => void,
  terminateWhenFinished: boolean,
  workerShutdownTimeoutMs: number,
  fileTimeout: number,
  environment: string,
): Promise<void> {
  let index = 0
  let active = 0

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (active < concurrency && index < files.length) {
        let file = files[index]
        index++
        active++

        let run: WorkerRun | undefined
        let finished = withFileTimeout(file, environment, fileTimeout, (signal) => {
          run = runFile(file, signal)
          return run.finished
        })

        function complete() {
          active--
          if (index < files.length) {
            dispatch()
          } else if (active === 0) {
            resolve()
          }
        }

        finished.then(
          async () => {
            try {
              if (!run) return
              if (terminateWhenFinished) {
                let exited = await waitForWorkerExit(run.exited, workerShutdownTimeoutMs)
                if (!exited) {
                  let terminated = await run.terminate()
                  if (!terminated) {
                    onError(file, new Error(`Failed to terminate worker for ${file}`))
                  }
                }
              } else {
                await run.exited
              }
            } finally {
              complete()
            }
          },
          async (err) => {
            try {
              console.error(`Error running ${file}:`, err instanceof Error ? err.message : err)
              console.error(err)
              onError(file, err)
              await run?.terminate()
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

function waitForWorkerExit(exited: Promise<number | null>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timeout = setTimeout(() => resolve(false), timeoutMs)
    exited.then(() => {
      clearTimeout(timeout)
      resolve(true)
    })
  })
}

function runFileInPool(
  file: string,
  type: 'server' | 'e2e',
  onResults: (results: TestResults) => void,
  options: RunFileOptions,
): WorkerRun {
  return options.pool === 'threads'
    ? runFileInWorker(file, type, onResults, options)
    : runFileInProcess(file, type, onResults, options)
}

export function runFileInWorker(
  file: string,
  type: 'server' | 'e2e',
  onResults: (results: TestResults) => void,
  options: RunFileOptions = {},
): WorkerRun {
  let receivedResults = false
  let worker =
    type === 'e2e'
      ? new Worker(workerE2EUrl, {
          workerData: {
            file: pathToFileURL(file).href,
            type,
            coverage: options.coverage,
            only: options.only,
            open: options.open,
            playwrightUseOpts: options.playwrightUseOpts,
          },
        })
      : new Worker(workerUrl, {
          workerData: {
            file: pathToFileURL(file).href,
            type,
            coverage: options.coverage,
            only: options.only,
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
      resolve()
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
    finished,
    exited,
    async terminate() {
      try {
        await worker.terminate()
        return true
      } catch (err) {
        console.error(
          `Error terminating worker for ${file}:`,
          err instanceof Error ? err.message : err,
        )
        console.error(err)
        return false
      }
    },
  }
}

function runFileInProcess(
  file: string,
  type: 'server' | 'e2e',
  onResults: (results: TestResults) => void,
  options: RunFileOptions = {},
): WorkerRun {
  let receivedResults = false
  let child = fork(fileURLToPath(workerProcessUrl), [], {
    serialization: 'advanced',
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })

  let exited = new Promise<number | null>((resolve) => {
    child.once('exit', (code) => resolve(code))
  })

  let finished = new Promise<void>((resolve, reject) => {
    child.once('message', (msg: unknown) => {
      if (!isTestResults(msg)) {
        reject(new Error('Test worker process sent invalid results'))
        return
      }

      receivedResults = true
      try {
        onResults(msg)
      } catch (error) {
        reject(error)
        return
      }
      resolve()
    })
    child.once('error', reject)
    exited.then((code) => {
      if (receivedResults || code === 0) {
        resolve()
      } else {
        reject(new Error(`Worker process exited with code ${code}`))
      }
    })
    child.send(
      {
        file: pathToFileURL(file).href,
        type,
        coverage: options.coverage,
        only: options.only,
        open: options.open,
        playwrightUseOpts: options.playwrightUseOpts,
      },
      (error) => {
        if (error) {
          reject(error)
        }
      },
    )
  })

  return {
    finished,
    exited,
    terminate: () => terminateChildProcess(child, exited),
  }
}

async function terminateChildProcess(
  child: ChildProcess,
  exited: Promise<number | null>,
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return true
  }

  if (child.kill() && (await waitForWorkerExit(exited, 5_000))) return true
  // A test can install a SIGTERM handler; its deadline must still release the worker slot.
  return child.kill('SIGKILL') && (await waitForWorkerExit(exited, 5_000))
}

function isTestResults(value: unknown): value is TestResults {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.passed === 'number' &&
    typeof value.failed === 'number' &&
    typeof value.skipped === 'number' &&
    typeof value.todo === 'number' &&
    Array.isArray(value.tests)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
