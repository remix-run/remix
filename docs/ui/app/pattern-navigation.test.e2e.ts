import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'
import { router } from './router.ts'

async function openDocs(t: TestContext, pattern: string) {
  let previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  })
  let page = await t.serve(await createTestServer(router.fetch))
  // Measure native Tab preferences rather than assuming every control is a stop.
  await page.setContent(
    '<input id="start"><input type="checkbox" id="checkbox"><button id="button">Button</button><input id="end">',
  )
  await page.locator('#start').press('Tab')
  let tabsCheckboxes = await page
    .locator('#checkbox')
    .evaluate((node) => node === document.activeElement)
  await page.locator('#checkbox').press('Tab')
  let tabsButtons = await page
    .locator('#button')
    .evaluate((node) => node === document.activeElement)
  await page.goto(`/patterns/${pattern}/`)
  return { page, tabsCheckboxes, tabsButtons }
}

async function waitForDestination(
  page: Awaited<ReturnType<TestContext['serve']>>,
  selector: string,
) {
  // SSR IDs can change during hydration, so read the current reference on each poll.
  await page.waitForFunction((selector) => {
    let id = document.querySelector(selector)?.getAttribute('aria-controls')
    return !!id && !!document.getElementById(id)
  }, selector)
}

describe('Pattern docs keyboard navigation', () => {
  it('continues from the Popover demo in both directions without visiting its destination twice', async (t) => {
    let { page, tabsCheckboxes } = await openDocs(t, 'popover')
    let trigger = page.getByRole('button', { name: 'Filter pull requests', exact: true })
    let first = page.getByRole('checkbox', { name: 'Open', exact: true })
    let last = page.getByRole('checkbox', { name: 'Closed', exact: true })
    let following = page.locator('#basic').getByRole('button', { name: 'Show code', exact: true })
    await waitForDestination(page, 'button[aria-label="Filter pull requests"]')
    await trigger.press('Enter')
    await first.locator(':scope:focus').waitFor()
    await page.keyboard.press('Shift+Tab')
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    await page.keyboard.press('Tab')
    assert.equal(await first.evaluate((node) => node === document.activeElement), true)
    if (tabsCheckboxes) {
      await page.keyboard.press('Tab')
      assert.equal(
        await page
          .getByRole('checkbox', { name: 'Merged' })
          .evaluate((node) => node === document.activeElement),
        true,
      )
      await page.keyboard.press('Tab')
      assert.equal(await last.evaluate((node) => node === document.activeElement), true)
    }
    await page.keyboard.press('Tab')
    assert.equal(await following.evaluate((node) => node === document.activeElement), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await last.evaluate((node) => node === document.activeElement), true)
    await following.press('Tab')
    assert.equal(await first.getAttribute('tabindex'), '-1')
    assert.equal(await last.getAttribute('tabindex'), '-1')
    await page.getByRole('link', { name: 'Discord', exact: true }).press('Tab')
    let surface = page.getByRole('dialog', { name: 'Filter pull requests', exact: true })
    assert.equal(await surface.evaluate((node) => node.contains(document.activeElement)), false)
  })

  it('continues from the Menu demo after closing its portaled submenu on Tab', async (t) => {
    let { page } = await openDocs(t, 'menu')
    let trigger = page.locator('#submenus').getByRole('button', { name: 'File', exact: true })
    await waitForDestination(page, '#submenus button[aria-haspopup="menu"]')
    await trigger.press('Enter')
    await page.getByRole('menuitem', { name: 'Export as', exact: true }).press('ArrowRight')
    let submenu = page.getByRole('menu', { name: 'Export as', exact: true })
    await submenu.waitFor({ state: 'visible' })
    await page.keyboard.press('Tab')
    await page.getByRole('menu', { name: 'File', exact: true }).waitFor({ state: 'hidden' })
    let following = page
      .locator('#submenus')
      .getByRole('button', { name: 'Show code', exact: true })
    assert.equal(await following.evaluate((node) => node === document.activeElement), true)
    await waitForDestination(page, '#submenus button[aria-haspopup="menu"]')
    await trigger.press('Enter')
    await page.getByRole('menuitem', { name: 'Export as', exact: true }).press('ArrowRight')
    await submenu.waitFor({ state: 'visible' })
    await page.keyboard.press('Shift+Tab')
    await page.getByRole('menu', { name: 'File', exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
  })

  it('continues through the Select form without committing the highlighted option on Tab or Shift+Tab', async (t) => {
    let { page } = await openDocs(t, 'select')
    let trigger = page
      .locator('#forms')
      .getByRole('button', { name: 'Delivery method', exact: true })
    await waitForDestination(page, '#forms button[aria-label="Delivery method"]')
    await trigger.press('ArrowDown')
    let list = page.getByRole('listbox', { name: 'Delivery methods', exact: true })
    await list.waitFor({ state: 'visible' })
    await page.keyboard.press('ArrowDown')
    await page
      .getByRole('option', { name: 'Express delivery', exact: true })
      .locator(':scope[data-highlighted="true"]')
      .waitFor()
    await page.keyboard.press('Tab')
    await list.waitFor({ state: 'hidden' })
    let submit = page.getByRole('button', { name: 'Save delivery preference', exact: true })
    assert.equal(await submit.evaluate((node) => node === document.activeElement), true)
    assert.equal(await page.locator('#forms input[name="delivery"]').inputValue(), 'standard')
    await waitForDestination(page, '#forms button[aria-label="Delivery method"]')
    await trigger.press('ArrowDown')
    await list.waitFor({ state: 'visible' })
    await page.keyboard.press('ArrowDown')
    await page
      .getByRole('option', { name: 'Express delivery', exact: true })
      .locator(':scope[data-highlighted="true"]')
      .waitFor()
    await page.keyboard.press('Shift+Tab')
    await list.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    assert.equal(await page.locator('#forms input[name="delivery"]').inputValue(), 'standard')
  })

  it('keeps Combobox option focus on its input and continues with native document navigation', async (t) => {
    let { page, tabsButtons } = await openDocs(t, 'combobox')
    let input = page.locator('#forms').getByRole('combobox')
    await waitForDestination(page, '#forms input[role="combobox"]')
    await input.press('ArrowDown')
    await page.getByRole('listbox').waitFor({ state: 'visible' })
    await page.keyboard.press('ArrowDown')
    assert.equal(await input.evaluate((node) => node === document.activeElement), true)
    await page.keyboard.press('Tab')
    await page.getByRole('listbox').waitFor({ state: 'hidden' })
    let submit = page.locator('#forms').getByRole('button', { name: 'Save', exact: true })
    let following = tabsButtons ? submit : page.locator('#events pre[tabindex="0"]').first()
    assert.equal(await following.evaluate((node) => node === document.activeElement), true)
  })

  it('continues beside the non-modal Dialog declaration instead of the document footer', async (t) => {
    let { page } = await openDocs(t, 'dialog')
    let trigger = page
      .locator('#non-modal')
      .getByRole('button', { name: 'Open dialog', exact: true })
    await waitForDestination(page, '#non-modal button[aria-haspopup="dialog"]')
    await trigger.press('Enter')
    let dialog = page.getByRole('dialog', { name: 'Non-modal dialog', exact: true })
    await dialog.getByRole('button', { name: 'Close', exact: true }).press('Tab')
    let following = page
      .locator('#non-modal')
      .getByRole('button', { name: 'Show code', exact: true })
    assert.equal(await following.evaluate((node) => node === document.activeElement), true)
    assert.equal(await dialog.isVisible(), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(
      await dialog
        .getByRole('button', { name: 'Close', exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
    )
    await page.keyboard.press('Shift+Tab')
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
  })
})
