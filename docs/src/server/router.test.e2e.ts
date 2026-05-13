import { createTestServer } from 'remix/node-fetch-server/test'
import * as assert from 'remix/assert'
import { describe, it, type TestContext } from 'remix/test'

import { createRouter, getDefaultVersions } from './router.tsx'

const router = createRouter(getDefaultVersions())

async function visit(t: TestContext, urlPath: string) {
  let page = await t.serve(await createTestServer(router.fetch))
  let response = await page.goto(urlPath)
  assert.ok(response, `${urlPath} returned no response`)
  assert.equal(response.status(), 200, `${urlPath} status`)
  return page
}

// Disabling for now since these tests require that the docs have been built
// which isn't always the case in CI flows
describe.skip('docs site e2e', () => {
  describe('home', () => {
    it('renders the welcome page', async (t) => {
      let page = await visit(t, '/')
      await assert.equal(await page.locator('h1').first().textContent(), 'Welcome to Remix 3!')
      await assert.ok(
        await page.getByText('Model-First Development').isVisible(),
        'principle list rendered',
      )
    })
  })

  describe('top-level package overview pages', () => {
    it('renders remix/assert', async (t) => {
      let page = await visit(t, '/api/remix/assert/overview/')
      await assert.ok(await page.getByText('remix/assert', { exact: false }).first().isVisible())
    })

    it('renders remix/cookie', async (t) => {
      let page = await visit(t, '/api/remix/cookie/overview/')
      await assert.ok(await page.getByText('remix/cookie', { exact: false }).first().isVisible())
    })

    it('renders remix/fetch-router', async (t) => {
      let page = await visit(t, '/api/remix/fetch-router/overview/')
      await assert.ok(
        await page.getByText('remix/fetch-router', { exact: false }).first().isVisible(),
      )
    })
  })

  describe('subpackage overview pages', () => {
    it('renders remix/ui/button', async (t) => {
      let page = await visit(t, '/api/remix/ui/button/overview/')
      await assert.ok(await page.getByText('remix/ui/button', { exact: false }).first().isVisible())
    })

    it('renders remix/data-table-mysql', async (t) => {
      let page = await visit(t, '/api/remix/data-table-mysql/overview/')
      await assert.ok(
        await page.getByText('remix/data-table-mysql', { exact: false }).first().isVisible(),
      )
    })
  })

  describe('api pages', () => {
    it('renders a Type page', async (t) => {
      let page = await visit(t, '/api/remix/ui/button/type/ButtonProps/')
      await assert.equal(await page.locator('main h1').first().textContent(), 'ButtonProps')
    })

    it('renders an Interface page', async (t) => {
      let page = await visit(t, '/api/remix/assert/interface/Expectation/')
      await assert.equal(await page.locator('main h1').first().textContent(), 'Expectation')
    })

    it('renders a Class page', async (t) => {
      let page = await visit(t, '/api/remix/assert/class/AssertionError/')
      await assert.equal(await page.locator('main h1').first().textContent(), 'AssertionError')
    })

    it('renders a Function page', async (t) => {
      let page = await visit(t, '/api/remix/assert/function/assert/')
      await assert.equal(await page.locator('main h1').first().textContent(), 'assert')
    })

    it('renders a Variable page', async (t) => {
      let page = await visit(t, '/api/remix/fetch-router/variable/RequestMethods/')
      await assert.equal(await page.locator('main h1').first().textContent(), 'RequestMethods')
    })

    it('renders a Mixin page', async (t) => {
      let page = await visit(t, '/api/remix/ui/button/mixin/baseStyle/')
      await assert.equal(await page.locator('main h1').first().textContent(), 'baseStyle')
    })
  })

  describe('demos', () => {
    it('renders the button basic demo with rendered preview + source', async (t) => {
      let page = await visit(t, '/api/remix/ui/button/demos/basic/')
      await assert.equal(await page.locator('main h1').first().textContent(), 'Basic Button')

      // Rendered live preview: the demo's <button> with "Publish" label.
      await assert.ok(
        await page.getByRole('button', { name: 'Publish' }).isVisible(),
        'live demo button rendered',
      )

      // The displayed source listing rewrites @remix-run/* → remix/* and
      // strips the JSDoc metadata block.
      let html = await page.content()
      assert.ok(html.includes('buttonRowCss'), 'source listing rendered')
      assert.ok(!html.includes('@remix-run/ui'), 'source did not leak @remix-run/*')
      assert.ok(!html.includes('@name'), 'JSDoc @name tag stripped from source')
    })
  })

  describe('not found', () => {
    it('renders a not-found shell for unknown slugs', async (t) => {
      let page = await t.serve(await createTestServer(router.fetch))
      let urlPath = '/api/remix/this/does/not/exist/'
      let response = await page.goto(urlPath)
      assert.ok(response, `${urlPath} returned no response`)
      assert.equal(response.status(), 404, `${urlPath} status`)
      await assert.ok(await page.getByText('Could not find a document at').isVisible())
    })
  })
})
