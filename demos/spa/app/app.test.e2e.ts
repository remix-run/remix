import { fileURLToPath } from 'node:url'
import * as assert from 'remix/assert'
import { beforeAll, describe, it } from 'remix/test'
import { build, createServer, preview, type PreviewServer, type ViteDevServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const mode: 'development' | 'production' = 'production'

async function createViteTestServer() {
  let options: Parameters<typeof createServer>[0] | Parameters<typeof preview>[0] = {
    root,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
    },
  }

  let vite: ViteDevServer | PreviewServer
  if (mode === 'development') {
    vite = await createServer(options)
    await vite.listen()
  } else {
    vite = await preview(options)
  }

  let address = vite.httpServer?.address()
  if (address == null || typeof address === 'string') {
    await vite.close()
    throw new Error('Vite did not bind to a TCP port')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await vite.close()
    },
  }
}

describe(`SPA (${mode})`, () => {
  beforeAll(async () => {
    if (mode === 'production') await build({ root, logLevel: 'silent' })
  })

  it('loads a client route directly through the Vite history fallback', async (t) => {
    let page = await t.serve(await createViteTestServer())

    await page.goto('/about')
    await page.getByRole('status').waitFor()
    await page.getByRole('heading', { name: 'URLs in, rendered UI out' }).waitFor()

    assert.equal(new URL(page.url()).pathname, '/about')
    assert.equal(
      await page.getByRole('link', { name: 'About' }).getAttribute('aria-current'),
      'page',
    )
  })

  it('navigates between routes and cancels a superseded load', async (t) => {
    let page = await t.serve(await createViteTestServer())

    await page.goto('/')
    await page.getByRole('heading', { name: 'A client-only Remix app' }).waitFor()

    void page.getByRole('link', { name: 'About' }).click()
    await page.getByRole('status').waitFor()
    await page.getByRole('link', { name: 'Home' }).click()
    await page.getByRole('heading', { name: 'A client-only Remix app' }).waitFor()

    assert.equal(new URL(page.url()).pathname, '/')
  })

  it('updates client-owned component state', async (t) => {
    let page = await t.serve(await createViteTestServer())

    await page.goto('/')
    let counter = page.getByRole('button', { name: 'Count: 0' })
    await counter.waitFor()
    await counter.click()

    await page.getByRole('button', { name: 'Count: 1' }).waitFor()
  })

  it('pushes new form destinations and replaces submissions to the active URL', async (t) => {
    let page = await t.serve(await createViteTestServer())

    await page.goto('/')
    await page.getByRole('heading', { name: 'A client-only Remix app' }).waitFor()

    await page.getByLabel('What should we call you?').fill('Ada')
    await page.getByRole('button', { name: 'Submit' }).click()
    await page.getByRole('heading', { name: 'Hello, Ada!' }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/greet')

    await page.getByLabel('Try another name').fill('Grace')
    await page.getByRole('button', { name: 'Submit again' }).click()
    await page.getByRole('heading', { name: 'Hello, Grace!' }).waitFor()

    await page.goBack()
    await page.getByRole('heading', { name: 'A client-only Remix app' }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/')
  })
})
