import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { renderToStream } from '@remix-run/ui/server'
import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { watch, type FSWatcher } from 'chokidar'
import { createAssetServer, type AssetServer } from '@remix-run/assets'
import { uiHmr } from '../src/assets.ts'

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
const uiHmrNodeImportUrl = pathToFileURL(path.resolve(packageDir, 'src/node.ts')).href
const isBun = 'Bun' in globalThis
const consoleMessageTimeout = 5000
const hmrConnectionTimeout = process.platform === 'win32' ? 15_000 : consoleMessageTimeout

declare global {
  var __counterInitialValue: number
}

describe('ui-hmr e2e', { skip: isBun }, () => {
  it('updates component render output without losing setup state', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await assertCount(page, 'Count: 3')
    await page.locator('[data-testid="field"]').fill('hello')
    await page.evaluate(() => {
      globalThis.__counterInitialValue = 100
    })

    let counterPath = path.join(fixture.rootDir, 'app/Counter.tsx')
    let counterSource = await fs.readFile(counterPath, 'utf-8')
    await fs.writeFile(counterPath, counterSource.replace('Increment', 'Increment via HMR'))

    await waitForText(page, '[data-testid="increment"]', 'Increment via HMR')
    await assertCount(page, 'Count: 3')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'hello')
  })

  it('reloads the page when a non-component export is added to a component module', async (t) => {
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
      'app/Counter.tsx',
      [
        ...getCounterComponentSource({
          buttonText: 'Increment after reload',
          countText: 'Count: {count}',
        }),
        'export const loader = () => new Response("ok")',
        '',
      ].join('\n'),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after reload')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('reloads the page when a non-component export is removed from a component module', async (t) => {
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
      'app/Counter.tsx',
      getCounterComponentSource({
        buttonText: 'Increment after export removal',
        countText: 'Count: {count}',
      }).join('\n'),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after export removal')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('reloads the page when a non-component export changes in a component module', async (t) => {
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
      'app/Counter.tsx',
      [
        ...getCounterComponentSource({
          buttonText: 'Increment after export change',
          countText: 'Count: {count}',
        }),
        'export const foo = false',
        '',
      ].join('\n'),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after export change')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('updates component render output when non-component exports are strictly equal', async (t) => {
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
      'app/Counter.tsx',
      [
        ...getCounterComponentSource({
          buttonText: 'Increment with stable export',
          countText: 'Count: {count}',
        }),
        "import { foo } from './stable.ts'",
        'export { foo }',
        '',
      ].join('\n'),
    )

    await waitForText(page, '[data-testid="increment"]', 'Increment with stable export')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'typed before update')
  })

  it('reloads the page when an object non-component export is recreated', async (t) => {
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
      'app/Counter.tsx',
      [
        ...getCounterComponentSource({
          buttonText: 'Increment after object export',
          countText: 'Count: {count}',
        }),
        'export const foo = {}',
        '',
      ].join('\n'),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after object export')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('reloads the page when a component export is added to a component HMR module', async (t) => {
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
      'app/Counter.tsx',
      [
        ...getCounterComponentSource({
          buttonText: 'Increment after export add',
          countText: 'Count: {count}',
        }),
        'export function AddedComponent() {',
        '  return () => <p>Added</p>',
        '}',
        '',
      ].join('\n'),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after export add')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('reloads the page when a component export is removed from a component HMR module', async (t) => {
    let fixture = await createHmrFixture({
      counterExtraExports: [
        'export function RemovedComponent() {',
        '  return () => <p>Removed</p>',
        '}',
        '',
      ].join('\n'),
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
      'app/Counter.tsx',
      getCounterComponentSource({
        buttonText: 'Increment after export removal',
        countText: 'Count: {count}',
      }).join('\n'),
    )

    await reloaded
    await waitForText(page, '[data-testid="increment"]', 'Increment after export removal')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), '')
  })

  it('remounts the component when setup scope changes', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await assertCount(page, 'Count: 3')

    let counterPath = path.join(fixture.rootDir, 'app/Counter.tsx')
    let counterSource = await fs.readFile(counterPath, 'utf-8')
    await fs.writeFile(
      counterPath,
      counterSource.replace('let count = globalThis.__counterInitialValue', 'let count = 100'),
    )

    await assertCount(page, 'Count: 100')
  })

  it('runs new setup scope for each remounted component instance', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)

    await write(
      fixture.rootDir,
      'app/entry.tsx',
      [
        "import { createRoot } from '@remix-run/ui'",
        "import { Counter } from './Counter.tsx'",
        '',
        'globalThis.__counterInitialValue = 3',
        '',
        "let app = document.getElementById('app')",
        "if (!app) throw new Error('Missing app container')",
        '',
        'createRoot(app).render(',
        '  <>',
        '    <Counter label="first" />',
        '    <Counter label="second" />',
        '  </>,',
        ')',
        '',
      ].join('\n'),
    )
    await write(
      fixture.rootDir,
      'app/Counter.tsx',
      [
        "import type { Handle } from '@remix-run/ui'",
        '',
        'declare global {',
        '  var __counterInitialValue: number',
        '}',
        '',
        'export function Counter(handle: Handle<{ label: string }>) {',
        '  let count = globalThis.__counterInitialValue',
        '',
        '  return () => (',
        '    <p data-testid={`count-${handle.props.label}`}>',
        '      Count {handle.props.label}: {count}',
        '    </p>',
        '  )',
        '}',
        '',
      ].join('\n'),
    )

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForText(page, '[data-testid="count-first"]', 'Count first: 3')
    await waitForText(page, '[data-testid="count-second"]', 'Count second: 3')

    let counterPath = path.join(fixture.rootDir, 'app/Counter.tsx')
    let counterSource = await fs.readFile(counterPath, 'utf-8')
    await fs.writeFile(
      counterPath,
      counterSource
        .replace(
          '  let count = globalThis.__counterInitialValue',
          '  let label = "Updated"\n  let count = globalThis.__counterInitialValue',
        )
        .replace('Count {handle.props.label}: {count}', '{label}: {count}'),
    )

    await waitForText(page, '[data-testid="count-first"]', 'Updated: 3')
    await waitForText(page, '[data-testid="count-second"]', 'Updated: 3')
  })

  it('hydrates and preserves a setup function callback after an HMR update', async (t) => {
    let fixture = await createServerFrameHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')
    let hydrated = waitForConsoleMessage(page, 'Frame adoption complete')

    await page.goto('/')
    await connected
    await hydrated
    await waitForText(page, '[data-testid="callback-button"]', 'Run callback before HMR')

    await page.locator('[data-testid="callback-button"]').click()
    await waitForText(page, '[data-testid="callback-output"]', 'Run callback before HMR')

    let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
    let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
    await fs.writeFile(
      clientFieldPath,
      clientFieldSource.replace('Run callback before HMR', 'Run callback after HMR'),
    )

    await waitForText(page, '[data-testid="callback-button"]', 'Run callback after HMR')
    await page.locator('[data-testid="callback-button"]').click()
    await waitForText(page, '[data-testid="callback-output"]', 'Run callback after HMR')
  })

  it('updates a client entry after a failed HMR transform is fixed', async (t) => {
    let fixture = await createServerFrameHmrFixture()
    t.after(fixture.close)

    let page = await t.serve(await createHmrTestServer(fixture))
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')

    let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
    let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')

    await fs.writeFile(clientFieldPath, clientFieldSource.replace("'Client: before'", "'Client:"))
    await waitForConsoleMessage(page, '[remix] HMR update failed')
    await page.waitForTimeout(100)

    await fs.writeFile(
      clientFieldPath,
      clientFieldSource.replace('Client: before', 'Client: after!!!!!'),
    )

    await waitForText(page, '[data-testid="server-client-label"]', 'Client: after!!!!!')
  })

  it('recovers failed client entry updates after the HMR event stream reconnects', async (t) => {
    let fixture = await createServerFrameHmrFixture()
    t.after(fixture.close)

    let server = await createHmrTestServer(fixture)
    let page = await t.serve(server)
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')

    let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
    let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')

    await fs.writeFile(clientFieldPath, clientFieldSource.replace("'Client: before'", "'Client:"))
    await waitForConsoleMessage(page, '[remix] HMR update failed')

    let lostConnection = waitForConsoleMessage(page, '[remix] HMR connection lost')
    await server.restartAssets()
    await lostConnection

    await fs.writeFile(
      clientFieldPath,
      clientFieldSource.replace('Client: before', 'Client: after reconnect!!!!!'),
    )

    let reconnected = waitForConsoleMessage(page, '[remix] HMR connected')
    await server.restartAssets()
    await reconnected

    await waitForText(page, '[data-testid="server-client-label"]', 'Client: after reconnect!!!!!')
  })

  it('recovers failed client entry updates after a server update from node-hmr', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')

      let failedUpdate = waitForConsoleMessage(page, '[remix] HMR update failed')
      await fs.writeFile(
        clientFieldPath,
        clientFieldSource.replace('<ClientMessage />', '<ClientMessage'),
      )
      await failedUpdate

      await fs.writeFile(
        clientFieldPath,
        clientFieldSource.replace('<ClientMessage />', 'Client: after server update!!!!!'),
      )

      let serverFrameReloaded = waitForConsoleMessage(page, 'Server frame reload complete')
      await write(
        fixture.rootDir,
        'server-side-effect.ts',
        `export const sideEffect = 'recovery'\n`,
      )
      await serverFrameReloaded

      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after server update!!!!!',
      )
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('handles component, stylesheet, and server updates through node-hmr', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await waitForComputedStyle(
        page,
        '[data-testid="server-client-label"]',
        'color',
        'rgb(255, 0, 0)',
      )

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      await fs.writeFile(
        clientFieldPath,
        clientFieldSource.replace('<ClientMessage />', 'Client: component update'),
      )
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: component update')
      assert.equal(server.readyCount, 1)

      let styleRequest = waitForStylesheetResponse(page, 200)
      await write(
        fixture.rootDir,
        'app/styles.css',
        '[data-testid="server-client-label"] { color: blue; }\n',
      )
      await styleRequest
      await waitForComputedStyle(
        page,
        '[data-testid="server-client-label"]',
        'color',
        'rgb(0, 0, 255)',
      )
      assert.equal(server.readyCount, 1)

      await write(fixture.rootDir, 'server-side-effect.ts', `export const sideEffect = 'mixed'\n`)
      await waitForConsoleMessage(page, 'Server frame reload complete')
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page when the browser entry updates', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')
      await page.locator('[data-testid="document-field"]').fill('state before entry update')

      let entryPath = path.join(fixture.rootDir, 'app/entry.tsx')
      let entrySource = await fs.readFile(entryPath, 'utf-8')
      let reloaded = waitForNavigation(page)
      await fs.writeFile(
        entryPath,
        entrySource.replace('Frame adoption failed:', 'Updated frame adoption failed:'),
      )
      await reloaded
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('commits a server update from a transitive server module', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')
      await page.locator('[data-testid="document-field"]').fill('preserved browser state')

      let frameResponsePromise = page.waitForResponse((response) => {
        let url = new URL(response.url())
        return url.pathname === '/' && response.request().headers().accept === 'text/html'
      })
      let serverFrameReloaded = waitForConsoleMessage(page, 'Server frame reload complete')
      await write(
        fixture.rootDir,
        'server-message.ts',
        `export const serverMessage = 'Server: after server update'\n`,
      )

      let frameResponse = await frameResponsePromise
      assert.equal(frameResponse.status(), 200)
      assert.match(frameResponse.headers()['content-type'] ?? '', /^text\/html\b/)
      assert.match(await frameResponse.text(), /Server: after server update/)

      await serverFrameReloaded
      await waitForText(page, '[data-testid="server-message"]', 'Server: after server update')
      assert.equal(
        await page.locator('[data-testid="document-field"]').inputValue(),
        'preserved browser state',
      )
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a node-hmr client entry export is added', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      let reloaded = waitForNavigation(page)
      await fs.writeFile(
        clientFieldPath,
        [
          clientFieldSource.replace('<ClientMessage />', 'Client: after export add'),
          'export function AddedComponent() {',
          '  return () => <p>Added</p>',
          '}',
          '',
        ].join('\n'),
      )

      await reloaded
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: after export add')
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a server-imported node-hmr client entry export is added', async (t) => {
    let fixture = await createNodeHmrFixture({ serverImportsClientField: true })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')
      let hydrated = waitForConsoleMessage(page, 'Frame adoption complete')

      await page.goto('/')
      await connected
      await hydrated
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      let reloaded = waitForNavigation(page)
      await fs.writeFile(
        clientFieldPath,
        [
          clientFieldSource.replace('<ClientMessage />', 'Client: after shared export add'),
          'export function AddedComponent() {',
          '  return () => <p>Added</p>',
          '}',
          '',
        ].join('\n'),
      )

      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after shared export add',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a server-imported node-hmr client entry export is removed', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: 'export const foo = true\n',
      serverImportsClientField: true,
    })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForNavigation(page)
      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({ child: 'Client: after shared export removal' }),
      )

      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after shared export removal',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a server-imported node-hmr client entry changes a non-component export', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: 'export const foo = true\n',
      serverImportsClientField: true,
    })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForNavigation(page)
      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({
          child: 'Client: after shared export change',
          extraExports: 'export const foo = false\n',
        }),
      )

      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after shared export change',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 2)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('updates a server-imported node-hmr client entry when non-component exports are strictly equal', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: ["import { foo } from './stable.ts'", 'export { foo }', ''].join(
        '\n',
      ),
      serverImportsClientField: true,
    })
    let server: NodeHmrTestServer | undefined

    try {
      await write(fixture.rootDir, 'app/stable.ts', 'export const foo = {}\n')
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before update')
      await page.locator('[data-testid="document-field"]').fill('document before update')

      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({
          child: 'Client: shared stable export update',
          extraExports: ["import { foo } from './stable.ts'", 'export { foo }', ''].join('\n'),
        }),
      )

      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: shared stable export update',
      )
      assert.equal(
        await page.locator('[data-testid="server-client-field"]').inputValue(),
        'typed before update',
      )
      assert.equal(
        await page.locator('[data-testid="document-field"]').inputValue(),
        'document before update',
      )
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a node-hmr client entry export is removed', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: [
        'export function RemovedComponent() {',
        '  return () => <p>Removed</p>',
        '}',
        '',
      ].join('\n'),
    })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      let reloaded = waitForNavigation(page)
      await fs.writeFile(
        clientFieldPath,
        clientFieldSource
          .replace('<ClientMessage />', 'Client: after export removal')
          .replace(
            ['export function RemovedComponent() {', '  return () => <p>Removed</p>', '}', ''].join(
              '\n',
            ),
            '',
          ),
      )

      await reloaded
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: after export removal')
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a node-hmr client entry adds a non-component export', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      let reloaded = waitForNavigation(page)
      await fs.writeFile(
        clientFieldPath,
        [
          clientFieldSource.replace('<ClientMessage />', 'Client: after non-component export'),
          'export const loader = () => new Response("ok")',
          '',
        ].join('\n'),
      )

      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after non-component export',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a node-hmr client entry removes a non-component export', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: 'export const foo = true\n',
    })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForNavigation(page)
      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({ child: 'Client: after non-component export removal' }),
      )

      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after non-component export removal',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a node-hmr client entry changes a non-component export', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: 'export const foo = true\n',
    })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForNavigation(page)
      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({
          child: 'Client: after non-component export change',
          extraExports: 'export const foo = false\n',
        }),
      )

      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after non-component export change',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('updates a node-hmr client entry when non-component exports are strictly equal', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: ["import { foo } from './stable.ts'", 'export { foo }', ''].join(
        '\n',
      ),
    })
    let server: NodeHmrTestServer | undefined

    try {
      await write(fixture.rootDir, 'app/stable.ts', 'export const foo = {}\n')
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before update')
      await page.locator('[data-testid="document-field"]').fill('document before update')

      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({
          child: 'Client: stable export update',
          extraExports: ["import { foo } from './stable.ts'", 'export { foo }', ''].join('\n'),
        }),
      )

      await waitForText(page, '[data-testid="server-client-label"]', 'Client: stable export update')
      assert.equal(
        await page.locator('[data-testid="server-client-field"]').inputValue(),
        'typed before update',
      )
      assert.equal(
        await page.locator('[data-testid="document-field"]').inputValue(),
        'document before update',
      )
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a node-hmr client entry recreates an object non-component export', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: 'export const foo = {}\n',
    })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForNavigation(page)
      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({
          child: 'Client: after object export',
          extraExports: 'export const foo = {}\n',
        }),
      )

      await reloaded
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: after object export')
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('updates a node-hmr module imported by a client entry', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before update')

      await write(
        fixture.rootDir,
        'app/client-message.tsx',
        [
          'export function ClientMessage() {',
          '  return () => "Client: imported update"',
          '}',
          '',
        ].join('\n'),
      )

      await waitForText(page, '[data-testid="server-client-label"]', 'Client: imported update')
      assert.equal(
        await page.locator('[data-testid="server-client-field"]').inputValue(),
        'typed before update',
      )
      assert.equal(server.readyCount, 1)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('reloads the page after a node-hmr module imported by a client entry is rejected', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForNavigation(page)
      await write(
        fixture.rootDir,
        'app/client-message.tsx',
        [
          'export function ClientMessage() {',
          '  return () => "Client: imported rejected update"',
          '}',
          'export const loader = () => new Response("ok")',
          '',
        ].join('\n'),
      )

      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: imported rejected update',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
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

type HmrPayload =
  | {
      type: 'server:update'
    }
  | {
      data: Record<string, unknown>
      type: 'browser:update'
    }
  | {
      type: 'browser:reload'
    }

type BrowserHmrEvent =
  | {
      data: Record<string, unknown>
      files?: string[]
      type: 'update'
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
    counterExtraExports?: string
  } = {},
): Promise<HmrFixture> {
  let tmpDir = path.join(packageDir, '.tmp')
  await fs.mkdir(tmpDir, { recursive: true })
  let rootDir = await fs.mkdtemp(path.join(tmpDir, 'hmr-e2e-'))

  await writeWorkspacePackageLinks(rootDir, ['@remix-run/ui', '@remix-run/ui-hmr'])
  await write(
    rootDir,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@remix-run/ui',
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
  await write(
    rootDir,
    'app/entry.tsx',
    [
      "import { createRoot } from '@remix-run/ui'",
      "import { Counter } from './Counter.tsx'",
      '',
      'globalThis.__counterInitialValue = 3',
      '',
      "let app = document.getElementById('app')",
      "if (!app) throw new Error('Missing app container')",
      '',
      'createRoot(app).render(<Counter />)',
      '',
    ].join('\n'),
  )
  await write(
    rootDir,
    'app/Counter.tsx',
    [
      ...getCounterComponentSource({
        buttonText: 'Increment',
        countText: 'Count: {count}',
      }),
      options.counterExtraExports ?? '',
    ].join('\n'),
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
      await removeFixtureDir(rootDir)
    },
  }
}

function getCounterComponentSource(options: { buttonText: string; countText: string }): string[] {
  return [
    "import type { Handle } from '@remix-run/ui'",
    '',
    'declare global {',
    '  var __counterInitialValue: number',
    '}',
    '',
    'export function Counter(handle: Handle) {',
    '  void handle',
    '  let count = globalThis.__counterInitialValue',
    '',
    '  return () => (',
    '    <main>',
    '      <input data-testid="field" />',
    `      <p data-testid="count">${options.countText}</p>`,
    `      <button data-testid="increment">${options.buttonText}</button>`,
    '    </main>',
    '  )',
    '}',
    '',
  ]
}

async function createServerFrameHmrFixture(): Promise<HmrFixture> {
  let tmpDir = path.join(packageDir, '.tmp')
  await fs.mkdir(tmpDir, { recursive: true })
  let rootDir = await fs.mkdtemp(path.join(tmpDir, 'server-frame-hmr-e2e-'))

  await write(
    rootDir,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@remix-run/ui',
      },
    }),
  )
  await writeWorkspacePackageLinks(rootDir, ['@remix-run/ui', '@remix-run/ui-hmr'])
  await write(rootDir, 'server-message.txt', 'Server: before')
  await write(
    rootDir,
    'app/ClientField.tsx',
    [
      "import { type Handle, clientEntry, on } from '@remix-run/ui'",
      '',
      'export const ClientField = clientEntry(import.meta.url, function ClientField(handle: Handle) {',
      '  void handle',
      '  function reportButtonLabel() {',
      '    let button = document.querySelector(\'[data-testid="callback-button"]\')',
      '    let output = document.querySelector(\'[data-testid="callback-output"]\')',
      '    if (button && output) output.textContent = button.textContent',
      '  }',
      '  return () => (',
      '    <>',
      '      <input data-testid="server-client-field" />',
      '      <span data-testid="server-client-label">{\'Client: before\'}</span>',
      '      <button data-testid="callback-button" mix={on(\'click\', reportButtonLabel)}>',
      '        Run callback before HMR',
      '      </button>',
      '      <output data-testid="callback-output" />',
      '    </>',
      '  )',
      '})',
      '',
    ].join('\n'),
  )
  await write(
    rootDir,
    'app/entry.tsx',
    [
      "import { run } from '@remix-run/ui'",
      '',
      'let app = run({',
      '  async loadModule(moduleUrl: string, exportName: string) {',
      '    let mod = (await import(moduleUrl)) as Record<string, unknown>',
      '    let Component = mod[exportName]',
      '    if (typeof Component !== "function") {',
      '      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)',
      '    }',
      '    return Component',
      '  },',
      '  async resolveFrame(src, options) {',
      '    let response = await fetch(src, { headers: { Accept: "text/html" }, signal: options.signal })',
      '    if (!response.ok) return `<pre>Frame error: ${response.status}</pre>`',
      '    return response.body ?? response.text()',
      '  },',
      '})',
      '',
      'if (import.meta.hot) {',
      '  import.meta.hot.accept()',
      '  async function reloadTopFrame() {',
      '    await app.ready()',
      '    await app.frames.top.reload()',
      '    console.info("Server frame reload complete")',
      '  }',
      '  import.meta.hot.on("server:update", reloadTopFrame)',
      '}',
      '',
      'app.ready().then(',
      '  () => console.info("Frame adoption complete"),',
      '  (error: unknown) => console.error("Frame adoption failed:", error),',
      ')',
      '',
    ].join('\n'),
  )

  return {
    async renderDocument(assetServer) {
      let message = await fs.readFile(path.join(rootDir, 'server-message.txt'), 'utf-8')
      let { href, importMap, preloads } = await assetServer.getScriptEntry(
        path.join(rootDir, 'app/entry.tsx'),
      )
      let clientFieldPath = path.join(rootDir, 'app/ClientField.tsx')
      let ClientField = createTestClientEntry(
        pathToFileURL(clientFieldPath).href,
        function ClientField(handle: unknown) {
          void handle
          return () => (
            <>
              <input data-testid="server-client-field" />
              <span data-testid="server-client-label">Client: before</span>
              <button data-testid="callback-button">Run callback before HMR</button>
              <output data-testid="callback-output" />
            </>
          )
        },
      )
      return renderToStream(
        <html>
          <head>
            <title>Server HMR Test</title>
            <script type="importmap">{JSON.stringify(importMap).replace(/</g, '\\u003c')}</script>
            {preloads.map((preloadHref) => (
              <link key={preloadHref} rel="modulepreload" href={preloadHref} />
            ))}
          </head>
          <body>
            <main>
              <p data-testid="server-message">{message}</p>
              <ClientField />
            </main>
            <script src={href} type="module" />
          </body>
        </html>,
        {
          async resolveClientEntry(entryId, component) {
            let { href, importMap, preloads } = await assetServer.getScriptEntry(entryId)

            return {
              exportName: component.name || 'ClientField',
              href,
              importMap,
              preloads,
            }
          },
        },
      )
    },
    rootDir,
    async close() {
      await removeFixtureDir(rootDir)
    },
  }
}

