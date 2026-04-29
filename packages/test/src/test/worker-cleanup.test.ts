import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from '../lib/framework.ts'
import { runServerTests } from '../lib/runner.ts'
import { IS_BUN } from '../lib/runtime.ts'
import type { Reporter } from '../lib/reporters/index.ts'
import type { TestResults } from '../lib/reporters/results.ts'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIXTURE_DIR = path.join(PKG_DIR, '.tmp', 'worker-cleanup')
const FIXTURE_FILE = path.join(FIXTURE_DIR, 'leaked-worker.test.ts')

describe('worker cleanup', () => {
  it('terminates leaked workers after receiving results', { skip: IS_BUN }, async () => {
    await fsp.rm(FIXTURE_DIR, { recursive: true, force: true })
    await fsp.mkdir(FIXTURE_DIR, { recursive: true })
    await fsp.writeFile(
      FIXTURE_FILE,
      `
import { Worker } from 'node:worker_threads'
import { describe, it } from '../../src/lib/framework.ts'

process.exit = (() => undefined) as typeof process.exit

describe('leaked worker fixture', () => {
  it('passes while leaving a worker running', () => {
    new Worker('setInterval(() => {}, 1000)', { eval: true })
  })
})
`,
    )

    let results: TestResults | undefined
    let reporter: Reporter = {
      onResult(testResults) {
        results = testResults
      },
      onSectionStart() {},
      onSummary() {},
    }

    try {
      let counts = await runServerTests([FIXTURE_FILE], reporter, 1, {
        type: 'server',
        coverage: undefined,
        cwd: FIXTURE_DIR,
        pool: 'threads',
        workerShutdownTimeoutMs: 50,
      })
      assert.equal(counts.passed, 1)
      assert.equal(counts.failed, 0)
      assert.equal(counts.skipped, 0)
      assert.equal(counts.todo, 0)
    } finally {
      await fsp.rm(FIXTURE_DIR, { recursive: true, force: true })
    }

    assert.ok(results)
    assert.equal(results.passed, 1)
    assert.equal(results.failed, 0)
    assert.equal(results.skipped, 0)
    assert.equal(results.todo, 0)

    let { tests } = results
    assert.equal(tests.length, 1)
    assert.equal(tests[0].name, 'passes while leaving a worker running')
    assert.equal(tests[0].suiteName, 'leaked worker fixture')
    assert.equal(tests[0].status, 'passed')
    assert.equal(typeof tests[0].duration, 'number')
  })
})
