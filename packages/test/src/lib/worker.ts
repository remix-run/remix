import { workerData, parentPort } from 'node:worker_threads'
import { runTests, type TestResults } from './executor.ts'
import { importModule } from './import-module.ts'

try {
  await importModule(workerData.file, import.meta)

  let results = await runTests()
  parentPort!.postMessage(results)
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
