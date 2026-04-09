import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import type { TestResults } from './executor.ts'
import { type PlaywrightUseOpts } from './playwright.ts'
import type { Reporter } from './reporters/index.ts'
import type { Counts } from './utils.ts'
import { IS_RUNNING_FROM_SRC } from './config.ts'

const workerUrl = new URL(IS_RUNNING_FROM_SRC ? `./worker.ts` : `./worker.js`, import.meta.url)
const workerE2EUrl = new URL(
  IS_RUNNING_FROM_SRC ? `./worker-e2e.ts` : `./worker-e2e.js `,
  import.meta.url,
)

export async function runServerTests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  type: 'server' | 'e2e',
  options: {
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
    projectName?: string
  } = {},
): Promise<Counts> {
  let counts: Counts = { passed: 0, failed: 0, skipped: 0, todo: 0 }
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
    await runInConcurrentWorkers(
      files,
      concurrency,
      (file) =>
        runFileInWorker(file, type, (results) => accumulate(results, file), {
          ...options,
          playwrightUseOpts: options.playwrightUseOpts,
        }),
      () => counts.failed++,
    )
  } else {
    await runInConcurrentWorkers(
      files,
      concurrency,
      (file) => runFileInWorker(file, type, (results) => accumulate(results, file)),
      () => counts.failed++,
    )
  }

  return { ...counts }
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
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let worker =
      type === 'e2e'
        ? new Worker(workerE2EUrl, {
            workerData: {
              file: pathToFileURL(file).href,
              type,
              open: options.open,
              playwrightUseOpts: options.playwrightUseOpts,
            },
          })
        : new Worker(workerUrl, {
            workerData: {
              file: pathToFileURL(file).href,
              type,
            },
          })
    worker.once('message', (msg: TestResults) => onResults(msg))
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`))
      else resolve()
    })
  })
}
