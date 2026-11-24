import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'
import { router } from './router.ts'

async function openDocs(t: TestContext) {
  let previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  })
  let page = await t.serve(await createTestServer(router.fetch))
  await page.goto('/patterns/dialog/')
  await page.locator('html[data-test-hydrated]').waitFor({ state: 'attached' })
  return page
}

describe('Dialog docs interactions', () => {
  it('dismisses the portaled Select before its dialog with keyboard and outside clicks', async (t) => {
    let page = await openDocs(t)
    let opener = page.locator('#stacking-example').getByRole('button', { name: 'Open dialog' })
    await opener.click()
    let dialog = page.getByRole('dialog', { name: 'Dialog with other patterns', exact: true })
    let trigger = dialog.getByRole('button', { name: 'Select', exact: true })
    await trigger.press('ArrowDown')
    let list = page.getByRole('listbox', { name: 'Select', exact: true })
    await list.waitFor({ state: 'visible' })
    assert.equal(await list.evaluate((node) => node === document.activeElement), true)
    await list.press('Escape')
    await list.waitFor({ state: 'hidden' })
    assert.equal(await dialog.isVisible(), true)
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    await trigger.click()
    await list.waitFor({ state: 'visible' })
    await page.mouse.click(8, 100)
    await list.waitFor({ state: 'hidden' })
    assert.equal(await dialog.isVisible(), true)
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    await page.mouse.click(8, 100)
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await opener.evaluate((node) => node === document.activeElement), true)
  })

  it('filters and selects Combobox options without dismissing the dialog', async (t) => {
    let page = await openDocs(t)
    await page.locator('#stacking-example').getByRole('button', { name: 'Open dialog' }).click()
    let dialog = page.getByRole('dialog', { name: 'Dialog with other patterns', exact: true })
    let input = dialog.getByRole('combobox', { name: 'Combobox', exact: true })
    await input.fill('Option B')
    let list = page.getByRole('listbox', { name: 'Combobox options', exact: true })
    await list.waitFor({ state: 'visible' })
    assert.equal(await list.getByRole('option').count(), 1)
    await input.press('ArrowDown')
    await input.press('Enter')
    await list.waitFor({ state: 'hidden' })
    assert.equal(await input.inputValue(), 'Option B')
    assert.equal(await input.evaluate((node) => node === document.activeElement), true)
    assert.equal(await dialog.isVisible(), true)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  })

  it('opens a submenu and dismisses the menus on selection while keeping the dialog open', async (t) => {
    let page = await openDocs(t)
    await page.locator('#stacking-example').getByRole('button', { name: 'Open dialog' }).click()
    let dialog = page.getByRole('dialog', { name: 'Dialog with other patterns', exact: true })
    let trigger = dialog.getByRole('button', { name: 'Menu', exact: true })
    await trigger.press('ArrowDown')
    let menu = page.getByRole('menu', { name: 'Menu', exact: true })
    await menu.waitFor({ state: 'visible' })
    await menu.press('ArrowDown')
    await menu.press('ArrowRight')
    let submenu = page.getByRole('menu', { name: 'Submenu', exact: true })
    await submenu.waitFor({ state: 'visible' })
    assert.equal(
      await submenu
        .getByRole('menuitem', { name: 'Action B', exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
    )
    await submenu.getByRole('menuitem', { name: 'Action B', exact: true }).click()
    await menu.waitFor({ state: 'hidden' })
    await submenu.waitFor({ state: 'hidden' })
    assert.equal(await dialog.isVisible(), true)
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  })

  it('dismisses the nested Select, then its Popover, then the dialog', async (t) => {
    let page = await openDocs(t)
    let opener = page.locator('#stacking-example').getByRole('button', { name: 'Open dialog' })
    await opener.click()
    let dialog = page.getByRole('dialog', { name: 'Dialog with other patterns', exact: true })
    let trigger = dialog.getByRole('button', { name: 'Popover', exact: true })
    await trigger.click()
    let popover = page.getByRole('dialog', { name: 'Popover', exact: true })
    let select = popover.getByRole('button', { name: 'Nested Select', exact: true })
    assert.equal(await select.evaluate((node) => node === document.activeElement), true)
    await page.keyboard.press('ArrowDown')
    let list = page.getByRole('listbox', { name: 'Nested Select', exact: true })
    await list.waitFor({ state: 'visible' })
    await list.press('Escape')
    await list.waitFor({ state: 'hidden' })
    assert.equal(await popover.isVisible(), true)
    assert.equal(await select.evaluate((node) => node === document.activeElement), true)
    await select.press('Escape')
    await popover.waitFor({ state: 'hidden' })
    assert.equal(await dialog.isVisible(), true)
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    await trigger.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await opener.evaluate((node) => node === document.activeElement), true)
  })

  it('keeps global notifications interactive above a nested dialog and returns focus to its parent', async (t) => {
    let page = await openDocs(t)
    await page.locator('#stacking-example').getByRole('button', { name: 'Open dialog' }).click()
    let dialog = page.getByRole('dialog', { name: 'Dialog with other patterns', exact: true })
    await dialog.getByRole('button', { name: 'Toast', exact: true }).click()
    let viewport = page.getByRole('region', { name: 'Notifications', exact: true })
    await viewport.getByText('Action completed', { exact: true }).waitFor()
    let trigger = dialog.getByRole('button', { name: 'Nested dialog', exact: true })
    await trigger.click()
    let nested = page.getByRole('dialog', { name: 'Nested dialog', exact: true })
    let close = nested.getByRole('button', { name: 'Close', exact: true })
    await close.press('F6')
    assert.equal(await viewport.evaluate((node) => node === document.activeElement), true)
    await page.keyboard.press('F6')
    assert.equal(await close.evaluate((node) => node === document.activeElement), true)
    await viewport
      .getByRole('button', { name: 'Dismiss notification', exact: true, includeHidden: true })
      .click()
    await viewport.getByText('Action completed', { exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await nested.isVisible(), true)
    await close.click()
    await nested.waitFor({ state: 'hidden' })
    assert.equal(await dialog.isVisible(), true)
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  })

  it('prevents Escape and outside dismissal without blocking the close button', async (t) => {
    let page = await openDocs(t)
    let trigger = page
      .locator('#preventing-dismissal-example')
      .getByRole('button', { name: 'Open dialog' })
    await trigger.click()
    let popup = page.getByRole('dialog', { name: 'Preventing dismissal', exact: true })
    await popup.getByRole('button', { name: 'Close', exact: true }).press('Escape')
    assert.equal(await popup.isVisible(), true)
    await page.mouse.click(8, 100)
    assert.equal(await popup.isVisible(), true)
    await popup.getByRole('button', { name: 'Close', exact: true }).click()
    await popup.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
  })

  it('allows non-modal page interaction and cycles Tab inside the focus-only panel', async (t) => {
    let page = await openDocs(t)
    let example = page.locator('#non-modal-example')
    await example.getByRole('button', { name: 'Open dialog' }).click()
    let nonModal = page.getByRole('dialog', { name: 'Non-modal dialog', exact: true })
    await example.getByRole('button', { name: 'Show code', exact: true }).click()
    assert.equal(await nonModal.isVisible(), true)
    await nonModal.getByRole('button', { name: 'Close', exact: true }).click()
    await nonModal.waitFor({ state: 'hidden' })
    await page.locator('#trap-focus-example').getByRole('button', { name: 'Open dialog' }).click()
    let notes = page.getByRole('dialog', { name: 'Dialog with trapped focus', exact: true })
    let close = notes.getByRole('button', { name: 'Close', exact: true })
    await close.press('Tab')
    assert.equal(await notes.evaluate((node) => node.contains(document.activeElement)), true)
    await page.keyboard.press('Tab')
    assert.equal(await notes.evaluate((node) => node.contains(document.activeElement)), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await notes.evaluate((node) => node.contains(document.activeElement)), true)
    assert.equal(
      await page
        .locator('#trap-focus-example .docs-demo-preview')
        .evaluate((node) => node.closest('[inert]') === null),
      true,
    )
    await notes.getByRole('button', { name: 'Close', exact: true }).click()
  })

  it('keeps notification actions above the dialog and clickable without dismissing it', async (t) => {
    let page = await openDocs(t)
    let trigger = page
      .locator('#stacking-example')
      .getByRole('button', { name: 'Open dialog', includeHidden: true })
    await trigger.click()
    let popup = page.getByRole('dialog', { name: 'Dialog with other patterns', exact: true })
    let publish = popup.getByRole('button', { name: 'Toast' })
    await publish.click()
    let viewport = page.getByRole('region', { name: 'Notifications', exact: true })
    await viewport.getByText('Action completed', { exact: true }).waitFor()
    await viewport.evaluate(async (node) => {
      await Promise.all(
        node.getAnimations({ subtree: true }).map((animation) => animation.finished),
      )
    })
    assert.equal(await viewport.evaluate((node) => node.closest('[inert]') === null), true)
    assert.equal(await trigger.evaluate((node) => Boolean(node.closest('[inert]'))), true)
    assert.equal(
      await viewport.evaluate((node) => {
        let rect = node.getBoundingClientRect()
        return node.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        )
      }),
      true,
    )
    await viewport
      .getByRole('button', { name: 'Dismiss notification', exact: true, includeHidden: true })
      .click()
    assert.equal(await popup.isVisible(), true)
    await publish.press('Escape')
    await popup.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
  })

  it('keeps a notification available after closing and reopening its dialog', async (t) => {
    let page = await openDocs(t)
    let trigger = page.locator('#stacking-example').getByRole('button', { name: 'Open dialog' })
    await trigger.click()
    let popup = page.getByRole('dialog', { name: 'Dialog with other patterns', exact: true })
    await popup.getByRole('button', { name: 'Toast' }).click()
    await popup.getByRole('button', { name: 'Close', exact: true }).click()
    await popup.waitFor({ state: 'hidden' })
    let viewport = page.getByRole('region', { name: 'Notifications', exact: true })
    await viewport.getByText('Action completed', { exact: true }).waitFor()
    await trigger.click()
    await popup.getByRole('button', { name: 'Toast' }).press('F6')
    assert.equal(await viewport.evaluate((node) => node === document.activeElement), true)
    await viewport
      .getByRole('button', { name: 'Dismiss notification', exact: true, includeHidden: true })
      .click()
    assert.equal(await popup.isVisible(), true)
    await popup.getByRole('button', { name: 'Close', exact: true }).click()
  })
})
