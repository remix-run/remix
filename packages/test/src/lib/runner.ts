import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import type { TestResults } from './executor.ts'
import type { Reporter } from './reporter.ts'
import { collectServerCoverageMap, type CoverageConfig, type CoverageMap } from './coverage.ts'
import type { Counts } from './utils.ts'

const workerUrl = new URL('./worker.ts', import.meta.url)

export async function runServerTests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  type: 'server' | 'e2e',
  options: {
    coverage?: CoverageConfig
  } = {},
): Promise<Counts & { coverageMap: CoverageMap | null }> {
  let counts: Counts = { passed: 0, failed: 0, skipped: 0, todo: 0 }
  let envLabel = type

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

  let coverageDataDir: string | undefined
  if (options.coverage) {
    coverageDataDir = path.resolve(options.coverage.dir)
    await fsp.mkdir(coverageDataDir, { recursive: true })
    process.env.NODE_V8_COVERAGE = coverageDataDir
  }

  await runInConcurrentWorkers(
    files,
    concurrency,
    (file) => runFileInWorker(file, type),
    accumulate,
    () => counts.failed++,
  )

  let coverageMap: CoverageMap | null = null
  if (coverageDataDir) {
    delete process.env.NODE_V8_COVERAGE
    let serverMap = await collectServerCoverageMap(coverageDataDir, process.cwd(), new Set(files))
    coverageMap = serverMap
  }

  return { ...counts, coverageMap }
}

async function runInConcurrentWorkers(
  files: string[],
  concurrency: number,
  runFile: (file: string) => Promise<TestResults>,
  onResult: (results: TestResults, file: string) => void,
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
          (results) => {
            onResult(results, file)
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
  options: {
    coverage?: CoverageConfig
  } = {},
): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    let worker = new Worker(workerUrl, {
      workerData: {
        file: pathToFileURL(file).href,
        type,
        coverage: options.coverage,
      },
    })
    let results: TestResults | undefined
    worker.once('message', (msg) => {
      results = msg
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`))
      else if (results) resolve(results)
      else reject(new Error('Worker exited without sending results'))
    })
  })
}
