import * as cp from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
import type { E2EWorkerPayload, WorkerPayload } from './channel.ts'

// Ensure we load the right file whether we're running in the monorepo (TS) or
// from a published package (JS)
const ext = IS_RUNNING_FROM_SRC ? '.ts' : '.js'
const workerUrl = new URL(`./worker${ext}`, import.meta.url)
const workerE2EUrl = new URL(`./worker-e2e${ext}`, import.meta.url)
const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 10_000

interface WorkerRun {
  finished: Promise<void>
  exited: Promise<number>
  terminate: () => Promise<void>
}

type RunTestsOptions =
  | {
      type: 'server'
      coverage: CoverageConfig | undefined
      cwd: string
      pool: 'threads' | 'forks'
      workerShutdownTimeoutMs?: number
    }
  | {
      type: 'e2e'
      coverage: CoverageConfig | undefined
      cwd: string
      open: boolean
      pool: 'threads' | 'forks'
      playwrightUseOpts: PlaywrightUseOpts
      projectName: string | undefined
      workerShutdownTimeoutMs?: number
    }

export async function runServerTests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  options: RunTestsOptions,
): Promise<Counts & { coverageMap: CoverageMap | null }> {
  let counts: Counts = { passed: 0, failed: 0, skipped: 0, todo: 0 }
  let coverageMap: CoverageMap | null = null
  let cwd = options.cwd ?? process.cwd()
  let envLabel =
    options.type === 'e2e' && options.projectName
      ? `${options.type}:${options.projectName}`
      : options.type

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

  if (options.type === 'e2e') {
    let allBrowserCoverageEntries: Array<{ entries: V8CoverageEntry[]; baseUrl: string }> = []

    await runInConcurrentWorkers(
      files,
      concurrency,
      (file) =>
        runFileInWorkerOrThread(file, options, (results) => {
          accumulate(results, file)
          if (results.e2eBrowserCoverageEntries) {
            allBrowserCoverageEntries.push(...results.e2eBrowserCoverageEntries)
          }
        }),
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
      (file) => runFileInWorkerOrThread(file, options, (results) => accumulate(results, file)),
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
            await run.terminate()
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

function runFileInWorkerThread(
  file: URL,
  payload: WorkerPayload | E2EWorkerPayload,
  onResults: (results: TestResults) => void,
): WorkerRun {
  let receivedResults = false
  let worker = new Worker(file, { workerData: payload })
  let exited = new Promise<number>((resolve) => {
    worker.once('exit', (code) => resolve(code))
  })
  let finished = new Promise<void>((resolve, reject) => {
    worker.once('message', (msg: TestResults) => {
      receivedResults = true
      try {
        onResults(msg)
        if (payload.type !== 'e2e' || !payload.open) {
          resolve()
        }
      } catch (error) {
        reject(error)
        return
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
    finished,
    exited,
    async terminate() {
      await worker.terminate()
    },
  }
}

function runFileInForkedProcess(
  workerScript: URL,
  payload: WorkerPayload | E2EWorkerPayload,
  onResults: (results: TestResults) => void,
): WorkerRun {
  let receivedResults = false
  // child_process.fork inherits `execArgv` from the parent by default, so any
  // TypeScript loader hooks (e.g. tsx, Node's strip-types) keep working in
  // the child. The IPC channel carries the workerData payload as the first
  // message and the test results as the reply.
  let child = cp.fork(fileURLToPath(workerScript), [], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })
  let exited = new Promise<number>((resolve, reject) => {
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(code)
      else if (signal) reject(new Error(`Forked process killed by signal ${signal}`))
      else reject(new Error(`Forked process exited with code ${code}`))
    })
  })
  let finished = new Promise<void>((resolve, reject) => {
    child.once('message', (msg) => {
      receivedResults = true
      try {
        onResults(msg as TestResults)
        if (payload.type !== 'e2e' || !payload.open) {
          resolve()
        }
      } catch (error) {
        reject(error)
        return
      }
    })
    child.once('error', reject)

    exited.then((code) => {
      if (receivedResults || code === 0) {
        resolve()
      } else {
        reject(new Error(`Worker exited with code ${code}`))
      }
    })

    child.send(payload, (err) => {
      if (err) reject(err)
    })
  })

  return {
    finished,
    exited,
    async terminate() {
      return new Promise((resolve, reject) => {
        if (child.kill()) {
          resolve()
        } else {
          reject(new Error('Unable to kill forked process'))
        }
      })
    },
  }
}

function runFileInWorkerOrThread(
  file: string,
  options: RunTestsOptions,
  onResults: (results: TestResults) => void,
): WorkerRun {
  let runner = options.pool === 'forks' ? runFileInForkedProcess : runFileInWorkerThread
  if (options.type === 'server') {
    return runner(
      workerUrl,
      {
        file: pathToFileURL(file).href,
        type: 'server',
        coverage: options.coverage,
      },
      onResults,
    )
  } else {
    return runner(
      workerE2EUrl,
      {
        file: pathToFileURL(file).href,
        type: 'e2e',
        coverage: options.coverage,
        open: options.open === true,
        playwrightUseOpts: options.playwrightUseOpts,
      },
      onResults,
    )
  }
}
