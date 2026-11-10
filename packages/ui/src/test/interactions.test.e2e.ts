import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import type { Locator, Page } from 'playwright'

async function openDemo(t: TestContext) {
  let result = await build({
    entryPoints: [fileURLToPath(new URL('./interactions.fixture.tsx', import.meta.url))],
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
        : `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin: 0; padding: 16px"><script type="module" src="/fixture.js"></script></body></html>`,
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
  await page.locator('#pressed').waitFor()
  return page
}

// Two frames, then past the selection flash that menus and comboboxes run before committing.
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.waitForTimeout(250)
}

async function activations(section: Locator) {
  let text = await section.getByLabel('Activations').innerText()
  return text === 'none' ? [] : text.split(' ')
}

async function pressDown(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  let box = await target.boundingBox()
  if (!box) throw new Error('Missing geometry')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await settle(page)
}

async function release(page: Page) {
  await page.mouse.up()
  await settle(page)
}

// Presses a control and checks it activated `name` once: on the press when `onPress`, otherwise
// only once the mouse is released.
async function expectActivation(
  page: Page,
  section: Locator,
  target: Locator,
  name: string,
  onPress: boolean,
) {
  let before = await activations(section)
  await pressDown(page, target)
  let pressed = (await activations(section)).filter((entry) => !before.includes(entry))
  expect(pressed.filter((entry) => entry.startsWith(`${name}:`))).toEqual(
    onPress ? [`${name}:1`] : [],
  )
  await release(page)
  let released = (await activations(section)).filter((entry) => entry.startsWith(`${name}:`))
  expect(released).toEqual([`${name}:1`])
}

// The visible popup surface; closed surfaces in the other section stay in the DOM, hidden.
function openPopup(page: Page) {
  return page.locator('[data-popover][data-open]').last()
}

function controls(section: Locator) {
  return [
    [section.getByRole('tab', { name: 'Activity' }), 'tab'],
    [section.getByRole('button', { name: 'Billing' }), 'accordion'],
    [section.getByRole('switch', { name: 'Notifications' }), 'switch'],
    [section.getByRole('switch', { name: 'Desktop alerts' }), 'toggle'],
    [section.getByText('Newsletter', { exact: true }), 'form-label'],
    [section.getByText('Native checkbox'), 'checkbox'],
    [section.getByText('Small'), 'radio-s'],
    [section.getByText('Large'), 'radio-l'],
    [section.getByRole('button', { name: 'Submit' }), 'submit'],
    [section.getByRole('button', { name: 'Reset' }), 'reset'],
  ] as const
}

describe('interactions demo', () => {
  it('activates default controls on release, exactly once', async (t) => {
    let page = await openDemo(t)
    let section = page.locator('#default')

    for (let [target, name] of controls(section)) {
      await expectActivation(page, section, target, name, false)
    }
  })

  it('activates press() controls on press, exactly once', async (t) => {
    let page = await openDemo(t)
    let section = page.locator('#pressed')

    for (let [target, name] of controls(section)) {
      await expectActivation(page, section, target, name, true)
    }
  })

  it('activates feedback-only press() controls on release, with press feedback', async (t) => {
    let page = await openDemo(t)

    for (let id of ['default', 'pressed']) {
      let section = page.locator(`#${id}`)
      let target = section.getByRole('button', { name: 'Feedback only' })
      await pressDown(page, target)
      expect(await section.getByRole('button', { name: 'Pressed' }).count()).toBe(1)
      expect(await activations(section)).toEqual([])
      await release(page)
      expect(await activations(section)).toEqual(['feedback:1'])
    }
  })

  it('lists a listbox option on release by default and on press with press()', async (t) => {
    let page = await openDemo(t)

    for (let [id, onPress] of [
      ['default', false],
      ['pressed', true],
    ] as const) {
      let section = page.locator(`#${id}`)
      let option = section.getByRole('listbox', { name: 'Listbox' }).getByRole('option', {
        name: 'Remix',
      })
      await expectActivation(page, section, option, 'listbox', onPress)
    }
  })

  it('opens select on press, then commits an option on release or on press', async (t) => {
    let page = await openDemo(t)

    for (let [id, onPress] of [
      ['default', false],
      ['pressed', true],
    ] as const) {
      let section = page.locator(`#${id}`)
      await pressDown(page, section.locator('button[aria-haspopup]', { hasText: 'Remix' }))
      expect(
        await openPopup(page).getByRole('option', { name: 'React', exact: true }).isVisible(),
      ).toBe(true)
      await release(page)
      expect(
        await openPopup(page).getByRole('option', { name: 'React', exact: true }).isVisible(),
      ).toBe(true)
      expect(await activations(section)).toEqual([])

      await expectActivation(
        page,
        section,
        openPopup(page).getByRole('option', { name: 'React', exact: true }),
        'select',
        onPress,
      )
    }
  })

  it('opens menu on press, then commits an item on release or on press', async (t) => {
    let page = await openDemo(t)

    for (let [id, onPress] of [
      ['default', false],
      ['pressed', true],
    ] as const) {
      let section = page.locator(`#${id}`)
      await pressDown(page, section.getByRole('button', { name: 'View' }))
      expect(
        await openPopup(page).getByRole('menuitemcheckbox', { name: 'Word wrap' }).isVisible(),
      ).toBe(true)
      await release(page)
      expect(
        await openPopup(page).getByRole('menuitemcheckbox', { name: 'Word wrap' }).isVisible(),
      ).toBe(true)

      await expectActivation(
        page,
        section,
        openPopup(page).getByRole('menuitemcheckbox', { name: 'Word wrap' }),
        'menu-wrap',
        onPress,
      )
    }
  })

  it('opens a submenu on release by default and on press with press()', async (t) => {
    let page = await openDemo(t)

    for (let [id, onPress] of [
      ['default', false],
      ['pressed', true],
    ] as const) {
      let section = page.locator(`#${id}`)
      await pressDown(page, section.getByRole('button', { name: 'View' }))
      await release(page)

      // Hovering a submenu trigger opens it after a delay, which would pass for press activation.
      // Freezing the page clock keeps that timer from firing, so only a press or click can open it.
      await page.clock.install()
      await page.clock.pauseAt(Date.now() + 1000)
      let trigger = page.getByRole('menuitem', { name: 'Zoom', exact: true })
      let submenuItem = page.getByRole('menuitem', { name: 'Zoom in' })

      let box = await trigger.boundingBox()
      if (!box) throw new Error('Missing geometry')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(250)
      expect(await trigger.getAttribute('aria-expanded')).toBe(onPress ? 'true' : 'false')
      expect(await submenuItem.isVisible()).toBe(onPress)

      await page.mouse.up()
      await page.waitForTimeout(250)
      expect(await trigger.getAttribute('aria-expanded')).toBe('true')
      expect(await submenuItem.isVisible()).toBe(true)
      await page.clock.resume()
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await settle(page)
    }
  })

  it('commits a combobox option on release or on press', async (t) => {
    let page = await openDemo(t)

    for (let [id, onPress] of [
      ['default', false],
      ['pressed', true],
    ] as const) {
      let section = page.locator(`#${id}`)
      await section.getByRole('combobox', { name: 'Framework' }).fill('rea')
      await settle(page)

      await expectActivation(
        page,
        section,
        openPopup(page).getByRole('option', { name: 'React', exact: true }),
        'combobox',
        onPress,
      )
    }
  })

  it('opens a popover and a dialog on release, or on press with press()', async (t) => {
    let page = await openDemo(t)

    for (let [id, onPress] of [
      ['default', false],
      ['pressed', true],
    ] as const) {
      let section = page.locator(`#${id}`)
      await expectActivation(
        page,
        section,
        section.getByRole('button', { name: 'Popover' }),
        'popover',
        onPress,
      )
      expect(await openPopup(page).getByRole('button', { name: 'Close popover' }).isVisible()).toBe(
        true,
      )
      await page.keyboard.press('Escape')
      await settle(page)

      await expectActivation(
        page,
        section,
        section.getByRole('button', { name: 'Dialog' }),
        'dialog',
        onPress,
      )
      await expectActivation(
        page,
        section,
        page.getByRole('button', { name: 'Discard' }),
        'confirm',
        onPress,
      )
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await settle(page)
    }
  })
})
