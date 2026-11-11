import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

async function openFixture(
  t: TestContext,
  options: {
    modal?: boolean
    confirm?: boolean
    detached?: boolean
    open?: boolean
    press?: boolean
  } = {},
) {
  let result = await build({
    entryPoints: [fileURLToPath(new URL('./dialog.fixture.tsx', import.meta.url))],
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
      [role="dialog"] { inset: 0; margin: auto; height: max-content; background: white; width: min(28rem, calc(100vw - 4rem)); max-height: calc(100dvh - 4rem); overflow: auto; padding: 1rem; }
      [data-testid$="backdrop"] { position: fixed; inset: 0; margin: 0; width: auto; height: auto; border: 0; background: #0008; }
      [data-popover] { background: white; border: 1px solid black; padding: 8px; }
      button, input { margin: .25rem; }
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
  let params = new URLSearchParams()
  if (options.modal === false) params.set('modal', 'false')
  if (options.confirm) params.set('confirm', 'true')
  if (options.detached) params.set('detached', 'true')
  if (options.press) params.set('press', 'true')
  await page.goto(`/?${params}`)
  if (options.open !== false) {
    await page.locator('#trigger').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
  }
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

function isOpen(page: Awaited<ReturnType<typeof openFixture>>, testId: string) {
  return page.locator(`[data-testid="${testId}"]`).evaluate((node) => node.matches('[data-open]'))
}

describe('dialog browser interactions', () => {
  it('escapes transformed clipping ancestors through ordinary DOM portals', async (t) => {
    let page = await openFixture(t)
    await page.locator('#app').evaluate((node) => {
      node.style.cssText =
        'transform: translate(20px, 20px); overflow: hidden; width: 40px; height: 40px; isolation: isolate'
    })
    expect(await page.locator(':popover-open').count()).toBe(0)
    expect(await page.locator('[popover]').count()).toBe(0)
    expect(await page.locator('#app [role="dialog"]').count()).toBe(0)
    await page.locator('#name').fill('Portal content')
    await page.locator('#popover-trigger').click()
    await page.locator('#popup-action').click()
    await page.keyboard.press('Escape')
    await page.locator('#close').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('allows an ordinary higher-z-index widget to appear above a non-modal dialog', async (t) => {
    let page = await openFixture(t, { modal: false })
    await page.locator('[data-testid="dialog"]').evaluate((node) => {
      let rect = node.getBoundingClientRect()
      let widget = document.createElement('button')
      widget.id = 'foreign-widget'
      widget.textContent = 'External widget'
      widget.style.cssText = `position: fixed; z-index: 10000; left: ${rect.left}px; top: ${rect.top}px; width: 180px; height: 60px;`
      widget.addEventListener('click', () => {
        widget.textContent = 'Clicked'
      })
      document.body.append(widget)
    })
    await page.locator('#foreign-widget').click()
    expect(await page.locator('#foreign-widget').textContent()).toBe('Clicked')
  })

  it('places a child backdrop above its parent and below its own dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#child-trigger').click()
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor()
    let order = await page.evaluate(() => {
      function z(testId: string) {
        let node = document.querySelector(`[data-testid="${testId}"]`)
        if (!node) throw new Error('Missing layer')
        return Number(getComputedStyle(node).zIndex)
      }
      return (
        z('backdrop') < z('dialog') &&
        z('dialog') < z('child-backdrop') &&
        z('child-backdrop') < z('child-dialog')
      )
    })
    expect(order).toBe(true)
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(await page.locator('[data-testid="dialog"][data-open]').count()).toBe(1)
    await page.locator('#name').fill('Still editing')
  })

  it('returns to the editor after a vetoed outside dismissal opens a confirmation', async (t) => {
    let page = await openFixture(t, { confirm: true })
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor()
    await page.locator('#child-close').click()
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    expect(await page.locator('#name').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
  })

  it('toggles a non-modal dialog closed with either trigger after pointer focus moves', async (t) => {
    let page = await openFixture(t, { modal: false })
    await page.locator('#trigger').click()
    await page
      .locator('[data-testid="dialog"][data-open]')
      .waitFor({ state: 'hidden', timeout: 2000 })
    await page.locator('#trigger').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.locator('#second-trigger').click()
    await page
      .locator('[data-testid="dialog"][data-open]')
      .waitFor({ state: 'hidden', timeout: 2000 })
  })

  it('contains keyboard focus and restores focus after a real Escape press', async (t) => {
    let page = await openFixture(t)
    expect(await page.locator('#name').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
    await page.locator('#outside').evaluate((node) => node.focus())
    expect(await page.locator('#outside').evaluate((node) => node === document.activeElement)).toBe(
      false,
    )
    await page.locator('#name').focus()
    await page.keyboard.press('Shift+Tab')
    expect(await page.locator('#outside').evaluate((node) => node === document.activeElement)).toBe(
      false,
    )
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(await page.locator('#trigger').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
  })

  it('closes nested dialogs one at a time with Escape', async (t) => {
    let page = await openFixture(t)
    await page.locator('#child-trigger').click()
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    expect(
      await page.locator('#child-trigger').evaluate((node) => node === document.activeElement),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses a popover before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#popover-trigger').click()
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses a menu before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#menu-trigger').click()
    await page.locator('[data-testid="menu"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="menu"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('requires releasing Escape before dismissing the dialog after its menu', async (t) => {
    let page = await openFixture(t)
    await page.locator('#menu-trigger').click()
    await page.locator('[data-testid="menu"][data-open]').waitFor()
    await page.keyboard.down('Escape')
    await page.locator('[data-testid="menu"][data-open]').waitFor({ state: 'hidden' })
    await page.keyboard.down('Escape')
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.up('Escape')
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('wraps Tab from the last menu back to the first dialog control', async (t) => {
    let page = await openFixture(t)
    await page.locator('#menu-trigger').click()
    await page.locator('[data-testid="menu"][data-open]').waitFor()
    await page.keyboard.press('Tab')
    expect(await page.locator('#name').evaluate((node) => node === document.activeElement)).toBe(
      true,
    )
    await page.locator('[data-testid="menu"][data-open]').waitFor({ state: 'hidden' })
  })

  it('keeps a detached popup focusable and returns focus to its dialog anchor', async (t) => {
    let page = await openFixture(t, { detached: true })
    await page.locator('#popover-trigger').click()
    await page.locator('[data-testid="popover"][data-open]').waitFor()
    await page.locator('#popup-action:focus').waitFor()
    await page.locator('#popup-action').click()
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="popover"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#popover-trigger:focus').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses a select before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#select-trigger').click()
    await page.locator('[data-testid="select"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="select"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses a combobox before its containing dialog', async (t) => {
    let page = await openFixture(t)
    await page.locator('#combobox-input').fill('Re')
    await page.locator('[data-testid="combobox"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="combobox"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('dismisses only the dropdown on the first backdrop click', async (t) => {
    let page = await openFixture(t)
    await page.locator('#select-trigger').click()
    await page.locator('[data-testid="select"][data-open]').waitFor()
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="select"][data-open]').waitFor({ state: 'hidden' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    expect(await page.locator('#outside').textContent()).toBe('Outside 0')
  })

  it('ignores right clicks outside the dialog', async (t) => {
    let page = await openFixture(t)
    await page.mouse.click(2, 2, { button: 'right' })
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
  })

  it('ignores drags that start inside the dialog', async (t) => {
    let page = await openFixture(t)
    let rect = await page.locator('#name').boundingBox()
    if (!rect) throw new Error('Missing input geometry')
    await page.mouse.move(rect.x + 4, rect.y + 4)
    await page.mouse.down()
    await page.mouse.move(2, 2)
    await page.mouse.up()
    expect(
      await page.locator('[data-testid="dialog"]').evaluate((node) => node.matches('[data-open]')),
    ).toBe(true)
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#trigger').click()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('opens on mouse press with press() and is not dismissed by the release over its own backdrop', async (t) => {
    let page = await openFixture(t, { press: true, open: false })
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    // The release lands on the backdrop that now covers the opener.
    expect(
      await page.locator('#trigger').evaluate((node) => {
        let rect = node.getBoundingClientRect()
        return document
          .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          ?.matches('[data-testid="backdrop"]')
      }),
    ).toBe(true)
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(true)
    expect(await isActive(page, '#name')).toBe(true)
    expect(await page.locator('#outside').textContent()).toBe('Outside 0')
    await page.mouse.click(2, 2)
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
  })

  it('closes on mouse press of a press() close button and returns focus to the trigger', async (t) => {
    let page = await openFixture(t, { press: true, open: false })
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.mouse.up()
    await pressDown(page, '#close')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#trigger:focus').waitFor()
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(false)
    expect(await isActive(page, '#trigger')).toBe(true)
  })

  it('opens and closes a nested dialog on press with press() and returns focus to its opener', async (t) => {
    let page = await openFixture(t, { press: true })
    await pressDown(page, '#child-trigger')
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor()
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page, 'child-dialog')).toBe(true)
    expect(await isOpen(page, 'dialog')).toBe(true)
    await pressDown(page, '#child-close')
    await page.locator('[data-testid="child-dialog"][data-open]').waitFor({ state: 'hidden' })
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(true)
    await page.locator('#child-trigger:focus').waitFor()
  })

  it('toggles a non-modal dialog closed on press of its press() trigger', async (t) => {
    let page = await openFixture(t, { press: true, modal: false, open: false })
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(true)
    expect(await isActive(page, '#name')).toBe(true)
    await pressDown(page, '#trigger')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(false)
  })

  it('opens on release by default, and a press dragged off the trigger opens nothing', async (t) => {
    let page = await openFixture(t, { open: false })
    await pressDown(page, '#trigger')
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(false)
    await page.mouse.up()
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })

    await pressDown(page, '#trigger')
    await page.mouse.move(2, 2)
    await page.mouse.up()
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(false)
  })

  it('keeps keyboard activation on the native click', async (t) => {
    let page = await openFixture(t, { open: false, press: true })
    await page.locator('#trigger').focus()
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-testid="dialog"][data-open]').waitFor({ state: 'hidden' })
    await page.locator('#trigger:focus').waitFor()
    await page.keyboard.down('Space')
    await nextFrames(page)
    expect(await isOpen(page, 'dialog')).toBe(false)
    await page.keyboard.up('Space')
    await page.locator('[data-testid="dialog"][data-open]').waitFor()
  })
})
