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
// Postinstall installs Chromium and Firefox; macOS CI opts in after installing WebKit.
const SKIP_WEBKIT = IS_BUN || process.platform !== 'darwin' || process.env.REMIX_TEST_WEBKIT !== '1'

describe('browser history backoff', () => {
  it(
    'discards stale WebKit results and script failures when refreshed during loading and execution',
    { skip: SKIP_WEBKIT },
    async (t) => {
      let fixture = await createFixture(t, {
        'a.test.browser.ts': `
import * as assert from '@remix-run/assert'
import { value } from './slow.ts'
import { it } from '../../src/lib/framework.ts'
it('restarts the interrupted file', async () => {
  assert.equal(value, 1)
  let attempts = Number(localStorage.getItem('attempts') ?? 0) + 1
  localStorage.setItem('attempts', String(attempts))
  if (attempts === 1) await new Promise(() => {})
  assert.equal(attempts, 2)
})
`,
        'b.test.browser.ts': `
import * as assert from '@remix-run/assert'
import { it } from '../../src/lib/framework.ts'
it('continues after the restarted file', () => {
  assert.equal(localStorage.getItem('attempts'), '2')
})
`,
      })
      await fsp.writeFile(path.join(fixture.dir, 'slow.ts'), 'export const value = 1')
      let firstModuleRequest = Promise.withResolvers<void>()
      let restartedModuleRequest = Promise.withResolvers<void>()
      let releaseFirstModule = Promise.withResolvers<void>()
      let browser: Browser | undefined
      let launch = webkit.launch.bind(webkit)
      t.mock.method(webkit, 'launch', async (options) => {
        browser = await launch(options)
        let newContext = browser.newContext.bind(browser)
        t.mock.method(browser, 'newContext', async (options) => {
          let context = await newContext(options)
          let firstRequest = true
          await context.route('**/slow.ts', async (route) => {
            if (firstRequest) {
              firstRequest = false
              firstModuleRequest.resolve()
              await releaseFirstModule.promise
            } else {
              restartedModuleRequest.resolve()
            }
            await route.fallback()
          })
          return context
        })
        return browser
      })
      let reported: TestResults[] = []
      let running = runBrowserTests({
        ...fixture,
        open: true,
        playwrightUseOpts: { browserName: 'webkit' },
        reporter: createReporter(reported),
      })
      t.after(async () => {
        releaseFirstModule.resolve()
        await browser?.close()
        await running
      })
      let execution = await t.waitFor(
        () => {
          let page = browser?.contexts()[0]?.pages()[1]
          assert.ok(page)
          return page
        },
        { timeout: 10_000 },
      )
      let dashboard = execution.context().pages()[0]
      await Promise.race([
        firstModuleRequest.promise,
        running.then(() => {
          throw new Error('Browser run ended before the first module request')
        }),
      ])
      await dashboard.reload()
      await Promise.race([
        restartedModuleRequest.promise,
        running.then(() => {
          throw new Error('Browser run ended before the restarted module loaded')
        }),
      ])
      releaseFirstModule.resolve()
      await Promise.race([
        execution.waitForFunction(
          () => location.origin !== 'null' && localStorage.getItem('attempts') === '1',
        ),
        running.then(() => {
          throw new Error('Browser run ended before the interrupted test restarted')
        }),
      ])
      await dashboard.reload()
      let run = await running
      assert.equal(run.results.passed, 2)
      assert.equal(run.results.failed, 0)
      assert.deepEqual(
        reported.map(({ passed, failed }) => ({ passed, failed })),
        [
          { passed: 1, failed: 0 },
          { passed: 1, failed: 0 },
        ],
      )
      assert.equal(await execution.evaluate(() => localStorage.getItem('attempts')), '2')
      await run.close()
      await run.disconnected
    },
  )

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
        // CLI paths and native filesystem paths can use different separators on Windows.
        testFiles: fixture.testFiles.map((file) => path.win32.normalize(file)),
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
    'continues after WebKit import and page-load failures and navigates each file on rerun',
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
      await execution.route('**/*', async (route) => {
        let url = new URL(route.request().url())
        if (url.pathname === '/' && url.searchParams.get('file')?.endsWith('/b.test.browser.ts')) {
          await route.fulfill({ status: 404, body: 'Unknown test file' })
        } else {
          await route.fallback()
        }
      })
      await Promise.all([
        dashboard.waitForEvent('load'),
        dashboard.getByRole('button', { name: 'Re-run' }).click(),
      ])
      await dashboard.waitForFunction('window.__testsDone')
      assert.equal(reported.length, 6)
      assert.equal(reported[4].failed, 1)
      assert.match(reported[4].tests[0].error?.message ?? '', /Failed to load test page:.*404/)
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
