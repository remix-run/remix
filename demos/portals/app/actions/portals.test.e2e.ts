import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'

import { router } from '../router.ts'

describe('portal demo', () => {
  it('keeps body content, focus and selection when its logical owner reloads', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    let note = page.getByRole('textbox', { name: 'Portal note' })
    await note.fill('Keep this note')
    await page.getByRole('button', { name: 'Count 0', exact: true }).click()
    let element = await note.elementHandle()
    await note.press('Home')
    await note.press('Shift+ArrowRight')
    let selection = await note.evaluate((node: HTMLTextAreaElement) => ({
      start: node.selectionStart,
      end: node.selectionEnd,
    }))
    let previous = await page.locator('.owner time').getAttribute('data-render-id')
    await note.press('Control+Enter')
    await waitForRender(page, '.owner time', previous)

    assert.equal(await element?.evaluate((node) => node.isConnected), true)
    assert.equal(await note.inputValue(), 'Keep this note')
    assert.deepEqual(
      await note.evaluate((node: HTMLTextAreaElement) => ({
        start: node.selectionStart,
        end: node.selectionEnd,
      })),
      selection,
    )
    assert.equal(await note.evaluate((node) => node === document.activeElement), true)
    await page.getByRole('button', { name: 'Count 1', exact: true }).waitFor()
    assert.equal(
      await note.evaluate((node) => node.parentElement?.parentElement === document.body),
      true,
    )
    assert.deepEqual(
      await note.evaluate((node) => {
        let style = getComputedStyle(node)
        return {
          background: style.backgroundColor,
          borderRadius: style.borderRadius,
          padding: style.padding,
        }
      }),
      { background: 'rgb(255, 255, 255)', borderRadius: '6px', padding: '10px' },
    )
    assert.deepEqual(errors, [])
  })

  it('keeps custom destination content through destination, document and inner frame reloads', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Portal note' }).waitFor()
    await page.locator('#container-a').waitFor()
    await page.getByRole('combobox', { name: 'Destination' }).selectOption('a')
    await page.locator('.portal[data-placement="a"]').waitFor()
    assert.equal(
      await page.locator('.portal').evaluate((node) => node.parentElement?.id),
      'container-a',
    )
    let note = page.getByRole('textbox', { name: 'Portal note' })
    await note.fill('Container note')
    await page.getByRole('button', { name: 'Count 0', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Second portal' }).check()
    let element = await note.elementHandle()
    let destination = await page.locator('#container-a > time').getAttribute('data-render-id')
    await page.getByRole('button', { name: 'Reload A', exact: true }).click()
    await waitForRender(page, '#container-a > time', destination)
    assert.equal(await element?.evaluate((node) => node.isConnected), true)
    assert.equal(await note.inputValue(), 'Container note')

    let owner = await page.locator('.owner time').getAttribute('data-render-id')
    destination = await page.locator('#container-a > time').getAttribute('data-render-id')
    await page.getByRole('button', { name: 'Reload document', exact: true }).click()
    await waitForRender(page, '.owner time', owner)
    await waitForRender(page, '#container-a > time', destination)
    assert.equal(await element?.evaluate((node) => node.isConnected), true)
    assert.equal(await note.inputValue(), 'Container note')
    await page.getByRole('button', { name: 'Count 1', exact: true }).waitFor()
    assert.equal(await page.locator('#container-a .companion').innerText(), 'Second portal')

    let inner = await page.locator('.inner-frame time').getAttribute('data-render-id')
    owner = await page.locator('.owner time').getAttribute('data-render-id')
    await page.getByRole('button', { name: 'Reload inner frame', exact: true }).click()
    await waitForRender(page, '.inner-frame time', inner)
    assert.equal(await page.locator('.owner time').getAttribute('data-render-id'), owner)
    assert.equal(await element?.evaluate((node) => node.isConnected), true)
    assert.deepEqual(errors, [])
  })

  it('resets on retarget and removes nested content without removing a sibling portal', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto('/')
    let note = page.getByRole('textbox', { name: 'Portal note' })
    await note.fill('Reset this note')
    await page.getByRole('button', { name: 'Count 0', exact: true }).click()
    await page.getByRole('button', { name: 'Nested portal', exact: true }).click()
    await page.getByRole('complementary', { name: 'Nested portal' }).waitFor()
    await page.locator('#container-b').waitFor()
    await page.getByRole('combobox', { name: 'Destination' }).selectOption('b')
    await page.locator('.portal[data-placement="b"]').waitFor()
    assert.equal(
      await page.locator('.portal').evaluate((node) => node.parentElement?.id),
      'container-b',
    )
    await page
      .locator('#container-b')
      .getByRole('button', { name: 'Count 0', exact: true })
      .waitFor()
    assert.equal(await note.inputValue(), '')
    assert.equal(await page.getByRole('complementary', { name: 'Nested portal' }).count(), 0)
    await page.getByRole('checkbox', { name: 'Second portal' }).check()
    await page.locator('#container-b .companion').waitFor()
    await page.getByRole('button', { name: 'Nested portal', exact: true }).click()
    await page.getByRole('complementary', { name: 'Nested portal' }).waitFor()
    await page.getByRole('checkbox', { name: 'Mounted', exact: true }).uncheck()
    await note.waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('complementary', { name: 'Nested portal' }).count(), 0)
    assert.equal(await page.locator('#container-b .companion').innerText(), 'Second portal')
    await page.getByRole('checkbox', { name: 'Mounted', exact: true }).check()
    await page
      .locator('#container-b')
      .getByRole('button', { name: 'Count 0', exact: true })
      .waitFor()
    assert.equal(await note.inputValue(), '')
  })

  it('does not resurrect old content when retargeting and unmounting during pending reloads', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Portal note' }).waitFor()
    await page.locator('#container-a').waitFor()
    await page.locator('#container-b').waitFor()
    await page.getByRole('combobox', { name: 'Destination' }).selectOption('a')
    await page.getByRole('textbox', { name: 'Portal note' }).fill('Old destination')
    await page.getByRole('checkbox', { name: 'Second portal' }).check()
    await page.getByRole('button', { name: 'Nested portal', exact: true }).click()

    let destinationRequested = Promise.withResolvers<void>()
    let releaseDestination = Promise.withResolvers<void>()
    t.after(() => releaseDestination.resolve())
    await page.route('**/containers/a', async (route) => {
      destinationRequested.resolve()
      await releaseDestination.promise
      await route.continue()
    })
    let destinationVersion = await page
      .locator('#container-a > time')
      .getAttribute('data-render-id')
    await page.getByRole('button', { name: 'Reload A', exact: true }).click()
    await destinationRequested.promise
    await page.getByRole('combobox', { name: 'Destination' }).selectOption('b')
    let note = page.getByRole('textbox', { name: 'Portal note' })
    await page.locator('#container-b .portal').waitFor()
    await note.fill('New destination')
    let element = await note.elementHandle()
    releaseDestination.resolve()
    await waitForRender(page, '#container-a > time', destinationVersion)
    assert.equal(await element?.evaluate((node) => node.isConnected), true)
    assert.equal(await note.inputValue(), 'New destination')
    assert.equal(await page.locator('#container-a .portal, #container-a .companion').count(), 0)
    assert.equal(await page.getByRole('complementary', { name: 'Nested portal' }).count(), 0)
    assert.equal(await page.locator('#container-b .companion').count(), 1)

    let ownerRequested = Promise.withResolvers<void>()
    let releaseOwner = Promise.withResolvers<void>()
    t.after(() => releaseOwner.resolve())
    await page.route('**/owner', async (route) => {
      ownerRequested.resolve()
      await releaseOwner.promise
      await route.continue()
    })
    let ownerVersion = await page.locator('.owner time').getAttribute('data-render-id')
    await page.getByRole('button', { name: 'Reload owner', exact: true }).click()
    await ownerRequested.promise
    await page.getByRole('checkbox', { name: 'Mounted', exact: true }).uncheck()
    await note.waitFor({ state: 'detached' })
    releaseOwner.resolve()
    await waitForRender(page, '.owner time', ownerVersion)
    assert.equal(await page.locator('.portal').count(), 0)
    assert.equal(await page.locator('#container-b .companion').count(), 1)
    await page.getByRole('checkbox', { name: 'Mounted', exact: true }).check()
    await page.locator('#container-b .portal').waitFor()
    assert.equal(await note.inputValue(), '')
    assert.deepEqual(errors, [])
  })
})

type Page = Awaited<ReturnType<TestContext['serve']>>

async function waitForRender(page: Page, selector: string, previous: string | null): Promise<void> {
  assert.ok(previous, `Expected a render marker at ${selector}`)
  await page.waitForFunction(
    ({ selector, previous }) => {
      let current = document.querySelector(selector)?.getAttribute('data-render-id')
      return current !== undefined && current !== null && current !== previous
    },
    { selector, previous },
  )
}
