import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { renderToStream } from '@remix-run/ui/server'
import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createAssetServer, type AssetServer } from '../src/lib/asset-server.ts'

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceDir = path.resolve(packageDir, '../..')
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

  it('reloads the top frame after the HMR connection recovers', async (t) => {
    let fixture = await createServerFrameHmrFixture()
    t.after(fixture.close)

    let server = await createHmrTestServer(fixture)
    let page = await t.serve(server)
    let connected = waitForConsoleMessage(page, '[remix] HMR connected')

    await page.goto('/')
    await connected
    await waitForText(page, '[data-testid="server-message"]', 'Server: before')
    await page.locator('[data-testid="server-client-field"]').fill('hello through reconnect')

    let messagePath = path.join(fixture.rootDir, 'server-message.txt')
    await fs.writeFile(messagePath, 'Server: after reconnect')

    let lostConnection = waitForConsoleMessage(page, '[remix] HMR connection lost')
    let reconnected = waitForConsoleMessage(page, '[remix] HMR connected')
    let serverReload = waitForConsoleMessage(page, 'Server frame reload complete')

    await server.restartAssets()

    await lostConnection
    await reconnected
    await serverReload

    await waitForText(page, '[data-testid="server-message"]', 'Server: after reconnect')
    assert.equal(
      await page.locator('[data-testid="server-client-field"]').inputValue(),
      'hello through reconnect',
    )
  })
})

type HmrFixture = {
  close(): Promise<void>
  renderDocument?: (assetServer: AssetServer) => Promise<ReadableStream<Uint8Array>>
  rootDir: string
}

type HmrTestServer = {
  baseUrl: string
  close(): Promise<void>
  restartAssets(): Promise<void>
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
      '  <head><title>HMR Test</title></head>',
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
      '      <span data-testid="server-client-label">Client: before</span>',
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
      "import { getTopFrame, run } from '@remix-run/ui'",
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
      '    await getTopFrame().reload()',
      '    console.info("Server frame reload complete")',
      '  }',
      '  import.meta.hot.on("remix:server-update", reloadTopFrame)',
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

function createTestClientEntry<component extends (handle: unknown) => unknown>(
  entryId: string,
  component: component,
): component & { $entry: true; $entryId: string } {
  return Object.assign(component, { $entry: true as const, $entryId: entryId })
}

async function createHmrTestServer(fixture: HmrFixture): Promise<HmrTestServer> {
  let appDir = path.relative(workspaceDir, path.join(fixture.rootDir, 'app'))

  let createCurrentAssetServer = () =>
    createAssetServer({
      allow: [`${appDir}/**`, 'packages/ui/**'],
      basePath: '/assets',
      fileMap: {
        '/app/*path': `${appDir}/*path`,
        '/packages/*path': 'packages/*path',
      },
      hmr: true,
      rootDir: workspaceDir,
      watch: {
        poll: true,
        pollInterval: 50,
      },
    })
  let assetServer = createCurrentAssetServer()

  let server = http.createServer(async (request, response) => {
    try {
      await handleRequest(request, response, fixture, assetServer)
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
      await assetServer.close()
      assetServer = createCurrentAssetServer()
    },
    async close() {
      await assetServer.close()
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

async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  fixture: HmrFixture,
  assetServer: AssetServer,
): Promise<void> {
  let host = request.headers.host ?? '127.0.0.1'
  let url = new URL(request.url ?? '/', `http://${host}`)

  if (url.pathname === '/') {
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

  if (url.pathname.startsWith('/assets/')) {
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
    let timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for console message: ${text}`))
    }, 5000)

    page.on('console', (message) => {
      if (message.text().includes(text)) {
        clearTimeout(timeout)
        resolve()
      }
    })
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

async function write(rootDir: string, rel: string, content: string): Promise<void> {
  let filePath = path.join(rootDir, rel)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content)
}
