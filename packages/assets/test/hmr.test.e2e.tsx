import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { renderToStream } from '@remix-run/ui/server'
import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createAssetServer, type AssetServer, type HmrPayload } from '../src/assets.ts'

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceDir = path.resolve(packageDir, '../..')
const nodeHmrCliEntryPath = path.resolve(workspaceDir, 'packages/node-hmr/src/cli-entry.ts')
const nodeTsxImportUrl = pathToFileURL(
  path.resolve(workspaceDir, 'packages/node-tsx/src/index.ts'),
).href
const isBun = 'Bun' in globalThis

declare global {
  var __counterInitialValue: number
}

describe('asset server HMR', { skip: isBun }, () => {
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
      let page = await t.serve(server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForComputedStyle(
        page,
        '[data-testid="server-client-label"]',
        'color',
        'rgb(255, 0, 0)',
      )

      let unexpectedStyleRequest = waitForStylesheetResponse(page, 200, { timeout: 250 }).then(
        () => true,
        () => false,
      )
      await get(page, '/__test_emit_server_update')

      assert.equal(await unexpectedStyleRequest, false)
      await waitForStylesheetLinkCount(page, '/assets/app/styles.css', 1)
      await waitForComputedStyle(
        page,
        '[data-testid="server-client-label"]',
        'color',
        'rgb(255, 0, 0)',
      )
      assert.equal(server.readyCount, 1)
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
      let page = await t.serve(server)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')

      await fs.writeFile(clientFieldPath, clientFieldSource.replace("'Client: before'", "'Client:"))
      await waitForConsoleMessage(page, '[remix] HMR update failed')

      await fs.writeFile(
        clientFieldPath,
        clientFieldSource.replace('Client: before', 'Client: after server update!!!!!'),
      )

      await get(page, '/__test_emit_server_update')
      await waitForConsoleMessage(page, '[remix] HMR recovered update')

      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after server update!!!!!',
      )
      assert.equal(server.readyCount, 1)
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
      let page = await t.serve(server)
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
        clientFieldSource.replace('Client: before', 'Client: component update'),
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

      await get(page, '/__test_emit_server_update')
      await waitForConsoleMessage(page, 'Server frame reload complete')
      assert.equal(server.readyCount, 1)
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
      let page = await t.serve(server)
      let ready = await server.waitForReady(0)
      let connected = waitForConsoleMessage(page, '[remix] HMR connected')

      await page.goto('/')
      await connected
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')

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
      assert.equal(server.readyCount, 2)
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
  rootDir: string
}

type HmrTestServer = {
  baseUrl: string
  close(): Promise<void>
  restartAssets(): Promise<void>
  startAssets(): Promise<void>
  stopAssets(): Promise<void>
}

type NodeHmrTestServer = {
  baseUrl: string
  close(): Promise<void>
  readyCount: number
  waitForReady(index: number): Promise<{ pid: number; port: number }>
}

type TestPage = Awaited<ReturnType<TestContext['serve']>>

async function createHmrFixture(): Promise<HmrFixture> {
  let tmpDir = path.join(packageDir, '.tmp')
  await fs.mkdir(tmpDir, { recursive: true })
  let rootDir = await fs.mkdtemp(path.join(tmpDir, 'hmr-e2e-'))

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
      '      <p data-testid="count">Count: {count}</p>',
      '      <button data-testid="increment">Increment</button>',
      '    </main>',
      '  )',
      '}',
      '',
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
      await fs.rm(rootDir, { force: true, recursive: true })
    },
  }
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
  await write(rootDir, 'server-message.txt', 'Server: before')
  await write(
    rootDir,
    'app/ClientField.tsx',
    [
      "import { type Handle, clientEntry } from '@remix-run/ui'",
      '',
      'export const ClientField = clientEntry(import.meta.url, function ClientField(handle: Handle) {',
      '  void handle',
      '  return () => (',
      '    <>',
      '      <input data-testid="server-client-field" />',
      '      <span data-testid="server-client-label">{\'Client: before\'}</span>',
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
      '  async resolveFrame(src, signal) {',
      '    let response = await fetch(src, { headers: { Accept: "text/html" }, signal })',
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
      'app.ready().catch((error: unknown) => {',
      '  console.error("Frame adoption failed:", error)',
      '})',
      '',
    ].join('\n'),
  )

  return {
    async renderDocument(assetServer) {
      let message = await fs.readFile(path.join(rootDir, 'server-message.txt'), 'utf-8')
      let clientFieldPath = path.join(rootDir, 'app/ClientField.tsx')
      let ClientField = createTestClientEntry(
        pathToFileURL(clientFieldPath).href,
        function ClientField(handle: unknown) {
          void handle
          return () => (
            <>
              <input data-testid="server-client-field" />
              <span data-testid="server-client-label">Client: before</span>
            </>
          )
        },
      )
      return renderToStream(
        <html>
          <head>
            <title>Server HMR Test</title>
          </head>
          <body>
            <main>
              <p data-testid="server-message">{message}</p>
              <ClientField />
            </main>
            <script src="/assets/app/entry.tsx" type="module" />
          </body>
        </html>,
        {
          async resolveClientEntry(entryId, component) {
            return {
              exportName: component.name || 'ClientField',
              href: await assetServer.getHref(entryId),
            }
          },
        },
      )
    },
    rootDir,
    async close() {
      await fs.rm(rootDir, { force: true, recursive: true })
    },
  }
}

