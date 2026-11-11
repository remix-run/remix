import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

async function openFixture(t: TestContext) {
  let result = await build({
    entryPoints: [fileURLToPath(new URL('./popover.fixture.tsx', import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'esnext',
    jsx: 'automatic',
    jsxImportSource: '@remix-run/component',
  })
  let script = result.outputFiles[0].text
  let server = createServer((request, response) => {
    response.setHeader(
      'Content-Type',
      request.url === '/fixture.js' ? 'text/javascript' : 'text/html',
    )
    response.end(
      request.url === '/fixture.js'
        ? script
        : `<!doctype html><html><head><style>
      [data-popover] { background: white; border: 1px solid black; padding: 8px; }
    </style></head><body><script type="module" src="/fixture.js"></script></body></html>`,
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  let address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test server address')
  let page = await t.serve({
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    },
  })
  await page.goto('/')
  await page.locator('#trigger').waitFor()
  return page
}

async function pressDown(page: Awaited<ReturnType<typeof openFixture>>, selector: string) {
  let box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`Missing geometry for ${selector}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
}

async function nextFrames(page: Awaited<ReturnType<typeof openFixture>>) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

function isActive(page: Awaited<ReturnType<typeof openFixture>>, selector: string) {
  return page.locator(selector).evaluate((node) => node === document.activeElement)
}

function isOpen(page: Awaited<ReturnType<typeof openFixture>>) {
  return page.locator('[data-testid="popover"]').evaluate((node) => node.matches('[data-open]'))
}

describe('popover browser interactions', () => {
  it('opens on mouse press with focus on its initial target, held and after release', async (t) => {
    let page = await openFixture(t)
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.locator('#field:focus').waitFor()
    await nextFrames(page)
    expect(await isActive(page, '#field')).toBe(true)
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page)).toBe(true)
    expect(await isActive(page, '#field')).toBe(true)
  })

  it('closes on a second press of the trigger and restores focus to it', async (t) => {
    let page = await openFixture(t)
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.mouse.up()
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page)).toBe(false)
    expect(await isActive(page, '#trigger')).toBe(true)
  })

  it('is dismissed by a press outside, and by Escape with focus back on the trigger', async (t) => {
    let page = await openFixture(t)
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.mouse.up()
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })

    await pressDown(page, '#trigger')
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.mouse.up()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#trigger:focus').waitFor()
  })

  it('keeps keyboard activation on the native click', async (t) => {
    let page = await openFixture(t)
    await page.locator('#trigger').focus()
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.locator('#field:focus').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#trigger:focus').waitFor()
    await page.keyboard.down('Space')
    await nextFrames(page)
    expect(await isOpen(page)).toBe(false)
    await page.keyboard.up('Space')
    await page.locator('[data-testid="popover"][data-open]').waitFor()
  })
})
