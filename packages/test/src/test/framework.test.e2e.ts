import * as assert from '@remix-run/assert'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import { fileURLToPath } from 'node:url'
import { startServer } from '../app/server.ts'
import type { TestContext } from '../lib/context.ts'
import { describe, it } from '../lib/framework.ts'
import type { TestResults } from '../lib/reporters/results.ts'

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
  it('reports a blocked browser test window as a failed file', async (t) => {
    let page = await serveBrowserTestFiles(t, ['./framework.test.browser.ts'])
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

  it('isolates session storage and history between test windows', async (t) => {
    let page = await serveBrowserTestFiles(t, [
      './window-first.test.browser.ts',
      './window-second.test.browser.ts',
    ])
    await page.context().route('**/window-first.test.browser.ts', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `
          import { it } from '../lib/framework.ts'
          it('updates storage and history', () => {
            if (window.parent !== window) throw new Error('Expected a top-level window')
            sessionStorage.setItem('message', 'from the first file')
            history.pushState(null, '', '?first-file-entry')
          })
        `,
      }),
    )
    await page.context().route('**/window-second.test.browser.ts', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `
          import { it } from '../lib/framework.ts'
          it('starts with independent storage and history', () => {
            if (sessionStorage.getItem('message') !== null) {
              throw new Error('Unexpected storage from the first file')
            }
            if (history.length !== 1) throw new Error('Expected fresh history')
          })
        `,
      }),
    )
    let results: TestResults[] = []
    let closedWindows: Array<Promise<unknown>> = []
    page.on('popup', (popup) => closedWindows.push(popup.waitForEvent('close')))
    await page.route('**/file-results', (route) => {
      results.push(route.request().postDataJSON())
      return route.fulfill({ status: 200 })
    })
    await page.goto('/?isolation=window')
    await page.waitForFunction('window.__testsDone')
    assert.equal(results.length, 2)
    for (let { passed, failed, tests } of results) {
      assert.equal(failed, 0, tests.find((test) => test.status === 'failed')?.error?.message)
      assert.equal(passed, 1)
    }
    assert.equal(closedWindows.length, 2)
    await Promise.all(closedWindows)
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

async function serveBrowserTestFiles(t: TestContext, files: string[]) {
  let { server, baseUrl } = await startServer(
    files.map((file) => fileURLToPath(new URL(file, import.meta.url))),
  )
  return await t.serve({
    baseUrl,
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  })
}
