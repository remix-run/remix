import * as assert from 'node:assert/strict'
import type { RemixNode } from '@remix-run/ui/jsx-runtime'
import { renderToString } from '@remix-run/ui/server'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { describe, it } from '../lib/framework.ts'
import type { Handle } from '../../../ui/src/runtime/component.ts'

const html = async (n: RemixNode) =>
  new Response(await renderToString(n), {
    headers: { 'Content-Type': 'text/html' },
  })

describe('e2e tests', () => {
  it('runs playwright against a fetch handler', async (t) => {
    function Doc(handle: Handle<{ children?: RemixNode }>) {
      return () => (
        <html>
          <head>
            <title>Test</title>
          </head>
          <body>{handle.props.children}</body>
        </html>
      )
    }

    let handler = (request: Request) => {
      let url = new URL(request.url)

      if (url.pathname === '/') {
        return html(
          <Doc>
            <h1>Hello Remix</h1>
            <a href="/about">About</a>
          </Doc>,
        )
      }

      if (url.pathname === '/about') {
        return html(
          <Doc>
            <h1>About Remix</h1>
          </Doc>,
        )
      }

      return new Response('Not found', { status: 404 })
    }

    let page = await t.serve(await createTestServer(handler))
    await page.goto('/')
    assert.equal(await page.locator('h1').textContent(), 'Hello Remix')
    await page.click('[href="/about"]')
    assert.equal(await page.locator('h1').textContent(), 'About Remix')
  })
})
