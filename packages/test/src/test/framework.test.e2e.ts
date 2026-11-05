import * as assert from '@remix-run/assert'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { fileURLToPath } from 'node:url'
import { startServer } from '../app/server.ts'
import { describe, it } from '../lib/framework.ts'

function html(body: string): Response {
  return new Response(
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<title>Test</title>',
      '</head>',
      '<body>',
      body,
      '</body>',
      '</html>',
    ].join(''),
    {
      headers: { 'Content-Type': 'text/html' },
    },
  )
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/html' },
  })
}

describe('e2e tests', () => {
  it('reports a blocked test window as a failed file and completes the run', async (t) => {
    let { server, baseUrl } = await startServer([
      fileURLToPath(new URL('./framework.test.browser.ts', import.meta.url)),
    ])
    let page = await t.serve({
      baseUrl,
      close() {
        return new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        })
      },
    })
    await page.addInitScript(() => {
      window.open = () => null
    })
    await page.route('**/file-results', (route) => route.fulfill({ status: 200 }))
    let report = page.waitForRequest('**/file-results')
    await page.goto('/?isolation=window')
    let results = (await report).postDataJSON()
    assert.equal(results.failed, 1)
    assert.equal(results.tests[0].error.message, 'Could not open the browser test window')
    await page.waitForFunction('window.__testsDone')
  })

  it('runs playwright against a fetch handler', async (t) => {
    let handler = (request: Request) => {
      let url = new URL(request.url)

      if (url.pathname === '/') {
        return html('<h1>Hello Remix</h1><a href="/about">About</a>')
      }

      if (url.pathname === '/about') {
        return html('<h1>About Remix</h1>')
      }

      return notFound()
    }

    let page = await t.serve(await createTestServer(handler))
    await page.goto('/')
    assert.equal(await page.locator('h1').textContent(), 'Hello Remix')
    await page.click('[href="/about"]')
    assert.equal(await page.locator('h1').textContent(), 'About Remix')
  })
})
