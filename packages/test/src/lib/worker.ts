import * as mod from 'node:module'
import { runTests } from './executor.ts'
import { importModule } from './import-module.ts'
import type { TestResults } from './reporters/results.ts'
import { IS_BUN } from './runtime.ts'
import { IS_RUNNING_FROM_SRC } from './config.ts'
import { closeWorkerChannel, receiveData, sendResults, type WorkerPayload } from './channel.ts'

const workerData = await receiveData<WorkerPayload>()

async function takeCoverage(): Promise<void> {
  if (workerData.coverage && !IS_BUN) {
    let v8 = await import('node:v8')
    v8.takeCoverage()
  }
}

try {
  // When coverage is enabled in Node, we use a coverage-friendly TypeScript loader which
  // replaces tsx's minified transformation with a non-minified esbuild transform
  // so V8 coverage byte offsets align with readable source lines. This hook runs
  // before the inherited tsx hook (hooks are LIFO), so it intercepts .ts imports and
  // short-circuits before tsx transforms them.
  if (workerData.coverage && !IS_BUN) {
    // Ensure we load the right file whether we're running in the monorepo (TS) or
    // from a published package (JS)
    let ext = IS_RUNNING_FROM_SRC ? '.ts' : '.js'
    mod.register(new URL(`./coverage-loader${ext}`, import.meta.url), import.meta.url)
    await import(workerData.file)
  } else {
    await importModule(workerData.file, import.meta)
  }

  let results = await runTests()
  await takeCoverage()
  await sendResults(results)
} catch (e) {
  try {
    await takeCoverage()
  } catch (coverageError) {
    e = coverageError
  }

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
