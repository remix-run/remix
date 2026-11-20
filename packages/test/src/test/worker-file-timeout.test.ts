import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { TestContext } from '../lib/context.ts'
import type { RemixTestPool } from '../lib/config.ts'
import { describe, it } from '../lib/framework.ts'
import { runServerTests } from '../lib/runner.ts'
import { IS_BUN } from '../lib/runtime.ts'
import type { TestResults } from '../lib/reporters/results.ts'

const PKG_DIR = fileURLToPath(new URL('../../', import.meta.url))

describe('worker file deadlines', () => {
  it(
    'terminates hung imports and cleanup in forks, then runs queued files',
    { skip: IS_BUN, timeout: 30_000 },
    async (t) => {
      await runFixture(t, 'forks')
    },
  )

  it(
    'terminates hung imports and cleanup in threads, then runs queued files',
    { skip: IS_BUN, timeout: 30_000 },
    async (t) => {
      await runFixture(t, 'threads')
    },
  )
})

async function runFixture(t: TestContext, pool: RemixTestPool): Promise<void> {
  let signals = {
    import: Promise.withResolvers<void>(),
    cleanup: Promise.withResolvers<void>(),
    terminated: Promise.withResolvers<void>(),
  }
  let server = createServer((request, response) => {
    response.end()
    if (request.url === '/import') signals.import.resolve()
    if (request.url === '/cleanup') signals.cleanup.resolve()
    if (request.url === '/terminated') signals.terminated.resolve()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    return new Promise<void>((resolve) => server.close(() => resolve()))
  })
  let address = server.address()
  assert.ok(address && typeof address === 'object')
  let baseUrl = `http://127.0.0.1:${address.port}`
  let parent = path.join(PKG_DIR, '.tmp')
  await fsp.mkdir(parent, { recursive: true })
  let dir = await fsp.mkdtemp(path.join(parent, `deadline-${pool}-`))
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  let files = ['import.test.ts', 'cleanup.test.ts', 'pass.test.ts'].map((name) =>
    path.join(dir, name),
  )
  await fsp.writeFile(
    files[0],
    `
setInterval(() => {}, 1000)
// Exercise the hard-kill fallback when a fork ignores SIGTERM.
if (${JSON.stringify(pool)} === 'forks') process.on('SIGTERM', () => { void fetch('${baseUrl}/terminated') })
await fetch('${baseUrl}/import')
await new Promise(() => {})
`,
  )
  await fsp.writeFile(
    files[1],
    `
import { it } from '../../src/lib/framework.ts'
let keepAlive = setInterval(() => {}, 1000)
let cleanup = Promise.withResolvers<void>()
process.on('SIGTERM', () => cleanup.resolve())
it('finishes its body', (t) => {
  t.after(async () => {
    await fetch('${baseUrl}/cleanup')
    await cleanup.promise
    clearInterval(keepAlive)
  })
})
`,
  )
  await fsp.writeFile(
    files[2],
    `
import { it } from '../../src/lib/framework.ts'
it('runs after the timed-out files', () => {})
`,
  )
  let reported: TestResults[] = []
  let clock = t.useFakeTimers()
  t.mock.method(console, 'error', () => {})
  let running = runServerTests(
    files,
    {
      onResult(results) {
        reported.push(results)
      },
      onSectionStart() {},
      onSummary() {},
    },
    1,
    'server',
    { pool, fileTimeout: 600_000 },
  )
  await signals.import.promise
  clock.advance(600_000)
  if (pool === 'forks') {
    await signals.terminated.promise
    clock.advance(5_000)
  }
  await signals.cleanup.promise
  // The second file gets a fresh deadline even though it spent ten minutes queued.
  assert.equal(reported.length, 1)
  clock.advance(600_000)
  let counts = await running
  assert.equal(counts.failed, 2)
  assert.equal(counts.passed, 1)
  assert.equal(reported.length, 3)
  assert.match(reported[0].tests[0].error?.message ?? '', /import.test.ts \[server\].*600000ms/)
  assert.match(reported[1].tests[0].error?.message ?? '', /cleanup.test.ts \[server\].*600000ms/)
  assert.equal(reported[2].tests[0].name, 'runs after the timed-out files')
}
