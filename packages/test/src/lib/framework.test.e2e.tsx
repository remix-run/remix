import * as assert from '@remix-run/assert'
import { renderToString } from '@remix-run/component/server'
import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { describe, it } from './framework.ts'

describe('automatic e2e', () => {
  it('runs playwright against a fetch-router instance', async (t) => {
    function App() {
      return () => (
        <html>
          <head>
            <title>Test</title>
          </head>
          <body>
            <h1>Hello Remix</h1>
          </body>
        </html>
      )
    }

    let routes = route({ home: '/' })
    let router = createRouter()
    router.get(
      routes.home,
      async () =>
        new Response(await renderToString(<App />), {
          headers: { 'Content-Type': 'text/html' },
        }),
    )

    let page = await t.serve(router.fetch)
    await page.goto('/')
    assert.equal(await page.innerHTML('body'), '<h1>Hello Remix</h1>')
  })
})
