import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import type { Page } from 'playwright'

async function openFixture(t: TestContext) {
  let result = await build({
    entryPoints: [fileURLToPath(new URL('./press-lifecycle.fixture.tsx', import.meta.url))],
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
        : `<!doctype html><html><body style="padding: 40px"><script type="module" src="/fixture.js"></script></body></html>`,
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
  await page.locator('#plain').waitFor()
  return page
}

function log(page: Page) {
  return page.evaluate(() => window.log)
}

async function moveTo(page: Page, selector: string) {
  let box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`Missing geometry for ${selector}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}

describe('press lifecycle browser interactions', () => {
  it('reports a mouse press as it activates, then ends it on release', async (t) => {
    let page = await openFixture(t)
    await moveTo(page, '#plain')
    await page.mouse.down()
    expect(await log(page)).toEqual(['start', 'click'])
    await page.mouse.up()
    expect(await log(page)).toEqual(['start', 'click', 'end'])
  })

  it('consumes a held mouse press with a long press and cancels its click', async (t) => {
    let page = await openFixture(t)
    await moveTo(page, '#long')
    await page.mouse.down()
    expect(await log(page)).toEqual(['start'])
    await page.waitForFunction(() => window.log.includes('long'))
    await page.mouse.up()
    expect(await log(page)).toEqual(['start', 'long', 'cancel'])

    // The next press is a normal one.
    await page.mouse.down()
    await page.mouse.up()
    expect(await log(page)).toEqual(['start', 'long', 'cancel', 'start', 'end', 'click'])
  })

  it('does not long press a press released in time', async (t) => {
    let page = await openFixture(t)
    await moveTo(page, '#long')
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(450)
    expect(await log(page)).toEqual(['start', 'end', 'click'])
  })

  it('cancels when the pointer leaves, before the release, and does not long press', async (t) => {
    let page = await openFixture(t)
    await moveTo(page, '#long')
    await page.mouse.down()
    await page.mouse.move(400, 400)
    expect(await log(page)).toEqual(['start', 'cancel'])
    await page.waitForTimeout(450)
    await page.mouse.up()
    expect(await log(page)).toEqual(['start', 'cancel'])
  })

  it('cancels a pointer press on Escape and keeps its release from activating', async (t) => {
    let page = await openFixture(t)
    await moveTo(page, '#long')
    await page.mouse.down()
    await page.keyboard.press('Escape')
    expect(await log(page)).toEqual(['start', 'cancel'])
    await page.mouse.up()
    expect(await log(page)).toEqual(['start', 'cancel'])
  })

  it('reports Enter and Space presses and keeps their activation native', async (t) => {
    let page = await openFixture(t)
    await page.locator('#plain').focus()
    await page.keyboard.press('Enter')
    expect((await log(page)).sort()).toEqual(['click', 'end', 'start'])
    await page.keyboard.press(' ')
    expect((await log(page)).sort()).toEqual(['click', 'click', 'end', 'end', 'start', 'start'])
  })

  it('cancels a Space press on Escape without activating', async (t) => {
    let page = await openFixture(t)
    await page.locator('#long').focus()
    await page.keyboard.down(' ')
    await page.keyboard.press('Escape')
    await page.keyboard.up(' ')
    expect(await log(page)).toEqual(['start', 'cancel'])
  })

  it('activates a quick Enter press once, on release', async (t) => {
    let page = await openFixture(t)
    await page.locator('#long').focus()
    await page.keyboard.down('Enter')
    expect(await log(page)).toEqual(['start'])
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['start', 'end', 'click'])
  })

  it('consumes a held Enter press with a long press and activates nothing', async (t) => {
    let page = await openFixture(t)
    await page.locator('#long').focus()
    await page.keyboard.down('Enter')
    await page.waitForFunction(() => window.log.includes('long'))
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['start', 'long', 'cancel'])
  })

  it('does not activate on the auto-repeat of a held Enter press', async (t) => {
    let page = await openFixture(t)
    await page.locator('#long').focus()
    for (let i = 0; i < 4; i++) await page.keyboard.down('Enter')
    await page.waitForFunction(() => window.log.includes('long'))
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['start', 'long', 'cancel'])
  })

  it('does not activate an Enter press that Escape cancelled', async (t) => {
    let page = await openFixture(t)
    await page.locator('#long').focus()
    await page.keyboard.down('Enter')
    await page.keyboard.press('Escape')
    await page.keyboard.down('Enter')
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['start', 'cancel'])
  })

  it('does not activate an Enter press whose host lost focus', async (t) => {
    let page = await openFixture(t)
    await page.locator('#long').focus()
    await page.keyboard.down('Enter')
    await page.locator('#plain').focus()
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['start', 'cancel'])
  })

  it('keeps native Enter activation on keydown for a host without a long press', async (t) => {
    let page = await openFixture(t)
    await page.locator('#plain').focus()
    await page.keyboard.down('Enter')
    expect(await log(page)).toContain('click')
    await page.keyboard.up('Enter')
    expect((await log(page)).filter((entry) => entry === 'click')).toEqual(['click'])
  })

  it('submits the form once, from the pressed submit button, when Enter is released', async (t) => {
    let page = await openFixture(t)
    await page.locator('#submit').focus()
    await page.keyboard.down('Enter')
    await page.keyboard.down('Enter')
    expect(await log(page)).toEqual([])
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['submit:save'])
  })

  it('does not submit a long Enter press', async (t) => {
    let page = await openFixture(t)
    await page.locator('#submit').focus()
    await page.keyboard.down('Enter')
    await page.waitForFunction(() => window.log.includes('long'))
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['long'])
  })

  it('follows a link once when Enter is released', async (t) => {
    let page = await openFixture(t)
    await page.locator('#link').focus()
    await page.keyboard.down('Enter')
    await page.keyboard.down('Enter')
    expect(await log(page)).toEqual(['start'])
    await page.keyboard.up('Enter')
    await page.waitForFunction(() => window.log.includes('hash'))
    await page.waitForTimeout(50)
    expect((await log(page)).sort()).toEqual(['click', 'end', 'hash', 'start'])
    expect(page.url()).toMatch(/#linked$/)
  })

  it('does not follow a link on a long Enter press', async (t) => {
    let page = await openFixture(t)
    await page.locator('#link').focus()
    await page.keyboard.down('Enter')
    await page.waitForFunction(() => window.log.includes('long'))
    await page.keyboard.up('Enter')
    await page.waitForTimeout(50)
    expect(await log(page)).toEqual(['start', 'long', 'cancel'])
    expect(page.url()).not.toContain('#')
  })

  it('does not scroll or activate a link on Space, as before', async (t) => {
    let page = await openFixture(t)
    await page.locator('#link').focus()
    await page.keyboard.press(' ')
    await page.waitForTimeout(50)
    expect(await log(page)).toEqual(['start', 'end'])
  })

  it('still activates from an assistive technology click with no key press', async (t) => {
    let page = await openFixture(t)
    await page.locator('#long').evaluate((button: HTMLButtonElement) => button.click())
    expect(await log(page)).toEqual(['click'])
  })

  it('keeps the keydown user activation for a release just before a long press', async (t) => {
    let page = await openFixture(t)
    await page.locator('#gated').focus()
    await page.keyboard.down('Enter')
    await page.keyboard.up('Enter')
    await page.keyboard.down('Enter')
    await page.waitForTimeout(1900)
    await page.keyboard.up('Enter')
    expect(await log(page)).toEqual(['start', 'end', 'active:true', 'start', 'end', 'active:true'])
  })
})
