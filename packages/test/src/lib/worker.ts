import { workerData, parentPort } from 'node:worker_threads'
import { tsImport } from 'tsx/esm/api'
import { createServer } from './e2e-server.ts'
import { runTests, type TestResults } from './executor.ts'
import { getBrowserLauncher, getPlaywrightLaunchOptions, getPlaywrightPageOptions } from './playwright.ts'

try {
  await tsImport(workerData.file, import.meta.url)

  if (workerData.type === 'e2e') {
    let browser = await getBrowserLauncher(workerData.playwrightUseOpts).launch(
      getPlaywrightLaunchOptions(workerData.playwrightUseOpts),
    )
    try {
      let results = await runTests({
        browser,
        createServer,
        coverage: workerData.coverage,
        open: workerData.open,
        playwrightPageOptions: getPlaywrightPageOptions(workerData.playwrightUseOpts),
      })
      parentPort!.postMessage(results)
      if (workerData.open) {
        console.log('\nBrowser is open. Press Ctrl+C to close.')
        await new Promise<void>((resolve) => browser.on('disconnected', () => resolve()))
      }
    } finally {
      await browser.close()
    }
  } else {
    let results = await runTests()
    parentPort!.postMessage(results)
  }
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
}
