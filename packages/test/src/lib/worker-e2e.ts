import { workerData, parentPort } from 'node:worker_threads'
import { runTests } from './executor.ts'
import { importModule } from './import-module.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
} from './playwright.ts'
import type { TestResults } from './reporters/results.ts'

try {
  await importModule(workerData.file, import.meta)

  let launcher = await getBrowserLauncher(workerData.playwrightUseOpts)
  let opts = getPlaywrightLaunchOptions(workerData.playwrightUseOpts)
  let browser = await launcher.launch(opts)
  let browserClosed = false
  try {
    let results = await runTests({
      browser,
      open: workerData.open,
      playwrightPageOptions: getPlaywrightPageOptions(workerData.playwrightUseOpts),
      coverage: workerData.coverage,
    })
    if (workerData.open) {
      parentPort!.postMessage(results)
      console.log('\nBrowser is open. Press Ctrl+C to close.')
      await new Promise<void>((resolve) => browser.on('disconnected', () => resolve()))
    } else {
      await browser.close()
      browserClosed = true
      parentPort!.postMessage(results)
    }
  } finally {
    if (!browserClosed) {
      await browser.close()
    }
  }
  process.exit(0)
} catch (e) {
  let results: TestResults = {
    passed: 0,
    failed: 1,
    skipped: 0,
    todo: 0,
    tests: [
      {
        name: '',
        suiteName: '',
        status: 'failed',
        duration: 0,
        error: {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        },
      },
    ],
  }
  parentPort!.postMessage(results)
  process.exit(0)
}
