import { workerData, parentPort } from 'node:worker_threads'
import { tsImport } from 'tsx/esm/api'
import { runTests } from './executor.ts'

await tsImport(workerData.file, import.meta.url)

let results = await runTests()
parentPort!.postMessage(results)
