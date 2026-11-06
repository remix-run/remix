import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'

const router = await createTestRouter()

describe('speed techniques', () => {
  it('prefetches a page on hover and swaps only the content frame on click', async (t) => {
    let familyRequests: Request[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === '/products/gears/spur-gears') {
          familyRequests.push(request)
        }
        return router.fetch(request)
      }),
    )

    await page.goto('/')
    await waitForNavigationRuntime(page)
    await page.locator('header').evaluate((header) => header.setAttribute('data-test-marker', ''))

    let link = page.locator('main').getByRole('link', { name: 'Spur Gears', exact: true })
    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/products/gears/spur-gears',
    )
    await link.hover()
    await (await prefetched).finished()
    await link.click()

    await page.getByRole('heading', { level: 1, name: 'Spur Gears' }).waitFor()
    await page.waitForFunction(() => document.title === 'Spur Gears | Remix Supply')
    assert.equal(new URL(page.url()).pathname, '/products/gears/spur-gears')
    assert.equal(familyRequests.length, 1)
    assert.equal(familyRequests[0].headers.get('X-Remix-Target'), 'content')
    // The header was not re-rendered, so the marker added before navigating is still there.
    assert.equal(await page.locator('header[data-test-marker]').count(), 1)
  })

  it('filters a family without a full page load', async (t) => {
    let documentRequests: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        if (isDocumentRequest(request)) documentRequests.push(new URL(request.url).pathname)
        return router.fetch(request)
      }),
    )

    await page.goto('/products/gears/spur-gears')
    await waitForNavigationRuntime(page)
    await page
      .getByRole('complementary', { name: 'Filters' })
      .getByRole('link', { name: /^Brass/ })
      .click()

    await page.getByRole('heading', { level: 2, name: 'Brass Spur Gears' }).waitFor()
    await page.getByText('2,880 of 23,040 parts').waitFor()
    assert.equal(new URL(page.url()).search, '?material-and-style=brass')
    assert.deepEqual(documentRequests, ['/products/gears/spur-gears'])
  })

  it('adds a part to the order without leaving the page', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))

    await page.goto('/parts/1000A001')
    await waitForNavigationRuntime(page)
    await page.getByLabel('Quantity').fill('2')
    await page.getByRole('button', { name: 'Add to order' }).click()

    await page.getByText('Added 2 to your order.').waitFor()
    await page.locator('header').getByText('2 items').waitFor()
    assert.equal(new URL(page.url()).pathname, '/parts/1000A001')
  })

  it('loads full documents without prefetching when the techniques are turned off', async (t) => {
    let documentRequests: string[] = []
    let frameRequests: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let pathname = new URL(request.url).pathname
        if (request.headers.get('X-Remix-Frame') === 'true') frameRequests.push(pathname)
        if (isDocumentRequest(request)) documentRequests.push(pathname)
        return router.fetch(request)
      }),
    )

    await page.goto('/')
    await waitForNavigationRuntime(page)
    await page.getByLabel('Off').check()
    await page.getByRole('button', { name: 'Apply' }).click()
    await page.waitForFunction(() => document.documentElement.dataset.speedTechniques === 'off')

    let link = page.locator('main').getByRole('link', { name: 'Spur Gears', exact: true })
    await link.hover()
    await link.click()
    await page.getByRole('heading', { level: 1, name: 'Spur Gears' }).waitFor()

    assert.deepEqual(frameRequests, [])
    assert.deepEqual(documentRequests, ['/', '/', '/products/gears/spur-gears'])
  })
})

function isDocumentRequest(request: Request): boolean {
  return (
    request.method === 'GET' &&
    request.headers.get('X-Remix-Frame') == null &&
    request.headers.get('Accept')?.includes('text/html') === true
  )
}

async function waitForNavigationRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    let state = window.navigation?.currentEntry?.getState()
    return typeof state === 'object' && state != null && '$rmx' in state
  })
}
