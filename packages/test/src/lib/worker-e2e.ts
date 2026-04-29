import { runTests } from './executor.ts'
import { importModule } from './import-module.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
} from './playwright.ts'
import type { TestResults } from './reporters/results.ts'
import { closeWorkerChannel, receiveData, sendResults, type E2EWorkerPayload } from './channel.ts'

const workerData = await receiveData<E2EWorkerPayload>()

try {
  await importModule(workerData.file, import.meta)

  let launcher = await getBrowserLauncher(workerData.playwrightUseOpts)
  let opts = getPlaywrightLaunchOptions(workerData.playwrightUseOpts)
  let browser = await launcher.launch(opts)
  try {
    let results = await runTests({
      browser,
      open: workerData.open ?? false,
      playwrightPageOptions: getPlaywrightPageOptions(workerData.playwrightUseOpts),
      coverage: workerData.coverage,
    })
    await sendResults(results)
    if (workerData.open) {
      console.log('\nBrowser is open. Press Ctrl+C to close.')
      await new Promise<void>((resolve) => browser.on('disconnected', () => resolve()))
    }
  } finally {
    await browser.close()
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
  await sendResults(results)
} finally {
  closeWorkerChannel()
}
