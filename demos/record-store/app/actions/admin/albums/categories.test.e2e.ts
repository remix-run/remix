import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { createTestRouter } from '../../../../test/helpers.ts'

describe('admin album categories', () => {
  it('hydrates the category selector and saves a supported category', async (t) => {
    let router = await createTestRouter()
    let page = await t.serve(await createTestServer(router.fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.request.post('/login', {
      form: { email: 'admin@recordstore.com', password: 'admin123' },
    })
    await page.goto('/admin/albums/2/edit')
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.ready()
    })

    let category = page.getByRole('combobox', { name: 'Category', exact: true })
    assert.equal(await category.inputValue(), 'rock')
    assert.equal(await category.locator('option:not([disabled])').count(), 8)
    assert.equal(await category.locator('option:checked').textContent(), 'Rock')
    await category.selectOption('pop')
    await page.getByRole('button', { name: 'Update Record', exact: true }).click()
    await page.getByRole('heading', { name: 'Manage Records', exact: true }).waitFor()
    let row = page.getByRole('row').filter({ hasText: 'Shred Till Dawn' })
    assert.equal(await row.getByRole('cell', { name: 'Pop', exact: true }).count(), 1)
    assert.deepEqual(errors, [])
  })
})
