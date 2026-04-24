import assert from '@remix-run/assert'
import type { RemixNode } from '@remix-run/component/jsx-runtime'
import { renderToString } from '@remix-run/component/server'
import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { describe, it } from '../lib/framework.ts'

const html = async (n: RemixNode) =>
  new Response(await renderToString(n), {
    headers: { 'Content-Type': 'text/html' },
  })

describe('e2e tests', () => {
  it('runs playwright against a fetch-router instance', async (t) => {
    function Doc() {
      return ({ children }: { children: RemixNode }) => (
        <html>
          <head>
            <title>Test</title>
          </head>
          <body>{children}</body>
        </html>
      )
    }

    let routes = route({ home: '/', about: '/about' })
    let router = createRouter()
    router.get(routes.home, async () =>
      html(
        <Doc>
          <h1>Hello Remix</h1>
          <a href="/about">About</a>
        </Doc>,
      ),
    )
    router.get(routes.about, async () =>
      html(
        <Doc>
          <h1>About Remix</h1>
        </Doc>,
      ),
    )

    let page = await t.serve(router.fetch)
    await page.goto('/')
    assert.equal(await page.locator('h1').textContent(), 'Hello Remix')
    await page.click('[href="/about"]')
    assert.equal(await page.locator('h1').textContent(), 'About Remix')
  })
})
