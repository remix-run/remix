import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webkit } from 'playwright'
import type { Browser } from 'playwright'
import type { TestContext } from '../lib/context.ts'
import { describe, it } from '../lib/framework.ts'
import { startServer } from '../app/server.ts'
import { runBrowserTests } from '../lib/runner-browser.ts'
import type { Reporter } from '../lib/reporters/index.ts'
import type { TestResults } from '../lib/reporters/results.ts'
import { IS_BUN } from '../lib/runtime.ts'

const PKG_DIR = fileURLToPath(new URL('../../', import.meta.url))
// CI installs WebKit in the macOS job; the other jobs install Chromium and Firefox.
const SKIP_WEBKIT = IS_BUN || process.platform !== 'darwin'

describe('browser history backoff', () => {
  it(
    'resets WebKit history budgets between files and backs off within a file',
    { skip: SKIP_WEBKIT },
    async (t) => {
      let fixture = await createFixture(t, {
        'a.test.browser.ts': `
import { it } from '../../src/lib/framework.ts'
it('uses the initial budget', () => {
  window.parent.document.documentElement.dataset.previousFile = 'yes'
  localStorage.setItem('previous-file', 'yes')
  sessionStorage.setItem('previous-file', 'yes')
  document.cookie = 'previous-file=yes; path=/'
  for (let i = 0; i < 60; i++) history.replaceState(null, '', '?i=' + i)
})
`,
        'b.test.browser.ts': `
import * as assert from '@remix-run/assert'
import type { TestContext } from '../../src/lib/context.ts'
import { beforeAll, beforeEach, afterEach, it } from '../../src/lib/framework.ts'
let setups = 0
let beforeEachRuns = 0
let attempts = 0
let cleaned = 0
let firstContext: TestContext | undefined
beforeAll(() => { setups++ })
beforeEach(() => { beforeEachRuns++; document.body.textContent = '' })
afterEach(() => {
  history.replaceState(null, '', '?cleanup')
  document.body.textContent = ''
  cleaned++
})
it('starts with a fresh history budget', () => {
  for (let i = 0; i < 60; i++) history.pushState(null, '', '?i=' + i)
})
it('recovers on a fresh attempt', (t) => {
  attempts++
  assert.equal(beforeEachRuns, attempts + 1)
  if (attempts === 1) firstContext = t
  else assert.notEqual(t, firstContext)
  assert.equal(document.body.textContent, '')
  document.body.textContent = 'fixture'
  t.useFakeTimers()
  t.after(() => history.replaceState(null, '', '?context-cleanup'))
  for (let i = 0; i < 60; i++) history.replaceState(null, '', '?i=' + i)
})
it('retains shared setup and runner storage', () => {
  assert.equal(setups, 1)
  assert.equal(attempts, 2)
  assert.equal(cleaned, 3)
  assert.equal(window.parent.document.documentElement.dataset.previousFile, undefined)
  assert.equal(localStorage.getItem('previous-file'), 'yes')
  assert.equal(sessionStorage.getItem('previous-file'), 'yes')
  assert.equal(document.cookie, 'previous-file=yes')
  history.pushState(null, '', '?after-backoff')
})
`,
      })
      let warn = t.mock.method(console, 'warn', () => {})
      let run = await runBrowserTests({
        ...fixture,
        playwrightUseOpts: { browserName: 'webkit' },
        reporter: createReporter([]),
      })

      assert.equal(run.results.passed, 4)
      assert.equal(run.results.failed, 0)
      assert.equal(warn.mock.calls.length, 1)
      let warning = String(warn.mock.calls[0].arguments[0])
      assert.ok(warning.includes(path.relative(process.cwd(), fixture.testFiles[1])))
      assert.match(warning, /11 seconds/)
      assert.match(
        warning,
        /Split history-heavy tests across smaller files or reduce history updates/,
      )
    },
  )

  it(
    'continues after a WebKit import failure and navigates each file again on rerun',
    { skip: SKIP_WEBKIT },
    async (t) => {
      let fixture = await createFixture(t, {
        'a.test.browser.ts': `
import { it } from '../../src/lib/framework.ts'
it('marks the first file and counts runs', () => {
  window.parent.document.documentElement.dataset.previousFile = 'yes'
  localStorage.setItem('runs', String(Number(localStorage.getItem('runs') ?? 0) + 1))
})
`,
        'b.test.browser.ts': `import './missing.ts'`,
        'c.test.browser.ts': `
import * as assert from '@remix-run/assert'
import { it } from '../../src/lib/framework.ts'
it('gets a fresh document after the failed file', () => {
  assert.equal(window.parent.document.documentElement.dataset.previousFile, undefined)
  history.pushState(null, '', '?after-error')
})
`,
      })
      let browser: Browser | undefined
      let launch = webkit.launch.bind(webkit)
      t.mock.method(webkit, 'launch', async (options) => {
        browser = await launch(options)
        return browser
      })
      let warn = t.mock.method(console, 'warn', () => {})
      t.mock.method(console, 'error', () => {})
      let reported: TestResults[] = []
      let run = await runBrowserTests({
        ...fixture,
        open: true,
        playwrightUseOpts: { browserName: 'webkit' },
        reporter: createReporter(reported),
      })
      t.after(run.close)

      assert.equal(run.results.passed, 2)
      assert.equal(run.results.failed, 1)
      assert.equal(reported.length, 3)
      assert.equal(reported[1].failed, 1)
      assert.match(reported[1].tests[0].error?.message ?? '', /Failed to load script/)
      assert.ok(browser)
      assert.equal(browser.contexts().length, 1)
      let pages = browser.contexts()[0].pages()
      assert.equal(pages.length, 2)
      let dashboard = pages[0]
      let execution = pages[1]
      assert.equal(await execution.evaluate(() => localStorage.getItem('runs')), '1')
      await Promise.all([
        dashboard.waitForEvent('load'),
        dashboard.getByRole('button', { name: 'Re-run' }).click(),
      ])
      await dashboard.waitForFunction('window.__testsDone')
      assert.equal(reported.length, 6)
      assert.equal(reported[4].failed, 1)
      assert.equal(reported[5].passed, 1)
      assert.equal(await execution.evaluate(() => localStorage.getItem('runs')), '2')
      assert.deepEqual(browser.contexts()[0].pages(), pages)
      assert.equal(warn.mock.calls.length, 0)
      await run.close()
      await run.disconnected
    },
  )
})

async function createFixture(t: TestContext, sources: Record<string, string>) {
  let parent = path.join(PKG_DIR, '.tmp')
  await fsp.mkdir(parent, { recursive: true })
  let dir = await fsp.mkdtemp(path.join(parent, 'browser-backoff-'))
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  for (let [name, source] of Object.entries(sources))
    await fsp.writeFile(path.join(dir, name), source)
  let testFiles = Object.keys(sources).map((name) => path.join(dir, name))
  let { server, baseUrl } = await startServer(testFiles)
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  })
  return { dir, testFiles, baseUrl }
}

function createReporter(reported: TestResults[]): Reporter {
  return {
    onResult(results) {
      reported.push(results)
    },
    onSectionStart() {},
    onSummary() {},
  }
}
