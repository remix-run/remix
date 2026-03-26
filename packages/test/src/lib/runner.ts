import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { tsImport } from 'tsx/esm/api'
import type { Browser } from 'playwright/test'
import { createServer } from './e2e-server.ts'
import { runTests } from './executor.ts'
import type { TestResults } from './executor.ts'
import type { Reporter } from './reporter.ts'
import {
  collectServerCoverageMap,
  collectE2EBrowserCoverageMap,
  type CoverageConfig,
  type CoverageMap,
} from './coverage.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
  type PlaywrightUseOpts,
} from './playwright.ts'
import type { Counts } from './utils.ts'

const workerUrl = new URL('./worker.ts', import.meta.url)

export async function runServerTests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  type: 'server' | 'e2e',
  options: {
    coverage?: CoverageConfig
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
    projectName?: string
  } = {},
): Promise<Counts & { coverageMap: CoverageMap | null }> {
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

  if (concurrency === 0) {
    if (options.coverage) {
      console.warn('Warning: --coverage is not supported with -c 0, skipping coverage.')
    }
    await runInProcess(files, counts, accumulate, type, {
      open: options.open,
      playwrightUseOpts: options.playwrightUseOpts,
    })
    return { ...counts, coverageMap: null }
  }

  let coverageDataDir: string | undefined
  if (options.coverage) {
    coverageDataDir = path.resolve(options.coverage.dir)
    await fsp.mkdir(coverageDataDir, { recursive: true })
    process.env.NODE_V8_COVERAGE = coverageDataDir
  }

  let allE2ECoverageEntries: Array<{ entries: any[]; baseUrl: string }> = []

  if (type === 'e2e') {
    await runInConcurrentWorkers(
      files,
      concurrency,
      (file) =>
        runFileInWorker(file, type, {
          ...options,
          playwrightUseOpts: options.playwrightUseOpts,
        }),
      (results, file) => {
        accumulate(results, file)
        if (results.e2eBrowserCoverageEntries) {
          allE2ECoverageEntries.push(...results.e2eBrowserCoverageEntries)
        }
      },
      () => counts.failed++,
    )
  } else {
    await runInConcurrentWorkers(
      files,
      concurrency,
      (file) => runFileInWorker(file, type),
      accumulate,
      () => counts.failed++,
    )
  }

  let coverageMap: CoverageMap | null = null
  if (coverageDataDir) {
    delete process.env.NODE_V8_COVERAGE
    let serverMap = await collectServerCoverageMap(coverageDataDir, process.cwd(), new Set(files))
    let e2eBrowserMap =
      allE2ECoverageEntries.length > 0
        ? await collectE2EBrowserCoverageMap(allE2ECoverageEntries, process.cwd())
        : null
    if (serverMap && e2eBrowserMap) {
      serverMap.merge(e2eBrowserMap)
      coverageMap = serverMap
    } else {
      coverageMap = serverMap ?? e2eBrowserMap
    }
  }

  return { ...counts, coverageMap }
}

async function runInProcess(
  files: string[],
  counts: Counts,
  accumulate: (results: TestResults, file: string) => void,
  type: 'server' | 'e2e',
  options: {
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
  } = {},
): Promise<void> {
  let browser: Browser | undefined

  for (let file of files) {
    try {
      await tsImport(file, {
        parentURL: import.meta.url,
        tsconfig: new URL('../../tsconfig.json', import.meta.url).pathname,
      })

      if (type === 'e2e') {
        browser ??= await getBrowserLauncher(options.playwrightUseOpts).launch(
          getPlaywrightLaunchOptions(options.playwrightUseOpts),
        )
        try {
          let results = await runTests({
            browser,
            createServer,
            open: options.open,
            playwrightPageOptions: getPlaywrightPageOptions(options.playwrightUseOpts),
          })
          accumulate(results, file)
        } catch (e) {
          await browser?.close()
          throw e
        } finally {
          if (options.open) {
            console.log('\nBrowser is open. Press Ctrl+C to close.')
            await new Promise<void>((resolve) => browser!.on('disconnected', () => resolve()))
          } else {
            await browser.close()
            browser = undefined
          }
        }
      } else {
        let results = await runTests()
        accumulate(results, file)
      }
    } catch (err: any) {
      console.error(`Error running ${file}:`, err.message)
      counts.failed++
    }
  }
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
    open?: boolean
    playwrightUseOpts?: PlaywrightUseOpts
  } = {},
): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    let worker = new Worker(workerUrl, {
      workerData: {
        file: pathToFileURL(file).href,
        type,
        open: options.open,
        coverage: options.coverage,
        playwrightUseOpts: options.playwrightUseOpts,
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
