import * as path from 'node:path'
import * as mod from 'node:module'
import { workerData, parentPort } from 'node:worker_threads'
import { runTests, type TestResults } from './executor.ts'
import { tsImport } from 'tsx/esm/api'

try {
  // When coverage is enabled, we use a coverage-friendly TypeScript loader which
  // replaces tsx's minified transformation with a non-minified esbuild transform
  // so V8 coverage byte offsets align with readable source lines. This hook runs
  // before the inherited tsx hook (hooks are LIFO), so it intercepts .ts imports and
  // short-circuits before tsx transforms them.
  if (workerData.coverage) {
    // Ensure we load the right file whether we're running in the monorepo (TS) or
    // from a published package (JS)
    let ext = path.extname(import.meta.url)
    mod.register(new URL(`./coverage-loader${ext}`, import.meta.url), import.meta.url)
    await import(workerData.file)
  } else {
    // Without coverage enabled, just use a normal tsImport
    await tsImport(workerData.file, import.meta.url)
  }

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