async function createNodeHmrFixture(): Promise<NodeHmrFixture> {
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
  await write(rootDir, 'app/styles.css', '[data-testid="server-client-label"] { color: red; }\n')
  await write(
    rootDir,
    'app/ClientField.tsx',
    [
      "import { type Handle, clientEntry } from '@remix-run/ui'",
      '',
      'export const ClientField = clientEntry(import.meta.url, function ClientField(handle: Handle) {',
      '  void handle',
      '  return () => (',
      '    <>',
      '      <input data-testid="server-client-field" />',
      '      <span data-testid="server-client-label">{\'Client: before\'}</span>',
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
      '  async resolveFrame(src, signal) {',
      '    let response = await fetch(src, { headers: { Accept: "text/html" }, signal })',
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
      'app.ready().catch((error: unknown) => {',
      '  console.error("Frame adoption failed:", error)',
      '})',
      '',
    ].join('\n'),
  )
  await write(rootDir, 'server.tsx', getNodeHmrServerSource(rootDir))

  return {
    rootDir,
    async close() {
      await fs.rm(rootDir, { force: true, recursive: true })
    },
  }
}

function getNodeHmrServerSource(rootDir: string, options: { title?: string } = {}): string {
  let appDir = path.relative(workspaceDir, path.join(rootDir, 'app'))

  return [
    "import { createServer } from 'node:http'",
    "import { createAssetServer } from '@remix-run/assets'",
    "import { eventChannel } from '@remix-run/node-hmr/runtime'",
    "import { renderToStream } from '@remix-run/ui/server'",
    "import { serverMessage } from './server-message.ts'",
    "import { sideEffect } from './server-side-effect.ts'",
    '',
    "let title = '" + (options.title ?? 'Initial') + "'",
    'void sideEffect',
    'let assetServer = createAssetServer({',
    `  allow: [${JSON.stringify(`${appDir}/**`)}, 'packages/ui/**', 'packages/ui-hmr/**'],`,
    "  basePath: '/assets',",
    '  fileMap: {',
    `    '/app/*path': ${JSON.stringify(`${appDir}/*path`)},`,
    "    '/packages/*path': 'packages/*path',",
    '  },',
    '  hmr: { eventChannel },',
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
    '',
    'async function renderDocument() {',
    '  return renderToStream(',
    '    <html>',
    '      <head>',
    '        <title>{title}</title>',
    '        <link rel="stylesheet" href="/assets/app/styles.css" />',
    '      </head>',
    '      <body>',
    '        <main>',
    '          <p data-testid="server-message">{serverMessage}</p>',
    '          <ClientField />',
    '        </main>',
    '        <script src="/assets/app/entry.tsx" type="module" />',
    '      </body>',
    '    </html>,',
    '    {',
    '      async resolveClientEntry(entryId, component) {',
    '        return {',
    "          exportName: component.name || 'ClientField',",
    '          href: await assetServer.getHref(entryId),',
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
    "    if (url.pathname === '/__test_emit_server_update') {",
    '      eventChannel?.send({',
    "        type: 'server:update',",
    '      })',
    '      response.writeHead(204).end()',
    '      return',
    '    }',
    '',
    "    if (url.pathname.startsWith('/assets/')) {",
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
    'server.listen(Number(process.env.TEST_SERVER_PORT ?? 0), "127.0.0.1", () => {',
    '  let address = server.address()',
    "  if (address && typeof address === 'object') {",
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

  let createCurrentAssetServer = () =>
    createAssetServer({
      allow: [`${appDir}/**`, 'packages/ui/**', 'packages/ui-hmr/**'],
      basePath: '/assets',
      fileMap: {
        '/app/*path': `${appDir}/*path`,
        '/packages/*path': 'packages/*path',
      },
      hmr: {
        eventChannel: {
          url: '/hmr/events',
          send(payload) {
            hmrEventStream?.send(payload)
          },
        },
      },
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
  }

  async function stopAssets(): Promise<void> {
    await assetServer?.close()
    assetServer = undefined
    hmrEventStream?.close()
    hmrEventStream = undefined
  }

  hmrEventStream = createTestHmrEventStream()

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
}

async function startNodeHmrFixtureServer(fixture: NodeHmrFixture): Promise<NodeHmrTestServer> {
  let { NODE_PATH: _nodePath, ...env } = process.env
  let port = await getAvailablePort()
  let child = spawn(
    process.execPath,
    ['--import', nodeTsxImportUrl, nodeHmrCliEntryPath, '--import', nodeTsxImportUrl, 'server.tsx'],
    {
      cwd: fixture.rootDir,
      env: {
        ...env,
        NODE_ENV: 'development',
        TEST_SERVER_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
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
  await page.waitForFunction(
    ({ selector, text }) => document.querySelector(selector)?.textContent?.trim() === text,
    { selector, text },
    { timeout: 5000 },
  )
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
