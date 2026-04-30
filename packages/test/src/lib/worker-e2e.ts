import { runTests } from './executor.ts'
import { importModule } from './import-module.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
  type PlaywrightUseOpts,
} from './playwright.ts'
import type { TestResults } from './reporters/results.ts'
import { closeWorkerChannel, receiveWorkerData, sendResults } from './worker-channel.ts'

interface E2EWorkerData {
  file: string
  type: 'e2e'
  coverage: boolean
  open?: boolean
  playwrightUseOpts?: PlaywrightUseOpts
}

const workerData = await receiveWorkerData<E2EWorkerData>()

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
  closeWorkerChannel()
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
  await sendResults(results).finally(() => closeWorkerChannel())
}
