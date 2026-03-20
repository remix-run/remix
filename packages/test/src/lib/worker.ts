import { workerData, parentPort } from 'node:worker_threads'
import { tsImport } from 'tsx/esm/api'
import { runTests } from './executor.ts'

// Node 22 native TS stripping handles .ts files but not JSX in .tsx files,
// so fall back to tsImport for tsx files.
if (workerData.file.endsWith('.tsx')) {
  await tsImport(workerData.file, import.meta.url)
} else {
  await import(workerData.file)
}

let results = await runTests()
parentPort!.postMessage(results)
