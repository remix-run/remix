import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import type { TestResults } from './executor.ts'
import type { Reporter } from './reporter.ts'

let workerUrl = new URL('./worker.ts', import.meta.url)

function runFile(file: string): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    let worker = new Worker(fileURLToPath(workerUrl), {
      workerData: { file },
    })
    worker.once('message', resolve)
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`))
    })
  })
}

export async function runServerTests(
  files: string[],
  reporter: Reporter,
): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (let file of files) {
    let results = await runFile(file)
    reporter.onResult({ ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) }, 'server')
    passed += results.passed
    failed += results.failed
  }

  return { passed, failed }
}
