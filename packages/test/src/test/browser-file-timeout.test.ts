import * as assert from '@remix-run/assert'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'
import type { Browser, Page } from 'playwright'
import type { TestContext } from '../lib/context.ts'
import { describe, it } from '../lib/framework.ts'
import { startServer } from '../app/server.ts'
import { runBrowserTests } from '../lib/runner-browser.ts'
import type { TestResults } from '../lib/reporters/results.ts'
import { IS_BUN } from '../lib/runtime.ts'

const PKG_DIR = fileURLToPath(new URL('../../', import.meta.url))
const SKIP_WEBKIT = IS_BUN || process.platform !== 'darwin' || process.env.REMIX_TEST_WEBKIT !== '1'

describe('browser file deadlines', () => {
  it(
    'removes a hung Chromium iframe and continues',
    { skip: IS_BUN, timeout: 30_000 },
    async (t) => {
      await runFixture(t, 'chromium')
    },
  )
  it(
    'removes a hung Firefox iframe and continues',
    { skip: IS_BUN, timeout: 30_000 },
    async (t) => {
      await runFixture(t, 'firefox')
    },
  )
  it(
    'replaces a hung WebKit execution page and continues',
    { skip: SKIP_WEBKIT, timeout: 30_000 },
    async (t) => {
      await runFixture(t, 'webkit')
    },
  )
})

async function runFixture(
  t: TestContext,
  browserName: 'chromium' | 'firefox' | 'webkit',
): Promise<void> {
  let parent = path.join(PKG_DIR, '.tmp')
  await fsp.mkdir(parent, { recursive: true })
  let dir = await fsp.mkdtemp(path.join(parent, 'browser-deadline-'))
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  let files = ['hang.test.browser.ts', 'pass.test.browser.ts'].map((name) => path.join(dir, name))
  await fsp.writeFile(
    files[0],
    `
import { it } from '../../src/lib/framework.ts'
it('hangs after startup', async () => {
  console.log('deadline-ready')
  await new Promise(() => {})
})
`,
  )
  await fsp.writeFile(
    files[1],
    `
import { it } from '../../src/lib/framework.ts'
it('runs after the timed-out file', () => {})
`,
  )
  let { server, baseUrl } = await startServer(files)
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
  let ready = Promise.withResolvers<void>()
  let browser: Browser | undefined
  let dashboard: Page | undefined
  let launcher = { chromium, firefox, webkit }[browserName]
  let launch = launcher.launch.bind(launcher)
  t.mock.method(launcher, 'launch', async (options) => {
    browser = await launch(options)
    let newContext = browser.newContext.bind(browser)
    t.mock.method(browser, 'newContext', async (options) => {
      let context = await newContext(options)
      context.on('page', (page) => {
        dashboard ??= page
        page.on('console', (msg) => {
          if (msg.text() === 'deadline-ready') ready.resolve()
        })
      })
      if (browserName !== 'webkit') {
        await context.clock.install({ time: new Date(0) })
        await context.clock.pauseAt(new Date(1))
      }
      return context
    })
    return browser
  })
  t.after(async () => {
    await browser?.close()
  })
  let reported: TestResults[] = []
  let expireDeadline: (() => void) | undefined
  if (browserName === 'webkit') {
    let setTimeout = globalThis.setTimeout
    t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
      // Trigger only the file's timer, leaving Playwright's transport timers running normally.
      if (delay === 600_000) expireDeadline = () => callback(...args)
      return setTimeout(callback, delay, ...args)
    })
  }
  let running = runBrowserTests({
    baseUrl,
    testFiles: files,
    open: true,
    fileTimeout: 600_000,
    projectName: browserName,
    playwrightUseOpts: { browserName },
    reporter: {
      onResult(results) {
        reported.push(results)
      },
      onSectionStart() {},
      onSummary() {},
    },
  })
  await Promise.race([
    ready.promise,
    running.then(() => {
      throw new Error('Run ended before the hung test started')
    }),
  ])
  assert.ok(dashboard)
  if (browserName === 'webkit') {
    assert.ok(expireDeadline)
    expireDeadline()
  } else {
    await dashboard.clock.fastForward(600_000)
  }
  let run = await running
  assert.equal(run.results.failed, 1)
  assert.equal(run.results.passed, 1)
  assert.match(
    reported[0].tests[0].error?.message ?? '',
    new RegExp(String.raw`hang.test.browser.ts \[browser:${browserName}\].*600000ms`),
  )
  assert.equal(reported[1].tests[0].name, 'runs after the timed-out file')
  if (browserName !== 'webkit') assert.equal(await dashboard.locator('iframe').count(), 1)
  await run.close()
}
