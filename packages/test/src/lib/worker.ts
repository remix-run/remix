import { workerData, parentPort } from 'node:worker_threads'
import { tsImport } from 'tsx/esm/api'
import { runTests, type TestResults } from './executor.ts'

try {
  await tsImport(workerData.file, import.meta.url)

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
