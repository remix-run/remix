import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { router } from './router.ts'
import { assetServer } from './utils/assets.ts'

after(async () => {
  await assetServer.close()
})

async function getHomePage() {
  let response = await router.fetch(new Request('http://localhost/'))
  return { response, html: await response.text() }
}

function getAttribute(html: string, pattern: RegExp): string {
  let match = html.match(pattern)
  assert.ok(match, `Expected ${pattern} to match the home page`)
  return match[1].replaceAll('&amp;', '&')
}

describe('assets demo', () => {
  it('renders the home page with its script, stylesheet, and import map', async () => {
    let { response, html } = await getHomePage()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8')
    assert.match(html, /<h1>remix\/assets watch mode<\/h1>/)
    assert.match(html, /<link rel="stylesheet" href="\/assets\/app\/actions\/public\/styles\//)
    assert.match(html, /<script type="importmap">\{/)
    assert.match(html, /<script type="module" src="\/assets\/app\/actions\/public\/entry\./)
  })

  it('serves the compiled client entry as JavaScript', async () => {
    let { html } = await getHomePage()
    let entryHref = getAttribute(html, /<script type="module" src="([^"]+)"/)

    let response = await router.fetch(new Request(`http://localhost${entryHref}`))
    let body = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /javascript/)
    assert.match(body, /getElementById\("app-root"\)/)
    assert.doesNotMatch(body, /: HTMLElement/)
  })

  it('serves the SVG with the recolor transform applied', async () => {
    let { html } = await getHomePage()
    let imageHref = getAttribute(html, /<img[^>]+src="([^"]+)"[^>]+alt="Purple transformed/)

    let response = await router.fetch(new Request(`http://localhost${imageHref}`))
    let body = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /image\/svg\+xml/)
    assert.match(body, /#8B5CF6/i)
    assert.doesNotMatch(body, /currentColor/)
  })

  it('does not serve files outside the browser-source allowlist', async () => {
    let response = await router.fetch(
      new Request('http://localhost/assets/app/actions/controller.ts'),
    )

    assert.equal(response.status, 404)
  })
})
