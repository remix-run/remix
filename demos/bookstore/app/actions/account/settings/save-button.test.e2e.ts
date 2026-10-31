import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { type TestContext, describe, it } from 'remix/test'

import { createTestRouter } from '../../../../test/helpers.ts'
import { routes } from '../../../routes.ts'

const router = await createTestRouter()

describe('settings save button', () => {
  it('shows the save on its way until the next page renders', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveSettings(t, async (request) => {
      if (request.method !== 'POST') return
      received.resolve()
      await save.promise
    })

    await page.getByLabel('Name').fill('Jane Doe')
    await page.getByRole('button', { name: 'Update Settings' }).click()
    await received.promise
    await page.getByRole('button', { name: 'Saving…' }).waitFor()

    save.resolve()
    await page.getByRole('heading', { name: 'My Account' }).waitFor()
    await page.getByText('Jane Doe').waitFor()
  })

  it('follows a save submitted from the keyboard', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveSettings(t, async (request) => {
      if (request.method !== 'POST') return
      received.resolve()
      await save.promise
    })

    await page.getByLabel('Name').press('Enter')
    await received.promise
    await page.getByRole('button', { name: 'Saving…' }).waitFor()

    save.resolve()
    await page.getByRole('heading', { name: 'My Account' }).waitFor()
  })

  it('says when a save fails and keeps what the visitor typed', async (t) => {
    let page = await serveSettings(t, (request) => {
      if (request.method === 'POST') return new Response('Server error', { status: 500 })
    })

    await page.getByLabel('Name').fill('Jane Doe')
    await page.getByRole('button', { name: 'Update Settings' }).click()
    await page.getByRole('status').getByText('Couldn’t save your settings. Try again.').waitFor()
    await page.getByRole('button', { name: 'Update Settings' }).waitFor()
    assert.equal(await page.getByLabel('Name').inputValue(), 'Jane Doe')
  })

  it('keeps focus in the form when a save fails', async (t) => {
    let page = await serveSettings(t, (request) => {
      if (request.method === 'POST') return new Response('Server error', { status: 500 })
    })

    await page.getByLabel('Name').press('Enter')
    await page.getByRole('status').getByText('Couldn’t save your settings. Try again.').waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'name')
  })

  it('ignores navigations that other links start', async (t) => {
    let leave = Promise.withResolvers<void>()
    t.after(() => leave.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveSettings(t, async (request) => {
      if (new URL(request.url).pathname !== routes.account.index.href()) return
      received.resolve()
      await leave.promise
    })

    await page.getByRole('link', { name: 'Cancel' }).click()
    await received.promise
    assert.equal(await page.getByRole('button', { name: 'Saving…' }).count(), 0)
    await page.getByRole('button', { name: 'Update Settings' }).waitFor()

    leave.resolve()
    await page.getByRole('heading', { name: 'My Account' }).waitFor()
  })
})

/**
 * Serves the bookstore to a signed-in customer on the settings page. `intercept` sees each request
 * to the settings or account page first, and answers it when it returns a response.
 */
async function serveSettings(
  t: TestContext,
  intercept: (request: Request) => Promise<Response | void> | Response | void,
) {
  let page = await t.serve(
    await createTestServer(async (request) => {
      let { pathname } = new URL(request.url)
      if (
        pathname === routes.account.settings.index.href() ||
        pathname === routes.account.index.href()
      ) {
        let response = await intercept(request)
        if (response) return response
      }
      return router.fetch(request)
    }),
  )
  await page.request.post(routes.auth.login.action.href(), {
    form: { email: 'customer@example.com', password: 'password123' },
    maxRedirects: 0,
  })
  await page.goto(routes.account.settings.index.href())
  // The save button hydrates once its module loads, so a click before then would miss the save.
  await page.waitForLoadState('networkidle')
  return page
}
