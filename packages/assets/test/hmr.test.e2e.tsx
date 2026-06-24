import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { watch, type FSWatcher } from 'chokidar'
import { createAssetServer, type AssetServer } from '../src/assets.ts'
import type { HmrPayload } from '../src/types-hmr.d.ts'

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceDir = path.resolve(packageDir, '../..')
const nodeHmrImportUrl = pathToFileURL(
  path.resolve(workspaceDir, 'packages/node-hmr/src/index.ts'),
).href
const fetchProxyImportUrl = pathToFileURL(
  path.resolve(workspaceDir, 'packages/fetch-proxy/src/index.ts'),
).href
const nodeFetchServerImportUrl = pathToFileURL(
  path.resolve(workspaceDir, 'packages/node-fetch-server/src/index.ts'),
).href
const nodeTsxImportUrl = pathToFileURL(
  path.resolve(workspaceDir, 'packages/node-tsx/src/index.ts'),
).href
const isBun = 'Bun' in globalThis

describe('asset server HMR', { skip: isBun }, () => {
  it('updates accepted browser module output without losing page state', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await assertCount(page, 'Count: 3')
    await page.locator('[data-testid="field"]').fill('hello')

    let counterPath = path.join(fixture.rootDir, 'app/counter.ts')
    let counterSource = await fs.readFile(counterPath, 'utf-8')
    await fs.writeFile(counterPath, counterSource.replace('Increment', 'Increment via HMR'))

    await waitForText(page, '[data-testid="increment"]', 'Increment via HMR')
    await assertCount(page, 'Count: 3')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'hello')
  })

  it('reloads the page when an accepted browser module export is added', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await page.locator('[data-testid="field"]').fill('typed before reload')

    let reloaded = waitForNavigation(page)
    await write(
      fixture.rootDir,
      'app/counter.ts',
      getCounterModuleSource({
        buttonText: 'Increment after reload',
        extraExports: ['export const loader = () => new Response("ok")', ''].join('\n'),
      }),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after reload')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('reloads the page when an accepted browser module export is removed', async (t) => {
    let fixture = await createHmrFixture({
      counterExtraExports: 'export const foo = true\n',
    })
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await page.locator('[data-testid="field"]').fill('typed before reload')

    let reloaded = waitForNavigation(page)
    await write(
      fixture.rootDir,
      'app/counter.ts',
      getCounterModuleSource({
        buttonText: 'Increment after export removal',
      }),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after export removal')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('reloads the page when an accepted browser module export changes', async (t) => {
    let fixture = await createHmrFixture({
      counterExtraExports: 'export const foo = true\n',
    })
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await page.locator('[data-testid="field"]').fill('typed before reload')

    let reloaded = waitForNavigation(page)
    await write(
      fixture.rootDir,
      'app/counter.ts',
      getCounterModuleSource({
        buttonText: 'Increment after export change',
        extraExports: 'export const foo = false\n',
      }),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after export change')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('updates accepted browser modules when runtime exports are strictly equal', async (t) => {
    let fixture = await createHmrFixture({
      counterExtraExports: ["import { foo } from './stable.ts'", 'export { foo }', ''].join('\n'),
    })
    t.after(fixture.close)
    await write(fixture.rootDir, 'app/stable.ts', 'export const foo = {}\n')

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await page.locator('[data-testid="field"]').fill('typed before update')

    await write(
      fixture.rootDir,
      'app/counter.ts',
      getCounterModuleSource({
        buttonText: 'Increment with stable export',
        extraExports: ["import { foo } from './stable.ts'", 'export { foo }', ''].join('\n'),
      }),
    )

    await waitForText(page, '[data-testid="increment"]', 'Increment with stable export')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'typed before update')
  })

  it('reloads the page when an accepted browser module object export is recreated', async (t) => {
    let fixture = await createHmrFixture({
      counterExtraExports: 'export const foo = {}\n',
    })
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await page.locator('[data-testid="field"]').fill('typed before reload')

    let reloaded = waitForNavigation(page)
    await write(
      fixture.rootDir,
      'app/counter.ts',
      getCounterModuleSource({
        buttonText: 'Increment after object export',
        extraExports: 'export const foo = {}\n',
      }),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after object export')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('bubbles browser runtime invalidation to accepting importers', async (t) => {
    let fixture = await createHmrFixture({
      browserInvalidationFixture: {
        message: 'Browser: before',
        parentAccepts: true,
      },
    })
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForText(page, '[data-testid="browser-message"]', 'Browser: before')
    await page.locator('[data-testid="field"]').fill('typed before update')

    await writeBrowserInvalidationMessage(fixture.rootDir, 'Browser: after')

    await waitForText(page, '[data-testid="browser-message"]', 'Browser: after')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'typed before update')
  })

  it('reloads the page when browser runtime invalidation cannot bubble', async (t) => {
    let fixture = await createHmrFixture({
      browserInvalidationFixture: {
        message: 'Browser: before',
        parentAccepts: false,
      },
    })
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForText(page, '[data-testid="browser-message"]', 'Browser: before')
    await page.locator('[data-testid="field"]').fill('typed before reload')

    let reloaded = waitForNavigation(page)
    await writeBrowserInvalidationMessage(fixture.rootDir, 'Browser: after')

    await reloaded
    await waitForText(page, '[data-testid="browser-message"]', 'Browser: after')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('updates a stylesheet after a failed HMR transform is fixed', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(255, 0, 0)')
    await waitForComputedStyle(page, '[data-testid="increment"]', 'padding-top', '13px')

    let stylesheetPath = path.join(fixture.rootDir, 'app/styles.css')
    let failedStyleRequest = waitForStylesheetResponse(page, 500)
    await fs.writeFile(stylesheetPath, 'body { background: url("foo); }\n')
    await failedStyleRequest

    // The fixture watcher polls every 50ms, so avoid writing the recovery content
    // before the watcher has settled after observing the broken content.
    await page.waitForTimeout(75)

    await waitForStylesheetLinkCount(page, '/assets/app/styles.css', 1)
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(255, 0, 0)')

    let paddingContinuity = monitorComputedStyle(page, {
      duration: 750,
      property: 'padding-top',
      selector: '[data-testid="increment"]',
      value: '13px',
    })
    let fixedStyleRequest = waitForStylesheetResponse(page, 200)
    await fs.writeFile(
      stylesheetPath,
      '[data-testid="increment"] { color: blue; padding: 13px; }\n',
    )
    await fixedStyleRequest
    // Ensure there wasn't a flash of unstyled content
    assert.deepEqual(await paddingContinuity, [])

    await waitForStylesheetLinkCount(page, '/assets/app/styles.css', 1)
    assert.equal(await getStylesheetLinkHasTimestamp(page, '/assets/app/styles.css'), true)
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(0, 0, 255)')
  })

  it('updates a linked stylesheet when an imported stylesheet changes', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(255, 0, 0)')

    let linkedStyleRequest = waitForStylesheetResponse(page, 200)
    let importedStyleRequest = waitForStylesheetResponse(page, 200, {
      pathname: '/assets/app/theme.css',
    })
    await fs.writeFile(
      path.join(fixture.rootDir, 'app/theme.css'),
      '[data-testid="increment"] { color: green; padding: 13px; }\n',
    )
    await linkedStyleRequest
    await importedStyleRequest

    await waitForStylesheetLinkCount(page, '/assets/app/styles.css', 1)
    assert.equal(await getStylesheetLinkHasTimestamp(page, '/assets/app/styles.css'), true)
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(0, 128, 0)')
  })

  it('does not refresh stylesheets after server updates from node-hmr', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForComputedStyle(page, '[data-testid="client-label"]', 'color', 'rgb(255, 0, 0)')

      let unexpectedStyleRequest = waitForStylesheetResponse(page, 200, { timeout: 250 }).then(
        () => true,
        () => false,
      )
      await write(
        fixture.rootDir,
        'server-side-effect.ts',
        `export const sideEffect = 'style-test'\n`,
      )
      await waitForConsoleMessage(page, 'Server frame reload complete')

      assert.equal(await unexpectedStyleRequest, false)
      await waitForStylesheetLinkCount(page, '/assets/app/styles.css', 1)
      await waitForComputedStyle(page, '[data-testid="client-label"]', 'color', 'rgb(255, 0, 0)')
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('recovers failed stylesheet updates after the HMR event stream reconnects', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    let server = await createHmrTestServer(fixture)
    let page = await t.serve(server)
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(255, 0, 0)')

    let stylesheetPath = path.join(fixture.rootDir, 'app/styles.css')

    let lostConnection = waitForConsoleMessage(page, '[remix] HMR connection lost')
    let reconnected = waitForConsoleMessage(page, '[remix] HMR connected')
    let failedStyleRequest = waitForStylesheetResponse(page, 500)
    await server.stopAssets()
    await lostConnection
    await fs.writeFile(stylesheetPath, 'body { background: url("foo); }\n')
    await server.startAssets()
    await reconnected
    await failedStyleRequest

    await waitForStylesheetLinkCount(page, '/assets/app/styles.css', 1)
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(255, 0, 0)')

    lostConnection = waitForConsoleMessage(page, '[remix] HMR connection lost')
    reconnected = waitForConsoleMessage(page, '[remix] HMR connected')
    let fixedStyleRequest = waitForStylesheetResponse(page, 200)
    await server.stopAssets()
    await lostConnection
    await fs.writeFile(stylesheetPath, '[data-testid="increment"] { color: blue; }\n')
    await server.startAssets()
    await reconnected
    await fixedStyleRequest

    await waitForStylesheetLinkCount(page, '/assets/app/styles.css', 1)
    await waitForComputedStyle(page, '[data-testid="increment"]', 'color', 'rgb(0, 0, 255)')
  })

  it('handles browser module, stylesheet, and server updates through node-hmr', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')
      await waitForText(page, '[data-testid="client-label"]', 'Client: before')
      await waitForComputedStyle(page, '[data-testid="client-label"]', 'color', 'rgb(255, 0, 0)')

      await write(
        fixture.rootDir,
        'app/client-message.ts',
        getClientMessageSource('Client: browser update'),
      )
      await waitForText(page, '[data-testid="client-label"]', 'Client: browser update')
      assert.equal(server.readyCount, 1)

      let styleRequest = waitForStylesheetResponse(page, 200)
      await write(
        fixture.rootDir,
        'app/styles.css',
        '[data-testid="client-label"] { color: blue; }\n',
      )
      await styleRequest
      await waitForComputedStyle(page, '[data-testid="client-label"]', 'color', 'rgb(0, 0, 255)')
      assert.equal(server.readyCount, 1)

      await write(fixture.rootDir, 'server-side-effect.ts', `export const sideEffect = 'mixed'\n`)
      await waitForConsoleMessage(page, 'Server frame reload complete')
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads server-rendered content after a node-hmr server update', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let ready = await server.waitForReady(0)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')
      await page.locator('[data-testid="client-field"]').fill('typed before reload')

      let serverReload = waitForConsoleMessage(page, 'Server frame reload complete')
      await write(
        fixture.rootDir,
        'server-message.ts',
        `export const serverMessage = 'Server: after restart'\n`,
      )

      let restarted = await server.waitForReady(1)
      assert.equal(restarted.pid, ready.pid)
      await serverReload
      await waitForText(page, '[data-testid="server-message"]', 'Server: after restart')
      assert.equal(
        await page.locator('[data-testid="client-field"]').inputValue(),
        'typed before reload',
      )
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('recovers page reload requests after a failed node-hmr restart is fixed', async (t) => {
    let fixture = await createNodeHmrFixture({ devProxy: true })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let requestFailures = monitorLocalRequestFailures(page, server.baseUrl)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')

      await write(fixture.rootDir, 'server-message.ts', `export const serverMessage = \n`)
      await waitFor(
        () => /Failed running server\.tsx\. Waiting for file changes/.test(server?.output ?? ''),
        () => server?.output ?? 'Timed out waiting for failed server restart',
      )

      let reloadWhileBroken = page.goto('/')

      await write(
        fixture.rootDir,
        'server-message.ts',
        `export const serverMessage = 'Server: after fix'\n`,
      )

      await ignoreAbortedNavigation(reloadWhileBroken)
      await waitForText(page, '[data-testid="server-message"]', 'Server: after fix')
      await requestFailures.assertNone(server.output)
      assert.ok(server.readyCount > 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('keeps page reload requests successful during rapid node-hmr restarts', async (t) => {
    let fixture = await createNodeHmrFixture({
      devProxy: true,
      slowAssetMs: 75,
      slowDisposeMs: 400,
      slowDocumentMs: 150,
    })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let requestFailures = monitorLocalRequestFailures(page, server.baseUrl)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')

      let serverMessagePath = path.join(fixture.rootDir, 'server-message.ts')
      let initialSource = await fs.readFile(serverMessagePath, 'utf-8')

      await fs.writeFile(
        serverMessagePath,
        `export const serverMessage = 'Server: during restart'\n`,
      )
      await page.waitForTimeout(250)
      let reloadDuringRestart = page.goto('/')

      for (let index = 0; index < 6; index++) {
        await fs.writeFile(
          serverMessagePath,
          index % 2 === 0
            ? `export const serverMessage = 'Server: during restart'\n`
            : initialSource,
        )
        await page.waitForTimeout(25)
      }

      await ignoreAbortedNavigation(reloadDuringRestart)

      await fs.writeFile(
        serverMessagePath,
        `export const serverMessage = 'Server: after rapid restarts'\n`,
      )
      await page.waitForTimeout(250)
      await ignoreAbortedNavigation(page.goto('/'))

      await waitForText(page, '[data-testid="server-message"]', 'Server: after rapid restarts')
      await requestFailures.assertNone(server.output)
      assert.ok(server.readyCount > 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })
})

type HmrFixture = {
  close(): Promise<void>
  renderDocument?: (assetServer: AssetServer) => Promise<ReadableStream<Uint8Array>>
  rootDir: string
}

type NodeHmrFixture = {
  close(): Promise<void>
  devProxy: boolean
  rootDir: string
}

type HmrTestServer = {
  baseUrl: string
  close(): Promise<void>
  restartAssets(): Promise<void>
  startAssets(): Promise<void>
  stopAssets(): Promise<void>
}

type BrowserHmrFileEvent = {
  event: 'add' | 'change' | 'unlink'
  filePath: string
}

type BrowserHmrEvent =
  | {
      files?: string[]
      timestamp: number
      type: 'update'
      updates: Extract<HmrPayload, { type: 'browser:update' }>['updates']
    }
  | {
      files?: string[]
      type: 'reload'
    }

type BrowserHmrFileEventHandler = (
  events: readonly BrowserHmrFileEvent[],
) => Promise<readonly BrowserHmrEvent[]>

type NodeHmrTestServer = {
  baseUrl: string
  close(): Promise<void>
  output: string
  readyCount: number
  waitForReady(index: number): Promise<{ pid: number; port: number }>
}

type TestPage = Awaited<ReturnType<TestContext['serve']>>

type PageDiagnostics = {
  consoleMessages: string[]
  getServerOutput?: () => string
  navigations: string[]
  pageErrors: string[]
  requestFailures: string[]
  responseFailures: string[]
}

const pageDiagnostics = new WeakMap<TestPage, PageDiagnostics>()

async function serveNodeHmrFixture(t: TestContext, server: NodeHmrTestServer): Promise<TestPage> {
  let page = await t.serve(server)
  attachPageDiagnostics(page, () => server.output)
  return page
}

function attachPageDiagnostics(page: TestPage, getServerOutput?: () => string): PageDiagnostics {
  let diagnostics = pageDiagnostics.get(page)
  if (diagnostics !== undefined) {
    diagnostics.getServerOutput = getServerOutput ?? diagnostics.getServerOutput
    return diagnostics
  }

  diagnostics = {
    consoleMessages: [],
    getServerOutput,
    navigations: [],
    pageErrors: [],
    requestFailures: [],
    responseFailures: [],
  }
  pageDiagnostics.set(page, diagnostics)

  page.on('console', (message) => {
    diagnostics.consoleMessages.push(`${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.stack ?? error.message)
  })
  page.on('framenavigated', (frame) => {
    if (frame.parentFrame() !== null) return
    diagnostics.navigations.push(frame.url())
  })
  page.on('requestfailed', (request) => {
    let failureText = request.failure()?.errorText
    diagnostics.requestFailures.push(
      `${request.method()} ${request.url()}${failureText ? ` (${failureText})` : ''}`,
    )
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    diagnostics.responseFailures.push(`${response.status()} ${response.url()}`)
  })

  return diagnostics
}

function formatPageDiagnostics(page: TestPage): string {
  let diagnostics = attachPageDiagnostics(page)
  let sections = [
    formatDiagnosticsSection('console', diagnostics.consoleMessages),
    formatDiagnosticsSection('pageerror', diagnostics.pageErrors),
    formatDiagnosticsSection('navigation', diagnostics.navigations),
    formatDiagnosticsSection('requestfailed', diagnostics.requestFailures),
    formatDiagnosticsSection('response >= 400', diagnostics.responseFailures),
  ].filter(Boolean)

  let serverOutput = diagnostics.getServerOutput?.()
  if (serverOutput) {
    sections.push(`server output:\n${serverOutput}`)
  }

  return sections.join('\n\n')
}

function formatDiagnosticsSection(label: string, values: string[]): string {
  if (values.length === 0) return ''
  return `${label}:\n${values.slice(-30).join('\n')}`
}

async function createHmrFixture(
  options: {
    browserInvalidationFixture?: {
      message: string
      parentAccepts: boolean
    }
    counterExtraExports?: string
  } = {},
): Promise<HmrFixture> {
  let tmpDir = path.join(packageDir, '.tmp')
  await fs.mkdir(tmpDir, { recursive: true })
  let rootDir = await fs.mkdtemp(path.join(tmpDir, 'hmr-e2e-'))

  await write(
    rootDir,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
      },
    }),
  )
  await write(
    rootDir,
    'index.html',
    [
      '<!doctype html>',
      '<html>',
      '  <head>',
      '    <title>HMR Test</title>',
      '    <link rel="stylesheet" href="/assets/app/styles.css">',
      '  </head>',
      '  <body>',
      '    <div id="app"></div>',
      '    <script type="module" src="/assets/app/entry.tsx"></script>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
  )
  if (options.browserInvalidationFixture) {
    await writeBrowserInvalidationFixture(rootDir, options.browserInvalidationFixture)
  } else {
    await write(
      rootDir,
      'app/entry.tsx',
      [
        "import { renderCounter } from './counter.ts'",
        '',
        "let app = document.getElementById('app')",
        "if (!app) throw new Error('Missing app container')",
        '',
        'app.innerHTML = \'<main><input data-testid="field"><p data-testid="count"></p><button data-testid="increment"></button></main>\'',
        'renderCounter()',
        '',
      ].join('\n'),
    )
  }
  await write(
    rootDir,
    'app/counter.ts',
    getCounterModuleSource({
      buttonText: 'Increment',
      extraExports: options.counterExtraExports,
    }),
  )
  await write(rootDir, 'app/styles.css', '@import "./theme.css";\n')
  await write(
    rootDir,
    'app/theme.css',
    '[data-testid="increment"] { color: red; padding: 13px; }\n',
  )

  return {
    rootDir,
    async close() {
      await fs.rm(rootDir, { force: true, recursive: true })
    },
  }
}

function getCounterModuleSource(options: { buttonText: string; extraExports?: string }): string {
  let runtimeExportNames = ['renderCounter']
  if (options.extraExports?.includes('foo')) runtimeExportNames.push('foo')
  if (options.extraExports?.includes('loader')) runtimeExportNames.push('loader')

  return [
    `let buttonText = ${JSON.stringify(options.buttonText)}`,
    'let count = 3',
    '',
    'export function renderCounter() {',
    '  document.querySelector(\'[data-testid="count"]\')!.textContent = `Count: ${count}`',
    '  document.querySelector(\'[data-testid="increment"]\')!.textContent = buttonText',
    '}',
    '',
    options.extraExports ?? '',
    '',
    'if (import.meta.hot) {',
    '  let runtimeExports = {',
    '    ...(import.meta.hot.data.runtimeExports as Record<string, unknown> | undefined),',
    ...runtimeExportNames.map((name) => `    ${name},`),
    '  }',
    '  import.meta.hot.data.runtimeExports = runtimeExports',
    '',
    '  import.meta.hot.accept((module) => {',
    '    if (!module || typeof module !== "object") return',
    '',
    '    for (let name of Object.keys(module)) {',
    '      if (!Object.prototype.hasOwnProperty.call(runtimeExports, name)) {',
    '        import.meta.hot.invalidate(`Updated browser module added export "${name}"`)',
    '        return',
    '      }',
    '    }',
    '',
    '    for (let name of Object.keys(runtimeExports)) {',
    '      if (!Object.prototype.hasOwnProperty.call(module, name)) {',
    '        import.meta.hot.invalidate(`Updated browser module removed export "${name}"`)',
    '        return',
    '      }',
    '      if (name !== "renderCounter" && runtimeExports[name] !== module[name]) {',
    '        import.meta.hot.invalidate(`Updated browser module changed export "${name}"`)',
    '        return',
    '      }',
    '    }',
    '',
    '    module.renderCounter()',
    '  })',
    '}',
    '',
  ].join('\n')
}

async function writeBrowserInvalidationFixture(
  rootDir: string,
  options: { message: string; parentAccepts: boolean },
): Promise<void> {
  await write(
    rootDir,
    'app/entry.tsx',
    [
      "import { renderMessage } from './browser-parent.ts'",
      '',
      "let app = document.getElementById('app')",
      "if (!app) throw new Error('Missing app container')",
      '',
      'app.innerHTML = \'<main><input data-testid="field"><p data-testid="browser-message"></p></main>\'',
      'renderMessage()',
      '',
    ].join('\n'),
  )
  await write(
    rootDir,
    'app/browser-parent.ts',
    [
      "import { message } from './browser-message.ts'",
      '',
      'let currentMessage = message',
      '',
      'export function renderMessage() {',
      '  let el = document.querySelector(\'[data-testid="browser-message"]\')',
      '  if (el) el.textContent = currentMessage',
      '}',
      '',
      ...(options.parentAccepts
        ? [
            'if (import.meta.hot) {',
            "  import.meta.hot.accept('./browser-message.ts', (module) => {",
            "    if (module && typeof module === 'object' && 'message' in module) {",
            '      currentMessage = String(module.message)',
            '      renderMessage()',
            '    }',
            '  })',
            '}',
            '',
          ]
        : []),
    ].join('\n'),
  )
  await write(
    rootDir,
    'app/browser-message.ts',
    getBrowserInvalidationMessageSource(options.message),
  )
}

async function writeBrowserInvalidationMessage(rootDir: string, message: string): Promise<void> {
  await write(rootDir, 'app/browser-message.ts', getBrowserInvalidationMessageSource(message))
}

function getBrowserInvalidationMessageSource(message: string): string {
  return [
    `export const message = ${JSON.stringify(message)}`,
    '',
    'if (import.meta.hot) {',
    '  import.meta.hot.accept(() => {',
    "    import.meta.hot.invalidate('browser message boundary declined update')",
    '  })',
    '}',
    '',
  ].join('\n')
}

async function createNodeHmrFixture(
  options: {
    devProxy?: boolean
    slowAssetMs?: number
    slowDisposeMs?: number
    slowDocumentMs?: number
  } = {},
): Promise<NodeHmrFixture> {
  let tmpDir = path.join(packageDir, '.tmp')
  await fs.mkdir(tmpDir, { recursive: true })
  let rootDir = await fs.mkdtemp(path.join(tmpDir, 'node-hmr-e2e-'))

  await writeWorkspacePackageLinks(rootDir, [
    '@remix-run/assets',
    '@remix-run/node-hmr',
    '@remix-run/node-tsx',
  ])
  await write(
    rootDir,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
      },
    }),
  )
  await write(rootDir, 'server-message.ts', `export const serverMessage = 'Server: before'\n`)
  await write(rootDir, 'server-side-effect.ts', `export const sideEffect = 'initial'\n`)
  await write(rootDir, 'app/client-message.ts', getClientMessageSource('Client: before'))
  await write(rootDir, 'app/styles.css', '[data-testid="client-label"] { color: red; }\n')
  await write(
    rootDir,
    'app/entry.ts',
    [
      "import { clientMessage } from './client-message.ts'",
      '',
      'let clientLabel = document.querySelector(\'[data-testid="client-label"]\')',
      "if (!clientLabel) throw new Error('Missing client label')",
      '',
      'clientLabel.textContent = clientMessage',
      '',
      'if (import.meta.hot) {',
      '  import.meta.hot.accept() ',
      "  import.meta.hot.accept('./client-message.ts', (module) => {",
      "    if (module && typeof module === 'object' && 'clientMessage' in module) {",
      '      clientLabel.textContent = String(module.clientMessage)',
      '    }',
      '  })',
      '  import.meta.hot.on("server:update", async () => {',
      "    let response = await fetch('/', { headers: { Accept: 'text/html' } })",
      '    let html = await response.text()',
      '    let document = new DOMParser().parseFromString(html, "text/html")',
      '    let nextMessage = document.querySelector(\'[data-testid="server-message"]\')',
      '    let currentMessage = globalThis.document.querySelector(\'[data-testid="server-message"]\')',
      '    if (nextMessage && currentMessage) currentMessage.textContent = nextMessage.textContent',
      '    console.info("Server frame reload complete")',
      '  })',
      '}',
      '',
    ].join('\n'),
  )
  await write(rootDir, 'server.tsx', getNodeHmrServerSource(rootDir, options))
  await write(
    rootDir,
    'dev.ts',
    options.devProxy
      ? getNodeHmrProxyDevSource()
      : [
          `import { run } from ${JSON.stringify(nodeHmrImportUrl)}`,
          ``,
          `run('server.tsx', {`,
          `  nodeArgs: ['--import', ${JSON.stringify(nodeTsxImportUrl)}],`,
          `})`,
        ].join('\n'),
  )

  return {
    devProxy: options.devProxy === true,
    rootDir,
    async close() {
      await fs.rm(rootDir, { force: true, recursive: true })
    },
  }
}

function getClientMessageSource(message: string): string {
  return [`export const clientMessage = ${JSON.stringify(message)}`, ''].join('\n')
}
function getNodeHmrProxyDevSource(): string {
  return [
    "import { createServer } from 'node:http'",
    `import { createFetchProxy } from ${JSON.stringify(fetchProxyImportUrl)}`,
    `import { run } from ${JSON.stringify(nodeHmrImportUrl)}`,
    `import { createRequestListener } from ${JSON.stringify(nodeFetchServerImportUrl)}`,
    '',
    'let originPort = Number(process.env.TEST_SERVER_PORT ?? 0)',
    'let childPort = Number(process.env.TEST_CHILD_SERVER_PORT ?? 0)',
    "let proxyRetryMethods = ['GET', 'HEAD']",
    'let proxyRetryStatusCodes = [502, 503, 504]',
    '',
    "let app = run('server.tsx', {",
    '  env: process.env,',
    `  nodeArgs: ['--import', ${JSON.stringify(nodeTsxImportUrl)}],`,
    '})',
    '',
    'let proxyFetch = createFetchProxy(`http://127.0.0.1:${childPort}`, {',
    '  xForwardedHeaders: true,',
    '})',
    '',
    'let server = createServer(',
    '  createRequestListener((request) => fetchWhenReady(request), {',
    '    onError(error) {',
    "      console.error('[node-hmr-proxy:onError]', formatError(error))",
    "      return new Response('Internal Server Error', {",
    "        headers: { 'Content-Type': 'text/plain' },",
    '        status: 500,',
    '      })',
    '    },',
    '  }),',
    ')',
    '',
    'server.listen(originPort, "127.0.0.1")',
    '',
    'function createProxyRequest(request) {',
    '  return new Request(request.url, {',
    '    body: request.body,',
    '    headers: request.headers,',
    '    method: request.method,',
    '    redirect: request.redirect,',
    '    signal: request.signal,',
    '    ...getRequestDuplex(request),',
    '  })',
    '}',
    '',
    'async function fetchWhenReady(request) {',
    '  while (true) {',
    '    await app.ready()',
    '    let generation = app.generation',
    '    let response',
    '    try {',
    '      response = normalizeProxyResponse(await proxyFetch(createProxyRequest(request)))',
    '    } catch (error) {',
    "      console.error('[node-hmr-proxy:fetch-error]', JSON.stringify({",
    '        currentGeneration: app.generation,',
    '        error: formatError(error),',
    '        generation,',
    '        method: request.method,',
    '        url: request.url,',
    '      }))',
    '      await app.ready()',
    '      if (shouldRetryRequest(request) && app.generation !== generation) {',
    '        continue',
    '      }',
    '      throw error',
    '    }',
    '',
    '    if (response.status >= 500) {',
    "      console.error('[node-hmr-proxy:response]', JSON.stringify({",
    '        currentGeneration: app.generation,',
    '        generation,',
    '        method: request.method,',
    '        status: response.status,',
    '        url: request.url,',
    '      }))',
    '    }',
    '',
    '    if (!shouldRetryResponse(request, response)) {',
    '      return response',
    '    }',
    '    await app.ready()',
    '    if (app.generation !== generation) continue',
    '    return response',
    '  }',
    '}',
    '',
    'function normalizeProxyResponse(response) {',
    '  let headers = new Headers(response.headers)',
    "  headers.delete('Content-Encoding')",
    "  headers.delete('Content-Length')",
    "  headers.delete('Transfer-Encoding')",
    '  return new Response(response.body, {',
    '    headers,',
    '    status: response.status,',
    '    statusText: response.statusText,',
    '  })',
    '}',
    '',
    'function shouldRetryRequest(request) {',
    '  return proxyRetryMethods.includes(request.method)',
    '}',
    '',
    'function shouldRetryResponse(request, response) {',
    '  return shouldRetryRequest(request) && proxyRetryStatusCodes.includes(response.status)',
    '}',
    '',
    'function getRequestDuplex(request) {',
    "  if (request.method === 'GET' || request.method === 'HEAD') return undefined",
    "  return { duplex: 'half' }",
    '}',
    '',
    'function formatError(error) {',
    '  if (!(error instanceof Error)) return String(error)',
    '  return JSON.stringify({',
    '    cause: error.cause instanceof Error ? {',
    '      message: error.cause.message,',
    '      name: error.cause.name,',
    '      stack: error.cause.stack,',
    '    } : error.cause,',
    '    message: error.message,',
    '    name: error.name,',
    '    stack: error.stack,',
    '  })',
    '}',
    '',
  ].join('\n')
}

function getNodeHmrServerSource(
  rootDir: string,
  options: {
    slowAssetMs?: number
    slowDisposeMs?: number
    slowDocumentMs?: number
    title?: string
  } = {},
): string {
  let appDir = path.relative(workspaceDir, path.join(rootDir, 'app'))

  return [
    "import { createServer } from 'node:http'",
    "import { createAssetServer } from '@remix-run/assets'",
    "import { createBrowserHmrChannel, emitServerReady } from '@remix-run/node-hmr/runtime'",
    "import { serverMessage } from './server-message.ts'",
    "import { sideEffect } from './server-side-effect.ts'",
    '',
    "let title = '" + (options.title ?? 'Initial') + "'",
    `let slowAssetMs = ${JSON.stringify(options.slowAssetMs ?? 0)}`,
    `let slowDisposeMs = ${JSON.stringify(options.slowDisposeMs ?? 0)}`,
    `let slowDocumentMs = ${JSON.stringify(options.slowDocumentMs ?? 0)}`,
    'void sideEffect',
    'let assetServer = createAssetServer({',
    `  allow: [${JSON.stringify(`${appDir}/**`)}],`,
    "  basePath: '/assets',",
    '  fileMap: {',
    `    '/app/*path': ${JSON.stringify(`${appDir}/*path`)},`,
    '  },',
    '  hmr: createBrowserHmrChannel,',
    '  onError(error) {',
    '    console.error(error)',
    '  },',
    `  rootDir: ${JSON.stringify(workspaceDir)},`,
    '  watch: {',
    '    poll: true,',
    '    pollInterval: 50,',
    '  },',
    '})',
    '',
    'function renderDocument() {',
    '  return [',
    "    '<!doctype html>',",
    "    '<html>',",
    "    '<head>',",
    '    `<title>${title}</title>`,',
    '    \'<link rel="stylesheet" href="/assets/app/styles.css">\',',
    "    '</head>',",
    "    '<body>',",
    "    '<main>',",
    '    \'<input data-testid="document-field">\',',
    '    `<p data-testid="server-message">${serverMessage}</p>`,',
    '    \'<input data-testid="client-field">\',',
    '    \'<span data-testid="client-label"></span>\',',
    "    '</main>',",
    '    \'<script src="/assets/app/entry.ts" type="module"></script>\',',
    "    '</body>',",
    "    '</html>',",
    "    '',",
    "  ].join('\\n')",
    '}',
    '',
    'let server = createServer(async (request, response) => {',
    '  try {',
    "    let host = request.headers.host ?? '127.0.0.1'",
    "    let url = new URL(request.url ?? '/', `http://${host}`)",
    '',
    "    if (url.pathname === '/') {",
    '      await delay(slowDocumentMs)',
    '      await writeFetchResponse(',
    '        response,',
    '        new Response(renderDocument(), {',
    '          headers: {',
    "            'Cache-Control': 'no-cache',",
    "            'Content-Type': 'text/html; charset=utf-8',",
    '          },',
    '        }),',
    '      )',
    '      return',
    '    }',
    '',
    "    if (url.pathname.startsWith('/assets/')) {",
    '      await delay(slowAssetMs)',
    '      let assetResponse = await assetServer.fetch(',
    '        new Request(url, {',
    '          headers: toFetchHeaders(request.headers),',
    '          method: request.method,',
    '        }),',
    '      )',
    '      if (assetResponse) {',
    '        await writeFetchResponse(response, assetResponse)',
    '        return',
    '      }',
    '    }',
    '',
    "    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })",
    "    response.end('Not Found')",
    '  } catch (error) {',
    "    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })",
    '    response.end(error instanceof Error ? error.stack : String(error))',
    '  }',
    '})',
    '',
    'server.listen(Number(process.env.TEST_CHILD_SERVER_PORT ?? process.env.TEST_SERVER_PORT ?? 0), "127.0.0.1", () => {',
    '  let address = server.address()',
    "  if (address && typeof address === 'object') {",
    '    emitServerReady()',
    "    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))",
    '  }',
    '})',
    '',
    'if (import.meta.hot) {',
    '  import.meta.hot.accept()',
    '  import.meta.hot.dispose(async () => {',
    '    await assetServer.close()',
    '    server.closeAllConnections()',
    '    await new Promise((resolve) => server.close(resolve))',
    '    await delay(slowDisposeMs)',
    '  })',
    '}',
    '',
    'function toFetchHeaders(headers) {',
    '  let result = new Headers()',
    '  for (let [name, value] of Object.entries(headers)) {',
    '    if (value === undefined) continue',
    '    if (Array.isArray(value)) {',
    '      for (let item of value) result.append(name, item)',
    '    } else {',
    '      result.set(name, value)',
    '    }',
    '  }',
    '  return result',
    '}',
    '',
    'async function writeFetchResponse(response, fetchResponse) {',
    '  response.writeHead(fetchResponse.status, Object.fromEntries(fetchResponse.headers))',
    '  if (!fetchResponse.body) {',
    '    response.end()',
    '    return',
    '  }',
    '  let reader = fetchResponse.body.getReader()',
    '  try {',
    '    while (true) {',
    '      let { done, value } = await reader.read()',
    '      if (done) break',
    '      response.write(value)',
    '    }',
    '  } finally {',
    '    response.end()',
    '    reader.releaseLock()',
    '  }',
    '}',
    '',
    'async function delay(ms) {',
    '  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))',
    '}',
    '',
  ].join('\n')
}
async function writeWorkspacePackageLinks(rootDir: string, packageNames: string[]): Promise<void> {
  await Promise.all(
    packageNames.map(async (packageName) => {
      let packagePath = path.join(workspaceDir, 'packages', packageName.replace('@remix-run/', ''))
      let linkPath = path.join(rootDir, 'node_modules', ...packageName.split('/'))
      await fs.mkdir(path.dirname(linkPath), { recursive: true })
      await fs.symlink(packagePath, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
    }),
  )
}

async function createHmrTestServer(fixture: HmrFixture): Promise<HmrTestServer> {
  let appDir = path.relative(workspaceDir, path.join(fixture.rootDir, 'app'))
  let hmrEventStream: ReturnType<typeof createTestHmrEventStream> | undefined
  let browserHmrFileEventHandlers = new Set<BrowserHmrFileEventHandler>()
  let browserHmrWatcher: FSWatcher | undefined

  let createCurrentAssetServer = () =>
    createAssetServer({
      allow: [`${appDir}/**`],
      basePath: '/assets',
      fileMap: {
        '/app/*path': `${appDir}/*path`,
      },
      hmr: () => ({
        close() {
          browserHmrFileEventHandlers.clear()
        },
        onFileEvents(handler) {
          browserHmrFileEventHandlers.add(handler)
          return () => {
            browserHmrFileEventHandlers.delete(handler)
          }
        },
        updateWatchedFiles() {},
        url: '/hmr/events',
      }),
      onError() {},
      rootDir: workspaceDir,
      watch: {
        poll: true,
        pollInterval: 50,
      },
    })
  let assetServer: AssetServer | undefined = createCurrentAssetServer()

  async function startAssets(): Promise<void> {
    if (assetServer) return
    hmrEventStream = createTestHmrEventStream()
    assetServer = createCurrentAssetServer()
    startBrowserHmrWatcher()
  }

  async function stopAssets(): Promise<void> {
    await assetServer?.close()
    assetServer = undefined
    await browserHmrWatcher?.close()
    browserHmrWatcher = undefined
    hmrEventStream?.close()
    hmrEventStream = undefined
  }

  hmrEventStream = createTestHmrEventStream()
  startBrowserHmrWatcher()

  let server = http.createServer(async (request, response) => {
    try {
      await handleRequest(request, response, fixture, assetServer, hmrEventStream)
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.stack : String(error))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, () => {
      server.off('error', reject)
      resolve()
    })
  })

  let address = server.address()
  assert.ok(address && typeof address === 'object')

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async restartAssets() {
      await stopAssets()
      await startAssets()
    },
    startAssets,
    stopAssets,
    async close() {
      await assetServer?.close()
      await browserHmrWatcher?.close()
      hmrEventStream?.close()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    },
  }

  function startBrowserHmrWatcher(): void {
    if (browserHmrWatcher) return

    browserHmrWatcher = watch(path.join(fixture.rootDir, 'app'), {
      ignoreInitial: true,
      interval: 50,
      usePolling: true,
    })

    browserHmrWatcher.on('all', (event, filePath) => {
      if (event !== 'add' && event !== 'change' && event !== 'unlink') return
      handleBrowserHmrFileEvent({ event, filePath }).catch((error: unknown) => {
        console.error(error)
      })
    })
  }

  async function handleBrowserHmrFileEvent(event: BrowserHmrFileEvent): Promise<void> {
    let filePath = await getWatchEventFilePath(event.filePath)
    let normalizedEvent = { ...event, filePath }

    for (let handleFileEvents of browserHmrFileEventHandlers) {
      let browserHmrEvents = await handleFileEvents([normalizedEvent])
      for (let browserHmrEvent of browserHmrEvents) {
        if (browserHmrEvent.type === 'reload') {
          hmrEventStream?.send({ type: 'browser:reload' })
          continue
        }

        hmrEventStream?.send({
          timestamp: browserHmrEvent.timestamp,
          type: 'browser:update',
          updates: browserHmrEvent.updates,
        })
      }
    }
  }
}

async function getWatchEventFilePath(filePath: string): Promise<string> {
  try {
    return await fs.realpath(filePath)
  } catch (error) {
    if (!isNoEntityError(error)) throw error
    return path.join(await fs.realpath(path.dirname(filePath)), path.basename(filePath))
  }
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  )
}

async function startNodeHmrFixtureServer(fixture: NodeHmrFixture): Promise<NodeHmrTestServer> {
  let { NODE_PATH: _nodePath, ...env } = process.env
  let port = await getAvailablePort()
  let childPort = fixture.devProxy ? await getAvailablePort() : undefined
  let child = spawn(process.execPath, ['dev.ts'], {
    cwd: fixture.rootDir,
    env: {
      ...env,
      NODE_ENV: 'development',
      ...(childPort === undefined ? {} : { TEST_CHILD_SERVER_PORT: String(childPort) }),
      TEST_SERVER_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let readyEvents: Array<{ pid: number; port: number }> = []
  let readyWaiters: Array<() => void> = []
  let lineBuffer = ''
  let processOutput = ''
  let exit: { code: number | null; signal: NodeJS.Signals | null } | null = null
  let closePromise: Promise<void> | undefined

  child.stdout?.setEncoding('utf-8')
  child.stdout?.on('data', (chunk: string) => {
    processOutput += chunk
    lineBuffer += chunk

    let lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''

    for (let line of lines) {
      let event = parseReadyEvent(line)
      if (event === null) continue

      readyEvents.push(event)
      for (let waiter of readyWaiters) waiter()
      readyWaiters = []
    }
  })

  child.stderr?.setEncoding('utf-8')
  child.stderr?.on('data', (chunk: string) => {
    processOutput += chunk
  })

  child.once('exit', (code, signal) => {
    exit = { code, signal }
  })

  await waitForReadyEvent(0)

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      closePromise ??= stopProcess(child)
      await closePromise
    },
    get output() {
      return processOutput
    },
    get readyCount() {
      return readyEvents.length
    },
    waitForReady: waitForReadyEvent,
  }

  async function waitForReadyEvent(index: number): Promise<{ pid: number; port: number }> {
    await waitFor(
      () => readyEvents[index] !== undefined,
      () => {
        let exitText = exit
          ? ` Process exited with code ${exit.code} and signal ${exit.signal}.`
          : ''
        return `Timed out waiting for node-hmr fixture server.${exitText}\n${processOutput}`
      },
    )

    let event = readyEvents[index]
    assert.ok(event)
    return event
  }
}

async function getAvailablePort(): Promise<number> {
  let server = http.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  let address = server.address()
  assert.ok(address && typeof address === 'object')
  let port = address.port
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
  return port
}

async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  fixture: HmrFixture,
  assetServer: AssetServer | undefined,
  hmrEventStream: ReturnType<typeof createTestHmrEventStream> | undefined,
): Promise<void> {
  let host = request.headers.host ?? '127.0.0.1'
  let url = new URL(request.url ?? '/', `http://${host}`)

  if (url.pathname === '/') {
    if (!assetServer) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Asset server is not running')
      return
    }

    let headers = {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    }
    if (fixture.renderDocument) {
      await writeFetchResponse(
        response,
        new Response(await fixture.renderDocument(assetServer), { headers }),
      )
      return
    }
    response.writeHead(200, headers)
    response.end(await fs.readFile(path.join(fixture.rootDir, 'index.html'), 'utf-8'))
    return
  }

  if (hmrEventStream && url.pathname === '/hmr/events') {
    await writeFetchResponse(response, hmrEventStream.connect())
    return
  }

  if (assetServer && url.pathname.startsWith('/assets/')) {
    let assetResponse = await assetServer.fetch(
      new Request(url, {
        headers: toFetchHeaders(request.headers),
        method: request.method,
      }),
    )
    if (assetResponse) {
      await writeFetchResponse(response, assetResponse)
      return
    }
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end('Not Found')
}

function createTestHmrEventStream() {
  let clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  let encoder = new TextEncoder()

  let sendComment = (comment: string) => {
    let event = encoder.encode(`: ${comment}\n\n`)
    for (let client of clients) client.enqueue(event)
  }

  let send = (payload: HmrPayload) => {
    let event = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
    for (let client of clients) client.enqueue(event)
  }

  return {
    close() {
      for (let client of clients) client.close()
      clients.clear()
    },
    connect() {
      let client: ReadableStreamDefaultController<Uint8Array>
      let stream = new ReadableStream<Uint8Array>({
        start(controller) {
          client = controller
          clients.add(controller)
          sendComment('connected')
        },
        cancel() {
          clients.delete(client)
        },
      })

      return new Response(stream, {
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/event-stream; charset=utf-8',
        },
      })
    },
    send,
  }
}

function toFetchHeaders(headers: http.IncomingHttpHeaders): Headers {
  let result = new Headers()

  for (let [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (let item of value) result.append(name, item)
    } else {
      result.set(name, value)
    }
  }

  return result
}

async function writeFetchResponse(
  response: http.ServerResponse,
  fetchResponse: Response,
): Promise<void> {
  response.writeHead(fetchResponse.status, Object.fromEntries(fetchResponse.headers))

  if (!fetchResponse.body) {
    response.end()
    return
  }

  let reader = fetchResponse.body.getReader()
  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      response.write(value)
    }
  } finally {
    response.end()
    reader.releaseLock()
  }
}

function waitForConsoleMessage(page: TestPage, text: string): Promise<void> {
  attachPageDiagnostics(page)
  return new Promise((resolve, reject) => {
    let consoleMessages: string[] = []
    let pageErrors: string[] = []
    let timeout = setTimeout(() => {
      reject(
        new Error(
          [
            `Timed out waiting for console message: ${text}`,
            ...consoleMessages.map((message) => `console: ${message}`),
            ...pageErrors.map((message) => `pageerror: ${message}`),
            formatPageDiagnostics(page),
          ].join('\n'),
        ),
      )
    }, 5000)

    page.on('console', handleConsole)
    page.on('pageerror', handlePageError)

    function handleConsole(message: { text(): string }) {
      consoleMessages.push(message.text())
      if (message.text().includes(text)) {
        clearTimeout(timeout)
        page.off('console', handleConsole)
        page.off('pageerror', handlePageError)
        resolve()
      }
    }

    function handlePageError(error: Error) {
      pageErrors.push(error.stack ?? error.message)
    }
  })
}

function waitForNavigation(page: TestPage): Promise<void> {
  attachPageDiagnostics(page)
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      page.off('framenavigated', handleFrameNavigated)
      reject(new Error(`Timed out waiting for page navigation\n${formatPageDiagnostics(page)}`))
    }, 5000)

    page.on('framenavigated', handleFrameNavigated)

    function handleFrameNavigated(frame: { parentFrame(): unknown }) {
      if (frame.parentFrame() !== null) return
      clearTimeout(timeout)
      page.off('framenavigated', handleFrameNavigated)
      resolve()
    }
  })
}

async function ignoreAbortedNavigation(navigation: Promise<unknown>): Promise<void> {
  try {
    await navigation
  } catch (error) {
    if (error instanceof Error && error.message.includes('net::ERR_ABORTED')) return
    throw error
  }
}

function monitorLocalRequestFailures(
  page: TestPage,
  baseUrl: string,
): { assertNone(diagnostics?: string): Promise<void> } {
  let origin = new URL(baseUrl).origin
  let failures: string[] = []
  let failureDetails: Array<Promise<void>> = []

  page.on('response', (response) => {
    let url = new URL(response.url())
    if (url.origin !== origin) return
    if (response.status() < 400) return

    failureDetails.push(
      response
        .text()
        .then((body) => {
          failures.push(`${response.status()} ${url.pathname}${url.search}\n${body.slice(0, 500)}`)
        })
        .catch(() => {
          failures.push(`${response.status()} ${url.pathname}${url.search}`)
        }),
    )
  })

  page.on('requestfailed', (request) => {
    let url = new URL(request.url())
    if (url.origin !== origin) return

    let failureText = request.failure()?.errorText
    if (failureText === 'net::ERR_ABORTED') return

    let reason = failureText ? ` (${failureText})` : ''
    failures.push(`${request.method()} ${url.pathname}${url.search}${reason}`)
  })

  return {
    async assertNone(diagnostics?: string) {
      await Promise.all(failureDetails)
      let message = failures.join('\n')
      if (message && diagnostics) {
        message += `\n\nDev server output:\n${diagnostics}`
      }
      assert.equal(message, '')
    },
  }
}

async function assertCount(page: TestPage, count: string): Promise<void> {
  try {
    await waitForText(page, '[data-testid="count"]', count)
  } catch (error) {
    let actual = await page.locator('[data-testid="count"]').textContent()
    assert.equal(actual?.trim(), count)
    throw error
  }
}

async function waitForText(page: TestPage, selector: string, text: string): Promise<void> {
  attachPageDiagnostics(page)
  try {
    await page.waitForFunction(
      ({ selector, text }) => document.querySelector(selector)?.textContent?.trim() === text,
      { selector, text },
      { timeout: 5000 },
    )
  } catch (error) {
    let actualText = await page
      .locator(selector)
      .textContent({ timeout: 100 })
      .catch(() => '<missing>')
    let bodyText = await page
      .locator('body')
      .textContent({ timeout: 100 })
      .catch(() => '<missing body>')
    let message = error instanceof Error ? error.message : String(error)
    throw new Error(
      [
        `Timed out waiting for text: ${selector} = ${JSON.stringify(text)}`,
        `Actual text: ${JSON.stringify(actualText?.trim())}`,
        `Body text: ${JSON.stringify(bodyText?.trim().slice(0, 1000))}`,
        message,
        formatPageDiagnostics(page),
      ].join('\n'),
    )
  }
}

async function waitForComputedStyle(
  page: TestPage,
  selector: string,
  property: string,
  value: string,
): Promise<void> {
  await page.waitForFunction(
    ({ selector, property, value }) => {
      let element = document.querySelector(selector)
      return element && getComputedStyle(element).getPropertyValue(property) === value
    },
    { selector, property, value },
    { timeout: 5000 },
  )
}

async function monitorComputedStyle(
  page: TestPage,
  options: {
    duration: number
    property: string
    selector: string
    value: string
  },
): Promise<Array<{ elapsed: number; value: string | null }>> {
  return page.evaluate(async (options) => {
    let failures: Array<{ elapsed: number; value: string | null }> = []
    let started = performance.now()

    while (performance.now() - started < options.duration) {
      let element = document.querySelector(options.selector)
      let actual = element ? getComputedStyle(element).getPropertyValue(options.property) : null
      if (actual !== options.value) {
        failures.push({
          elapsed: Math.round(performance.now() - started),
          value: actual,
        })
      }
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }

    return failures
  }, options)
}

function waitForStylesheetResponse(
  page: TestPage,
  status: number,
  options: { pathname?: string; timeout?: number } = {},
) {
  return page.waitForResponse(
    (response) => {
      let url = new URL(response.url())
      return (
        url.pathname === (options.pathname ?? '/assets/app/styles.css') &&
        url.searchParams.has('t') &&
        response.status() === status
      )
    },
    { timeout: options.timeout ?? 5000 },
  )
}

async function getStylesheetLinkHasTimestamp(page: TestPage, pathname: string): Promise<boolean> {
  return page.evaluate((pathname) => {
    let link = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((link) => {
      let url = new URL((link as HTMLLinkElement).href)
      return url.pathname === pathname
    })

    return link instanceof HTMLLinkElement && new URL(link.href).searchParams.has('t')
  }, pathname)
}

async function get(page: TestPage, pathname: string): Promise<void> {
  let response = await page.request.get(pathname)
  assert.ok(response.ok())
}

async function waitForStylesheetLinkCount(
  page: TestPage,
  pathname: string,
  count: number,
): Promise<void> {
  await page.waitForFunction(
    ({ count, pathname }) =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter((link) => {
        let url = new URL((link as HTMLLinkElement).href)
        return url.pathname === pathname
      }).length === count,
    { count, pathname },
    { timeout: 5000 },
  )
}

async function waitFor(
  check: () => boolean | Promise<boolean>,
  getTimeoutMessage: () => string = () => 'Timed out waiting for condition',
): Promise<void> {
  let start = Date.now()

  while (Date.now() - start < 5_000) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(getTimeoutMessage())
}

function parseReadyEvent(line: string): { pid: number; port: number } | null {
  try {
    let event: unknown = JSON.parse(line)
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'ready' &&
      'port' in event &&
      typeof event.port === 'number' &&
      'pid' in event &&
      typeof event.pid === 'number'
    ) {
      return {
        pid: event.pid,
        port: event.port,
      }
    }
  } catch {
    // Ignore non-JSON process output.
  }

  return null
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolve) => {
    let timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5_000)

    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })

    child.kill('SIGTERM')
  })
}

async function write(rootDir: string, rel: string, content: string): Promise<void> {
  let filePath = path.join(rootDir, rel)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content)
}
