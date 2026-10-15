import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import { router } from './router.ts'

describe('Live examples in the docs site', () => {
  it('hydrates examples with working pointer interaction, keyboard dismissal and focus restoration', async (t) => {
    // Development mode leaves search disabled until its generated assets exist.
    let nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    t.after(() => {
      if (nodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = nodeEnv
    })
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${message.location().url} ${message.text()}`)
    })

    await page.goto('/patterns/accordion/')
    let hero = page.locator('#basic .ui-demo-preview')
    let billing = hero.getByRole('button', { name: 'Billing', exact: true })
    await billing.click()
    await hero.locator('button[aria-expanded="true"]').filter({ hasText: 'Billing' }).waitFor()
    assert.equal(
      await hero
        .getByRole('button', { name: 'Shipping', exact: true })
        .getAttribute('aria-expanded'),
      'false',
    )

    await page.goto('/patterns/popover/')
    let popover = page.locator('#basic .ui-demo-preview')
    let trigger = popover.getByRole('button', { name: 'Filter pull requests' })
    await trigger.click()
    let dialog = popover.getByRole('dialog', { name: 'Filter pull requests' })
    await dialog.waitFor()
    let open = dialog.getByRole('checkbox', { name: 'Open', exact: true })
    await dialog.locator('input[value="open"]:focus').waitFor()
    await open.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    await popover.locator('button[aria-label="Filter pull requests"]:focus').waitFor()
    assert.deepEqual(errors, [], errors.join('\n'))
  })
})
