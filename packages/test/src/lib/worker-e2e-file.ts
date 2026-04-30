import { runTests } from './executor.ts'
import { importModule } from './import-module.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
  type PlaywrightUseOpts,
} from './playwright.ts'
import type { CoverageConfig } from './coverage.ts'
import type { TestResults } from './reporters/results.ts'
import { createFailedResults } from './worker-results.ts'
import { isRecord, parseCoverageConfig } from './worker-server.ts'

export interface E2ETestWorkerData {
  file: string
  coverage?: CoverageConfig
  open?: boolean
  playwrightUseOpts?: PlaywrightUseOpts
}

export async function runE2ETestFile(
  value: unknown,
  onOpenResults?: (results: TestResults) => void | Promise<void>,
): Promise<TestResults | undefined> {
  try {
    let workerData = parseE2ETestWorkerData(value)

    await importModule(workerData.file, import.meta)

    let launcher = await getBrowserLauncher(workerData.playwrightUseOpts)
    let opts = getPlaywrightLaunchOptions(workerData.playwrightUseOpts)
    let browser = await launcher.launch(opts)
    let browserClosed = false

    try {
      let results = await runTests({
        browser,
        open: workerData.open ?? false,
        playwrightPageOptions: getPlaywrightPageOptions(workerData.playwrightUseOpts),
        coverage: !!workerData.coverage,
      })

      if (workerData.open) {
        await onOpenResults?.(results)
        console.log('\nBrowser is open. Press Ctrl+C to close.')
        await new Promise<void>((resolve) => browser.on('disconnected', () => resolve()))
        return undefined
      }

      await browser.close()
      browserClosed = true
      return results
    } finally {
      if (!browserClosed) {
        await browser.close()
      }
    }
  } catch (error) {
    return createFailedResults(error)
  }
}

function parseE2ETestWorkerData(value: unknown): E2ETestWorkerData {
  if (!isRecord(value) || typeof value.file !== 'string') {
    throw new Error('Invalid E2E test worker data')
  }

  return {
    file: value.file,
    coverage: parseCoverageConfig(value.coverage),
    open: parseBoolean(value.open, 'open'),
    playwrightUseOpts: parsePlaywrightUseOpts(value.playwrightUseOpts),
  }
}

function parseBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Invalid E2E test worker ${name}`)
  }

  return value
}

function parsePlaywrightUseOpts(value: unknown): PlaywrightUseOpts | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!isRecord(value)) {
    throw new Error('Invalid E2E test worker playwright options')
  }

  return value as PlaywrightUseOpts
}