async function createNodeHmrFixture(
  options: {
    clientFieldExtraExports?: string
    devProxy?: boolean
    serverImportsClientField?: boolean
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
    '@remix-run/ui',
    '@remix-run/ui-hmr',
  ])
  await write(
    rootDir,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@remix-run/ui',
      },
    }),
  )
  await write(rootDir, 'server-message.ts', `export const serverMessage = 'Server: before'\n`)
  await write(rootDir, 'server-side-effect.ts', `export const sideEffect = 'initial'\n`)
  await write(
    rootDir,
    'app/client-message.tsx',
    ['export function ClientMessage() {', '  return () => "Client: before"', '}', ''].join('\n'),
  )
  await write(rootDir, 'app/styles.css', '[data-testid="server-client-label"] { color: red; }\n')
  await write(
    rootDir,
    'app/ClientField.tsx',
    getClientFieldSource({ extraExports: options.clientFieldExtraExports }),
  )
  await write(
    rootDir,
    'app/entry.tsx',
    [
      "import { run } from '@remix-run/ui'",
      '',
      'const app = run({',
      '  async loadModule(moduleUrl: string, exportName: string) {',
      '    let mod = (await import(moduleUrl)) as Record<string, unknown>',
      '    let Component = mod[exportName]',
      '    if (typeof Component !== "function") {',
      '      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)',
      '    }',
      '    return Component',
      '  },',
      '  async resolveFrame(src, options) {',
      '    let response = await fetch(src, { headers: { Accept: "text/html" }, signal: options.signal })',
      '    if (!response.ok) return `<pre>Frame error: ${response.status}</pre>`',
      '    return response.body ?? response.text()',
      '  },',
      '})',
      '',
      'if (import.meta.hot) {',
      '  async function reloadTopFrame() {',
      '    await app.ready()',
      '    await app.frames.top.reload()',
      '    console.info("Server frame reload complete")',
      '  }',
      '  import.meta.hot.on("server:update", reloadTopFrame)',
      '}',
      '',
      'app.ready().then(',
      '  () => console.info("Frame adoption complete"),',
      '  (error: unknown) => console.error("Frame adoption failed:", error),',
      ')',
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
          `  nodeArgs: ['--import', ${JSON.stringify(nodeTsxImportUrl)}, '--import', ${JSON.stringify(uiHmrNodeImportUrl)}],`,
          `})`,
        ].join('\n'),
  )

  return {
    devProxy: options.devProxy === true,
    rootDir,
    async close() {
      await removeFixtureDir(rootDir)
    },
  }
}

