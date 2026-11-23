import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  assertFreshClientFieldResponses,
  browserStartupTimeout,
  createNodeHmrFixture,
  editClientField,
  getClientFieldSource,
  monitorLocalRequestFailures,
  openHmrPage,
  serveNodeHmrFixture,
  startNodeHmrFixtureServer,
  waitForConsoleMessage,
  waitForNavigation,
  waitForReloadedApp,
  waitForText,
  write,
} from './hmr-fixture.tsx'
import type { NodeHmrTestServer } from './hmr-fixture.tsx'

const isBun = 'Bun' in globalThis

describe('component-hmr e2e', { skip: isBun }, () => {
  it('reloads the page after a node-hmr client entry export is added', async (t) => {
    let fixture = await createNodeHmrFixture()
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      let reloaded = waitForReloadedApp(page)
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

  it('adds hydration boundaries in fresh responses when clientEntry is added through node-hmr', async () => {
    let fixture = await createNodeHmrFixture({ serverImportsClientField: true })
    let server: NodeHmrTestServer | undefined

    try {
      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({ clientEntry: false, child: 'Client: plain' }),
      )
      server = await startNodeHmrFixtureServer(fixture)
      await assertFreshClientFieldResponses(server, 'Client: plain', false)

      await editClientField(fixture, server, 'Client: plain render edit', false)
      assert.equal(server.readyCount, 1)

      await editClientField(fixture, server, 'Client: entry added', true)
      await server.waitForReady(1)
      assert.equal(server.readyCount, 2)

      await editClientField(fixture, server, 'Client: entry render edit', true)
      assert.equal(server.readyCount, 2)
    } catch (error) {
      throw new Error(`${String(error)}\n${server?.output}`, { cause: error })
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('removes hydration boundaries in fresh responses when clientEntry is removed through node-hmr', async () => {
    let fixture = await createNodeHmrFixture({ serverImportsClientField: true })
    let server: NodeHmrTestServer | undefined

    try {
      server = await startNodeHmrFixtureServer(fixture)
      await assertFreshClientFieldResponses(server, 'Client: before', true)

      await editClientField(fixture, server, 'Client: entry render edit', true)
      assert.equal(server.readyCount, 1)

      await editClientField(fixture, server, 'Client: entry removed', false)
      await server.waitForReady(1)
      assert.equal(server.readyCount, 2)

      await editClientField(fixture, server, 'Client: plain render edit', false)
      assert.equal(server.readyCount, 2)
    } catch (error) {
      throw new Error(`${String(error)}\n${server?.output}`, { cause: error })
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
      let requests = monitorLocalRequestFailures(page, server.baseUrl)
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      let reloaded = waitForReloadedApp(page)
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
      await requests.assertNone(server.output)
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
      let requests = monitorLocalRequestFailures(page, server.baseUrl)
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForReloadedApp(page)
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
      await server.waitForReady(1)
      assert.equal(server.readyCount, 2)
      await requests.assertNone(server.output)
    } finally {
      await server?.close()
      await fixture.close()
    }
  })

  it('does not refresh the server frame when a pending client update requires a page reload', async (t) => {
    let fixture = await createNodeHmrFixture({
      clientFieldExtraExports: 'export const foo = true\n',
      serverImportsClientField: true,
    })
    let server: NodeHmrTestServer | undefined
    let update = Promise.withResolvers<void>()

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      await page.addInitScript(() => {
        let NativeEventSource = window.EventSource
        window.EventSource = class extends NativeEventSource {
          constructor(url: string | URL, options?: EventSourceInit) {
            super(url, options)
            this.addEventListener('message', (event) => {
              if (JSON.parse(event.data).type === 'server:update') {
                document.documentElement.dataset.serverUpdateReceived = 'true'
              }
            })
          }
        }
      })
      await openHmrPage(page, { hydrate: true })
      await page.locator('[data-testid="document-field"]').fill('typed before reload')

      let frameRequests: string[] = []
      page.on('request', (request) => {
        if (request.resourceType() === 'fetch' && new URL(request.url()).pathname === '/') {
          frameRequests.push(request.url())
        }
      })
      let navigations = 0
      page.on('framenavigated', (frame) => {
        if (frame.parentFrame() === null) navigations++
      })
      let isClientUpdate = (url: URL) =>
        url.pathname === '/assets/app/ClientField.tsx' && url.searchParams.has('t')
      // Deliver the server update while the browser is still importing the changed exports.
      await page.route(isClientUpdate, async (route) => {
        await update.promise
        await route.continue()
      })
      let updateRequested = page.waitForRequest((request) => isClientUpdate(new URL(request.url())))
      let reloaded = waitForReloadedApp(page)
      await write(
        fixture.rootDir,
        'app/ClientField.tsx',
        getClientFieldSource({ child: 'Client: after shared export removal' }),
      )

      await updateRequested
      await page.locator('html[data-server-update-received="true"]').waitFor()
      update.resolve()
      await reloaded
      await waitForText(
        page,
        '[data-testid="server-client-label"]',
        'Client: after shared export removal',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(navigations, 1)
      assert.equal(
        frameRequests.length,
        0,
        `Unexpected frame refreshes: ${frameRequests.join(', ')}`,
      )
    } finally {
      update.resolve()
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
      let requests = monitorLocalRequestFailures(page, server.baseUrl)
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForReloadedApp(page)
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
      await server.waitForReady(1)
      assert.equal(server.readyCount, 2)
      await requests.assertNone(server.output)
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before update')
      await page.locator('[data-testid="document-field"]').fill('document before update')

      let refreshed = waitForConsoleMessage(page, 'Server frame reload complete')
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
      await refreshed
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
    let startup = Promise.withResolvers<void>()

    try {
      server = await startNodeHmrFixtureServer(fixture)
      let page = await serveNodeHmrFixture(t, server)
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      // Keep the new page's client code from running until its HTML is visible.
      await page.route(
        '**/assets/app/entry.tsx*',
        async (route) => {
          await startup.promise
          await route.continue()
        },
        { times: 1 },
      )
      let entryRequested = page.waitForRequest('**/assets/app/entry.tsx*', {
        timeout: browserStartupTimeout,
      })
      let reloaded = waitForNavigation(page, { waitUntil: 'commit' })
      let adopted = waitForConsoleMessage(page, 'Frame adoption complete', startup.promise)
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

      await Promise.all([reloaded, entryRequested])
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      startup.resolve()
      await adopted
      assert.equal(
        await page.locator('[data-testid="server-client-label"]').textContent(),
        'Client: after export removal',
      )
      assert.equal(await page.locator('[data-testid="document-field"]').inputValue(), '')
      assert.equal(server.readyCount, 1)
    } finally {
      startup.resolve()
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
      let reloaded = waitForReloadedApp(page)
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForReloadedApp(page)
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForReloadedApp(page)
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
      await openHmrPage(page, { hydrate: true })
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForReloadedApp(page)
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
})
