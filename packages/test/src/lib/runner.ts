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
  concurrency: number,
): Promise<{ passed: number; failed: number; skipped: number; todo: number }> {
  let passed = 0
  let failed = 0
  let skipped = 0
  let todo = 0

  // Run up to `concurrency` workers at a time, streaming results to the
  // reporter as each file finishes rather than waiting for all to complete.
  let index = 0
  let active = 0

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (active < concurrency && index < files.length) {
        let file = files[index]
        index++
        active++

        runFile(file).then(
          (results) => {
            reporter.onResult(
              { ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) },
              'server',
            )
            passed += results.passed
            failed += results.failed
            skipped += results.skipped
            todo += results.todo
            active--
            if (index < files.length) {
              dispatch()
            } else if (active === 0) {
              resolve()
            }
          },
          (err) => {
            console.error(`Error running ${file}:`, err)
            active--
            if (active === 0 && index >= files.length) resolve()
            else dispatch()
          },
        )
      }

      if (index >= files.length && active === 0) resolve()
    }

    dispatch()
  })

  return { passed, failed, skipped, todo }
}
