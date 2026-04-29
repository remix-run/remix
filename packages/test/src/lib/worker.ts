import * as mod from 'node:module'
import type { CoverageConfig } from './coverage.ts'
import { runTests } from './executor.ts'
import { importModule } from './import-module.ts'
import type { TestResults } from './reporters/results.ts'
import { IS_BUN } from './runtime.ts'
import { IS_RUNNING_FROM_SRC } from './config.ts'
import { receiveWorkerData, sendResults } from './worker-channel.ts'

interface ServerWorkerData {
  file: string
  type: 'server'
  coverage?: CoverageConfig
}

const workerData = await receiveWorkerData<ServerWorkerData>()

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
  sendResults(results)
  process.exit(0)
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
  sendResults(results)
  process.exit(0)
}