async function removeFixtureDir(fixturePath: string): Promise<void> {
  await fs.rm(fixturePath, {
    force: true,
    maxRetries: process.platform === 'win32' ? 5 : 0,
    recursive: true,
    retryDelay: 100,
  })
}

function getClientFieldSource(
  options: {
    child?: string
    extraExports?: string
  } = {},
): string {
  return [
    "import { type Handle, clientEntry } from '@remix-run/ui'",
    "import { ClientMessage } from './client-message.tsx'",
    '',
    'export const ClientField = clientEntry(import.meta.url, function ClientField(handle: Handle) {',
    '  void handle',
    '  return () => (',
    '    <>',
    '      <input data-testid="server-client-field" />',
    `      <span data-testid="server-client-label">${options.child ?? '<ClientMessage />'}</span>`,
    '    </>',
    '  )',
    '})',
    '',
    options.extraExports ?? '',
  ].join('\n')
}

function getNodeHmrProxyDevSource(): string {
  return [
    "import { createServer } from 'node:http'",
    "import { readFile } from 'node:fs/promises'",
    `import { createFetchProxy } from ${JSON.stringify(fetchProxyImportUrl)}`,
    `import { createHmrReadyFetch, run } from ${JSON.stringify(nodeHmrImportUrl)}`,
    `import { createRequestListener } from ${JSON.stringify(nodeFetchServerImportUrl)}`,
    '',
    'let originPort = Number(process.env.TEST_SERVER_PORT ?? 0)',
    '',
    "let app = run('server.tsx', {",
    '  env: process.env,',
    `  nodeArgs: ['--import', ${JSON.stringify(nodeTsxImportUrl)}, '--import', ${JSON.stringify(uiHmrNodeImportUrl)}],`,
    '})',
    '',
    'let proxyFetch = createFetchProxy("http://127.0.0.1:0", {',
    '  xForwardedHeaders: true,',
    '  async fetch(input, init) {',
    '    let childPort = await waitForPort(process.env.CHILD_PORT_FILE)',
    '    let url = new URL(String(input))',
    '    url.port = String(childPort)',
    '    return await fetch(url, init)',
    '  },',
    '})',
    '',
    'let server = createServer(',
    '  createRequestListener(createHmrReadyFetch(app, proxyFetch), {',
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
    'server.listen(originPort, "127.0.0.1", () => {',
    '  let address = server.address()',
    '  if (address && typeof address === "object") {',
    '    console.log(JSON.stringify({ type: "proxy-ready", port: address.port, pid: process.pid }))',
    '  }',
    '})',
    '',
    'async function waitForPort(filePath) {',
    '  while (true) {',
    '    try {',
    '      let port = Number(await readFile(filePath, "utf8"))',
    '      if (port > 0) return port',
    '    } catch {}',
    '    await new Promise((resolve) => setTimeout(resolve, 25))',
    '  }',
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
    serverImportsClientField?: boolean
    slowAssetMs?: number
    slowDisposeMs?: number
    slowDocumentMs?: number
    title?: string
  } = {},
): string {
  let appDir = path.relative(workspaceDir, path.join(rootDir, 'app'))

  return [
    "import { createServer } from 'node:http'",
    "import { readFile, writeFile } from 'node:fs/promises'",
    "import { createAssetServer } from '@remix-run/assets'",
    "import { uiHmr } from '@remix-run/ui-hmr/assets'",
    "import { createBrowserHmrChannel, emitServerReady } from '@remix-run/node-hmr/runtime'",
    "import { renderToStream } from '@remix-run/ui/server'",
    "import { serverMessage } from './server-message.ts'",
    "import { sideEffect } from './server-side-effect.ts'",
    ...(options.serverImportsClientField
      ? ["import { ClientField } from './app/ClientField.tsx'"]
      : []),
    '',
    "let title = '" + (options.title ?? 'Initial') + "'",
    `let slowAssetMs = ${JSON.stringify(options.slowAssetMs ?? 0)}`,
    `let slowDisposeMs = ${JSON.stringify(options.slowDisposeMs ?? 0)}`,
    `let slowDocumentMs = ${JSON.stringify(options.slowDocumentMs ?? 0)}`,
    'void sideEffect',
    'let assetServer = createAssetServer({',
    `  allowFiles: [${JSON.stringify(`${appDir}/**`)}, 'packages/remix/**', 'packages/ui/**', 'packages/ui-hmr/**'],`,
    "  basePath: '/assets',",
    '  fileMap: {',
    `    '/app/*path': ${JSON.stringify(`${appDir}/*path`)},`,
    "    '/packages/*path': 'packages/*path',",
    '  },',
    '  hmr: createBrowserHmrChannel,',
    '  onError(error) {',
    '    console.error(error)',
    '  },',
    `  rootDir: ${JSON.stringify(workspaceDir)},`,
    '  scripts: {',
    '    loaders: [uiHmr()],',
    '  },',
    '  watch: {',
    '    poll: true,',
    '    pollInterval: 50,',
    '  },',
    '})',
    '',
    ...(options.serverImportsClientField
      ? []
      : [
          'function ClientField(handle: unknown) {',
          '  void handle',
          '  return () => (',
          '    <>',
          '      <input data-testid="server-client-field" />',
          '      <span data-testid="server-client-label">Client: before</span>',
          '    </>',
          '  )',
          '}',
          'Object.assign(ClientField, {',
          '  $entry: true,',
          `  $entryId: ${JSON.stringify(pathToFileURL(path.join(rootDir, 'app/ClientField.tsx')).href)},`,
          '})',
        ]),
    '',
    'async function renderDocument() {',
    `  let { href, importMap, preloads } = await assetServer.getScriptEntry(${JSON.stringify(`${appDir}/entry.tsx`)})`,
    '  return renderToStream(',
    '    <html>',
    '      <head>',
    '        <title>{title}</title>',
    '        <link rel="stylesheet" href="/assets/app/styles.css" />',
    '        <script type="importmap">',
    "          {JSON.stringify(importMap).replace(/</g, '\\\\u003c')}",
    '        </script>',
    '        {preloads.map((preloadHref) => (',
    '          <link key={preloadHref} rel="modulepreload" href={preloadHref} />',
    '        ))}',
    '      </head>',
    '      <body>',
    '        <main>',
    '          <input data-testid="document-field" />',
    '          <p data-testid="server-message">{serverMessage}</p>',
    '          <ClientField />',
    '        </main>',
    '        <script src={href} type="module" />',
    '      </body>',
    '    </html>,',
    '    {',
    '      async resolveClientEntry(entryId, component) {',
    '        let { href, importMap, preloads } = await assetServer.getScriptEntry(entryId)',
    '',
    '        return {',
    "          exportName: component.name || 'ClientField',",
    '          href,',
    '          importMap,',
    '          preloads,',
    '        }',
    '      },',
    '    },',
    '  )',
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
    '        new Response(await renderDocument(), {',
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
    '    if (response.headersSent) {',
    '      response.destroy()',
    '      return',
    '    }',
    "    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })",
    '    response.end(error instanceof Error ? error.stack : String(error))',
    '  }',
    '})',
    '',
    'let serverPortFile = process.env.TEST_CHILD_SERVER_PORT ? undefined : process.env.TEST_SERVER_PORT_FILE',
    'let serverPort = await getServerPort()',
    'server.listen(serverPort, "127.0.0.1", async () => {',
    '  let address = server.address()',
    "  if (address && typeof address === 'object') {",
    '    if (process.env.CHILD_PORT_FILE) await writeFile(process.env.CHILD_PORT_FILE, String(address.port))',
    '    if (serverPortFile) await writeFile(serverPortFile, String(address.port))',
    '    emitServerReady()',
    "    console.log(JSON.stringify({ type: 'ready', port: address.port, pid: process.pid }))",
    '  }',
    '})',
    '',
    'async function getServerPort() {',
    '  if (serverPortFile) {',
    '    try {',
    "      let port = Number(await readFile(serverPortFile, 'utf8'))",
    '      if (port > 0) return port',
    '    } catch {}',
    '  }',
    '  return Number(process.env.TEST_CHILD_SERVER_PORT ?? process.env.TEST_SERVER_PORT ?? 0)',
    '}',
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

function createTestClientEntry<component extends (handle: unknown) => unknown>(
  entryId: string,
  component: component,
): component & { $entry: true; $entryId: string } {
  return Object.assign(component, { $entry: true as const, $entryId: entryId })
}

async function createHmrTestServer(fixture: HmrFixture): Promise<HmrTestServer> {
  let appDir = path.relative(workspaceDir, path.join(fixture.rootDir, 'app'))
  let hmrEventStream: ReturnType<typeof createTestHmrEventStream> | undefined
  let browserHmrFileEventHandlers = new Set<BrowserHmrFileEventHandler>()
  let browserHmrWatcher: FSWatcher | undefined

  let createCurrentAssetServer = () =>
    createAssetServer({
      allowFiles: [`${appDir}/**`, 'packages/remix/**', 'packages/ui/**', 'packages/ui-hmr/**'],
      basePath: '/assets',
      fileMap: {
        '/app/*path': `${appDir}/*path`,
        '/packages/*path': 'packages/*path',
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
      scripts: {
        loaders: [uiHmr()],
      },
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
          data: browserHmrEvent.data,
          type: 'browser:update',
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
  let childPortFile = path.join(fixture.rootDir, 'child-port.txt')
  let child = spawn(process.execPath, ['dev.ts'], {
    cwd: fixture.rootDir,
    env: {
      ...env,
      NODE_ENV: 'development',
      ...(fixture.devProxy ? { CHILD_PORT_FILE: childPortFile, TEST_CHILD_SERVER_PORT: '0' } : {}),
      TEST_SERVER_PORT: '0',
      TEST_SERVER_PORT_FILE: path.join(fixture.rootDir, 'server-port.txt'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let readyEvents: Array<{ pid: number; port: number }> = []
  let readyWaiters: Array<() => void> = []
  let proxyReadyEvents: Array<{ pid: number; port: number }> = []
  let proxyReadyWaiters: Array<() => void> = []
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
      if (event !== null) {
        readyEvents.push(event)
        for (let waiter of readyWaiters) waiter()
        readyWaiters = []
        continue
      }

      let proxyEvent = parseProxyReadyEvent(line)
      if (proxyEvent !== null) {
        proxyReadyEvents.push(proxyEvent)
        for (let waiter of proxyReadyWaiters) waiter()
        proxyReadyWaiters = []
      }
    }
  })

  child.stderr?.setEncoding('utf-8')
  child.stderr?.on('data', (chunk: string) => {
    processOutput += chunk
  })

  child.once('exit', (code, signal) => {
    exit = { code, signal }
  })

  let ready = fixture.devProxy ? await waitForProxyReady() : await waitForReadyEvent(0)

  return {
    baseUrl: `http://127.0.0.1:${ready.port}`,
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

  async function waitForProxyReady(): Promise<{ pid: number; port: number }> {
    await waitFor(
      () => proxyReadyEvents[0] !== undefined,
      () => `Timed out waiting for node-hmr proxy server.\n${processOutput}`,
    )
    return proxyReadyEvents[0]!
  }
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
    response.end(await renderStaticIndex(fixture, assetServer))
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

async function renderStaticIndex(fixture: HmrFixture, assetServer: AssetServer): Promise<string> {
  let html = await fs.readFile(path.join(fixture.rootDir, 'index.html'), 'utf-8')
  let { href, importMap, preloads } = await assetServer.getScriptEntry(
    path.join(fixture.rootDir, 'app/entry.tsx'),
  )
  let importMapScript = `    <script type="importmap">${JSON.stringify(importMap).replace(
    /</g,
    '\\u003c',
  )}</script>`
  let preloadLinks = preloads
    .map(
      (preloadHref) => `    <link rel="modulepreload" href="${escapeHtmlAttribute(preloadHref)}">`,
    )
    .join('\n')
  let script = `    <script type="module" src="${escapeHtmlAttribute(href)}"></script>`
  let replacement = [importMapScript, preloadLinks, script].filter(Boolean).join('\n')

  return html.replace(
    /^\s*<script\s+type="module"\s+src="\/assets\/app\/entry\.tsx"><\/script>$/m,
    replacement,
  )
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
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
    let timeoutMs = text === '[remix] HMR connected' ? hmrConnectionTimeout : consoleMessageTimeout
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
    }, timeoutMs)

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

async function get(page: TestPage, pathname: string): Promise<void> {
  let response = await page.request.get(pathname)
  assert.ok(response.ok())
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

function parseProxyReadyEvent(line: string): { pid: number; port: number } | null {
  try {
    let event: unknown = JSON.parse(line)
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'proxy-ready' &&
      'port' in event &&
      typeof event.port === 'number' &&
      'pid' in event &&
      typeof event.pid === 'number'
    ) {
      return { pid: event.pid, port: event.port }
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
