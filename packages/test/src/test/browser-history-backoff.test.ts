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
    'recovers from WebKit history quota exhaustion across files',
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
import { beforeAll, beforeEach, afterEach, it } from '../../src/lib/framework.ts'
let setups = 0
let attempts = 0
let cleaned = 0
beforeAll(() => { setups++ })
beforeEach(() => { document.body.textContent = '' })
afterEach(() => {
  history.replaceState(null, '', '?cleanup')
  document.body.textContent = ''
  cleaned++
})
it('recovers on a fresh attempt', (t) => {
  attempts++
  assert.equal(document.body.textContent, '')
  document.body.textContent = 'fixture'
  t.useFakeTimers()
  t.after(() => history.replaceState(null, '', '?context-cleanup'))
  for (let i = 0; i < 60; i++) history.replaceState(null, '', '?i=' + i)
})
it('retains shared setup and runner storage', () => {
  assert.equal(setups, 1)
  assert.equal(attempts, 2)
  assert.equal(cleaned, 2)
  assert.equal(window.parent.document.documentElement.dataset.previousFile, 'yes')
  assert.equal(localStorage.getItem('previous-file'), 'yes')
  assert.equal(sessionStorage.getItem('previous-file'), 'yes')
  assert.equal(document.cookie, 'previous-file=yes')
  history.pushState(null, '', '?after-backoff')
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
      let reported: TestResults[] = []
      let run = await runBrowserTests({
        ...fixture,
        open: true,
        playwrightUseOpts: { browserName: 'webkit' },
        reporter: createReporter(reported),
      })
      t.after(run.close)

      assert.equal(run.results.passed, 3)
      assert.equal(run.results.failed, 0)
      assert.equal(reported.length, 2)
      assert.ok(browser)
      assert.equal(browser.contexts().length, 1)
      assert.equal(browser.contexts()[0].pages().length, 1)
      assert.equal(warn.mock.calls.length, 1)
      let warning = String(warn.mock.calls[0].arguments[0])
      assert.ok(warning.includes(path.relative(process.cwd(), fixture.testFiles[1])))
      assert.match(warning, /11 seconds/)
      assert.match(warning, /Reduce history updates or run history-heavy files separately/)
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
