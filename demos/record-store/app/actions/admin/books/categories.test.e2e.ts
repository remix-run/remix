import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { createTestRouter } from '../../../../test/helpers.ts'

describe('admin book categories', () => {
  it('hydrates the category selector and saves a supported category', async (t) => {
    let router = await createTestRouter()
    let page = await t.serve(await createTestServer(router.fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.request.post('/login', {
      form: { email: 'admin@bookstore.com', password: 'admin123' },
    })
    await page.goto('/admin/books/2/edit')
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.ready()
    })

    let category = page.getByRole('combobox', { name: 'Category', exact: true })
    assert.equal(await category.inputValue(), 'art')
    assert.equal(await category.locator('option:not([disabled])').count(), 10)
    assert.equal(await category.locator('option:checked').textContent(), 'Arts, Music & Crafts')
    await category.selectOption('nonfiction')
    await page.getByRole('button', { name: 'Update Book', exact: true }).click()
    await page.getByRole('heading', { name: 'Manage Books', exact: true }).waitFor()
    let row = page.getByRole('row').filter({ hasText: 'Heavy Metal Guitar Riffs' })
    assert.equal(await row.getByRole('cell', { name: 'Nonfiction', exact: true }).count(), 1)
    assert.deepEqual(errors, [])
  })
})
