import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  assertCount,
  createHmrFixture,
  createHmrTestServer,
  createNodeHmrFixture,
  createServerFrameHmrFixture,
  getCounterComponentSource,
  openHmrPage,
  serveNodeHmrFixture,
  startNodeHmrFixtureServer,
  waitForComputedStyle,
  waitForConsoleMessage,
  waitForNavigation,
  waitForReloadedApp,
  waitForStylesheetResponse,
  waitForText,
  write,
  writeFileAtomically,
} from './hmr-fixture.tsx'
import type { NodeHmrTestServer } from './hmr-fixture.tsx'

const isBun = 'Bun' in globalThis

declare global {
  var __counterInitialValue: number
}

describe('component-hmr e2e', { skip: isBun }, () => {
  it('updates component render output without losing setup state', async (t) => {
    let fixture = await createHmrFixture()

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
    await assertCount(page, 'Count: 3')
    await page.locator('[data-testid="field"]').fill('hello')
    await page.evaluate(() => {
      globalThis.__counterInitialValue = 100
    })

    let counterPath = path.join(fixture.rootDir, 'app/Counter.tsx')
    let counterSource = await fs.readFile(counterPath, 'utf-8')
    await writeFileAtomically(counterPath, counterSource.replace('Increment', 'Increment via HMR'))

    await waitForText(page, '[data-testid="increment"]', 'Increment via HMR')
    await assertCount(page, 'Count: 3')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'hello')
  })

  it('keeps working children mountable after a throwing edit and recovers after reload', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)
    let source = `import { on } from '@remix-run/component'
export function Child() {
  let label = 'working'
  return () => <output>{label}</output>
}
export function Counter(handle) {
  let visible = false
  let toggle = () => {
    visible = !visible
    handle.update()
  }
  return () => <main>
    <input data-testid="field" />
    <button mix={on('click', toggle)}>Toggle child</button>
    {visible ? <Child /> : null}
  </main>
}`
    await write(fixture.rootDir, 'app/Counter.tsx', source)
    let page = await t.serve(await createHmrTestServer(fixture))
    await openHmrPage(page)
    await page.locator('[data-testid="field"]').fill('retained')
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await waitForText(page, 'output', 'working')
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await page.waitForFunction(() => document.querySelector('output') === null)

    let failed = waitForConsoleMessage(page, '[remix] HMR update failed')
    await write(
      fixture.rootDir,
      'app/Counter.tsx',
      `${source.replace('working', 'rejected')}\nthrow new Error('rejected edit')`,
    )
    await failed
    // This callback and its Child reference were captured by the original setup.
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await waitForText(page, 'output', 'working')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'retained')

    // The assets host drops its accept handler after an evaluation failure and reloads on recovery.
    let recovered = waitForNavigation(page)
    await write(fixture.rootDir, 'app/Counter.tsx', source.replace('working', 'recovered'))
    await recovered
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await waitForText(page, 'output', 'recovered')
  })

  it('keeps working children mountable after an awaited rejection and recovers after reload', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)
    let source = `import { on } from '@remix-run/component'
export function Child() {
  let label = 'working'
  return () => <output>{label}</output>
}
export function Counter(handle) {
  let visible = false
  let toggle = () => {
    visible = !visible
    handle.update()
  }
  return () => <main>
    <input data-testid="field" />
    <button mix={on('click', toggle)}>Toggle child</button>
    {visible ? <Child /> : null}
  </main>
}`
    await write(fixture.rootDir, 'app/Counter.tsx', source)
    let page = await t.serve(await createHmrTestServer(fixture))
    await openHmrPage(page)
    await page.locator('[data-testid="field"]').fill('retained')
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await waitForText(page, 'output', 'working')
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await page.waitForFunction(() => document.querySelector('output') === null)

    let failed = waitForConsoleMessage(page, '[remix] HMR update failed')
    await write(
      fixture.rootDir,
      'app/Counter.tsx',
      `${source.replace('working', 'rejected')}\nawait Promise.reject(new Error('rejected edit'))`,
    )
    await failed
    // This callback and its Child reference were captured by the original setup.
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await waitForText(page, 'output', 'working')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'retained')

    // The assets host drops its accept handler after an evaluation failure and reloads on recovery.
    let recovered = waitForNavigation(page)
    await write(fixture.rootDir, 'app/Counter.tsx', source.replace('working', 'recovered'))
    await recovered
    await page.getByRole('button', { name: 'Toggle child' }).click()
    await waitForText(page, 'output', 'recovered')
  })

  it('updates a component when an optimized barrel import is retargeted', async (t) => {
    let fixture = await createHmrFixture()
    t.after(fixture.close)
    await write(fixture.rootDir, 'app/package.json', JSON.stringify({ sideEffects: false }))
    await write(fixture.rootDir, 'app/label-a.ts', "export const buttonText = 'Label A'\n")
    await write(fixture.rootDir, 'app/label-b.ts', "export const buttonText = 'Label B'\n")
    await write(
      fixture.rootDir,
      'app/label-inner.ts',
      "export { buttonText } from './label-a.ts'\n",
    )
    await write(fixture.rootDir, 'app/label.ts', "export { buttonText } from './label-inner.ts'\n")
    let counterSource = await fs.readFile(path.join(fixture.rootDir, 'app/Counter.tsx'), 'utf-8')
    await write(
      fixture.rootDir,
      'app/Counter.tsx',
      [
        "import { buttonText } from './label.ts'",
        counterSource.replace('>Increment</button>', '>{buttonText}</button>'),
      ].join('\n'),
    )

    let server = await createHmrTestServer(fixture)
    let compiledCounter = await fetch(new URL('/assets/app/Counter.tsx', server.baseUrl)).then(
      (response) => response.text(),
    )
    assert.match(compiledCounter, /from "\/assets\/app\/label-a\.ts"/)
    assert.doesNotMatch(compiledCounter, /label(?:-inner)?\.ts/)

    let page = await t.serve(server)
    await openHmrPage(page)
    await waitForText(page, '[data-testid="increment"]', 'Label A')
    await page.locator('[data-testid="field"]').fill('keep me')

    await write(
      fixture.rootDir,
      'app/label-inner.ts',
      "export { buttonText } from './label-b.ts'\n",
    )

    await waitForText(page, '[data-testid="increment"]', 'Label B')
    assert.equal(await page.locator('[data-testid="field"]').inputValue(), 'keep me')
  })

  it('reloads the page when a non-component export is added to a component module', async (t) => {
    let fixture = await createHmrFixture()

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
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

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
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

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
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
    await write(fixture.rootDir, 'app/stable.ts', 'export const foo = {}\n')

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
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

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
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

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
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

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
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

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page)
    await assertCount(page, 'Count: 3')

    let counterPath = path.join(fixture.rootDir, 'app/Counter.tsx')
    let counterSource = await fs.readFile(counterPath, 'utf-8')
    await writeFileAtomically(
      counterPath,
      counterSource.replace('let count = globalThis.__counterInitialValue', 'let count = 100'),
    )

    await assertCount(page, 'Count: 100')
  })

  it('runs new setup scope for each remounted component instance', async (t) => {
    let fixture = await createHmrFixture()

    await write(
      fixture.rootDir,
      'app/entry.tsx',
      [
        "import { createRoot } from '@remix-run/component'",
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
        "import type { Handle } from '@remix-run/component'",
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
    t.after(fixture.close)
    await openHmrPage(page)
    await waitForText(page, '[data-testid="count-first"]', 'Count first: 3')
    await waitForText(page, '[data-testid="count-second"]', 'Count second: 3')

    let counterPath = path.join(fixture.rootDir, 'app/Counter.tsx')
    let counterSource = await fs.readFile(counterPath, 'utf-8')
    await writeFileAtomically(
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

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page, { hydrate: true })
    await waitForText(page, '[data-testid="callback-button"]', 'Run callback before HMR')

    await page.locator('[data-testid="callback-button"]').click()
    await waitForText(page, '[data-testid="callback-output"]', 'Run callback before HMR')

    let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
    let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')
    await writeFileAtomically(
      clientFieldPath,
      clientFieldSource.replace('Run callback before HMR', 'Run callback after HMR'),
    )

    await waitForText(page, '[data-testid="callback-button"]', 'Run callback after HMR')
    await page.locator('[data-testid="callback-button"]').click()
    await waitForText(page, '[data-testid="callback-output"]', 'Run callback after HMR')
  })

  it('updates a client entry after a failed HMR transform is fixed', async (t) => {
    let fixture = await createServerFrameHmrFixture()

    let page = await t.serve(await createHmrTestServer(fixture))
    t.after(fixture.close)
    await openHmrPage(page, { hydrate: true })
    await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')

    let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
    let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')

    let failedUpdate = waitForConsoleMessage(page, '[remix] HMR update failed')
    await writeFileAtomically(
      clientFieldPath,
      clientFieldSource.replace("'Client: before'", "'Client:"),
    )
    await failedUpdate

    await writeFileAtomically(
      clientFieldPath,
      clientFieldSource.replace('Client: before', 'Client: after!!!!!'),
    )

    await waitForText(page, '[data-testid="server-client-label"]', 'Client: after!!!!!')
  })

  it('recovers failed client entry updates after the HMR event stream reconnects', async (t) => {
    let fixture = await createServerFrameHmrFixture()

    let server = await createHmrTestServer(fixture)
    let page = await t.serve(server)
    t.after(fixture.close)
    await openHmrPage(page, { hydrate: true })
    await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')

    let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
    let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')

    let failedUpdate = waitForConsoleMessage(page, '[remix] HMR update failed')
    await writeFileAtomically(
      clientFieldPath,
      clientFieldSource.replace("'Client: before'", "'Client:"),
    )
    await failedUpdate

    let lostConnection = waitForConsoleMessage(page, '[remix] HMR connection lost')
    await server.restartAssets()
    await lostConnection

    await writeFileAtomically(
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')

      let clientFieldPath = path.join(fixture.rootDir, 'app/ClientField.tsx')
      let clientFieldSource = await fs.readFile(clientFieldPath, 'utf-8')

      let failedUpdate = waitForConsoleMessage(page, '[remix] HMR update failed')
      await writeFileAtomically(
        clientFieldPath,
        clientFieldSource.replace('<ClientMessage />', '<ClientMessage'),
      )
      await failedUpdate
      assert.equal(server.readyCount, 1)

      await writeFileAtomically(
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
      await server.waitForReady(1)
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
      await openHmrPage(page, { hydrate: true })
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
      await writeFileAtomically(
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

      let serverFrameReloaded = waitForConsoleMessage(page, 'Server frame reload complete')
      await write(fixture.rootDir, 'server-side-effect.ts', `export const sideEffect = 'mixed'\n`)
      await serverFrameReloaded
      await server.waitForReady(1)
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-message"]', 'Server: before')
      await page.locator('[data-testid="document-field"]').fill('state before entry update')

      let entryPath = path.join(fixture.rootDir, 'app/entry.tsx')
      let entrySource = await fs.readFile(entryPath, 'utf-8')
      let reloaded = waitForReloadedApp(page)
      await writeFileAtomically(
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
      await openHmrPage(page, { hydrate: true })
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
      await server.waitForReady(1)
      assert.equal(server.readyCount, 2)
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
      await openHmrPage(page, { hydrate: true })
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
      await openHmrPage(page, { hydrate: true })
      await waitForText(page, '[data-testid="server-client-label"]', 'Client: before')
      await page.locator('[data-testid="server-client-field"]').fill('typed before reload')
      await page.locator('[data-testid="document-field"]').fill('document before reload')

      let reloaded = waitForReloadedApp(page)
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
