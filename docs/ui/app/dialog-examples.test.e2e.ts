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
  page.setDefaultTimeout(5000)
  await page.goto('/patterns/dialog/')
  return page
}

describe('Dialog docs interactions', () => {
  it('prevents Escape and outside dismissal without blocking the close button', async (t) => {
    let page = await openDocs(t)
    let trigger = page
      .locator('#unsaved-changes-example')
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
})
