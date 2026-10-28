import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { staticFiles } from 'remix/middleware/static'
import { createRouter } from 'remix/router'

import { publicDirectory, router } from '../router.ts'
import { serveAgentGuide } from './agent-response.ts'

const origin = 'http://shopify-demo.local'

describe('agent content', () => {
  it('serves the original discovery files without rendering or changing their links', async () => {
    for (let filename of ['llms.txt', 'llms-full.txt', 'agents.md']) {
      let response = await router.fetch(new Request(`${origin}/${filename}`))
      assert.equal(response.status, 200, filename)
      assert.match(response.headers.get('Content-Type') ?? '', /text\/(plain|markdown)/)
      assert.equal(
        await response.text(),
        await readFile(path.join(publicDirectory, filename), 'utf8'),
      )
    }
  })

  it('serves the static agent guide when the homepage request prefers Markdown', async () => {
    let response = await router.fetch(
      new Request(`${origin}/?from=agent`, { headers: { Accept: 'text/markdown' } }),
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/markdown; charset=utf-8')
    assert.match(response.headers.get('Vary') ?? '', /accept/i)
    assert.equal(
      await response.text(),
      await readFile(path.join(publicDirectory, 'agents.md'), 'utf8'),
    )

    let preferred = await router.fetch(
      new Request(origin, { headers: { Accept: 'text/html;q=0.5, text/markdown' } }),
    )
    assert.match(preferred.headers.get('Content-Type') ?? '', /text\/markdown/)
  })

  it('keeps HTML for browsers, wildcard accepts, and excluded or lower-ranked Markdown', async () => {
    for (let accept of [
      '',
      '*/*',
      'text/*',
      'text/markdown;q=0, */*',
      'text/html, text/markdown;q=0.5',
    ]) {
      let response = await router.fetch(new Request(origin, { headers: { Accept: accept } }))
      assert.equal(response.status, 200, accept)
      assert.match(response.headers.get('Content-Type') ?? '', /text\/html/, accept)
      assert.match(response.headers.get('Vary') ?? '', /accept/i)
      assert.match(await response.text(), /^<!doctype html>/i)
    }
  })

  it('uses wildcard weights without overriding a more specific exclusion', async () => {
    for (let accept of ['text/html;q=0, text/*', 'text/html;q=0, */*']) {
      let response = await router.fetch(new Request(origin, { headers: { Accept: accept } }))
      assert.equal(response.status, 200, accept)
      assert.match(response.headers.get('Content-Type') ?? '', /text\/markdown/, accept)
    }

    let html = await router.fetch(
      new Request(origin, { headers: { Accept: 'text/markdown;q=0, text/*;q=0.5, */*' } }),
    )
    assert.match(html.headers.get('Content-Type') ?? '', /text\/html/)
  })

  it('keeps conditional requests and bodyless HEAD responses for the Markdown representation', async () => {
    let response = await router.fetch(new Request(origin, { headers: { Accept: 'text/markdown' } }))
    let etag = response.headers.get('ETag')
    assert.ok(etag)
    let cached = await router.fetch(
      new Request(origin, { headers: { Accept: 'text/markdown', 'If-None-Match': etag } }),
    )
    assert.equal(cached.status, 304)
    assert.match(cached.headers.get('Vary') ?? '', /accept/i)
    assert.equal(await cached.text(), '')

    let head = await router.fetch(
      new Request(origin, { method: 'HEAD', headers: { Accept: 'text/markdown' } }),
    )
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('Content-Type'), response.headers.get('Content-Type'))
    assert.equal(await head.text(), '')
  })

  it('preserves methods and missing pages instead of returning the guide for every request', async () => {
    let post = await router.fetch(
      new Request(origin, { method: 'POST', headers: { Accept: 'text/markdown' } }),
    )
    assert.equal(post.status, 405)
    let missing = await router.fetch(
      new Request(`${origin}/missing`, { headers: { Accept: 'text/markdown' } }),
    )
    assert.equal(missing.status, 404)
  })

  it('negotiates the homepage over a static file server for the preview and Worker', async () => {
    let assets = createRouter({ middleware: [staticFiles(publicDirectory)] })
    function fetchAsset(request: Request) {
      if (new URL(request.url).pathname !== '/') return assets.fetch(request)
      return new Response('<!doctype html>', {
        headers: { 'Content-Type': 'text/html', Vary: 'Accept-Encoding' },
      })
    }

    let markdown = await serveAgentGuide(
      new Request(`${origin}/?from=agent`, { headers: { Accept: 'text/markdown' } }),
      fetchAsset,
    )
    assert.equal(markdown.headers.get('Content-Type'), 'text/markdown; charset=utf-8')
    assert.equal(
      await markdown.text(),
      await readFile(path.join(publicDirectory, 'agents.md'), 'utf8'),
    )

    let html = await serveAgentGuide(new Request(origin), fetchAsset)
    assert.match(html.headers.get('Content-Type') ?? '', /text\/html/)
    assert.equal(html.headers.get('Vary'), 'accept-encoding, accept')

    let asset = await serveAgentGuide(
      new Request(`${origin}/llms.txt`, { headers: { Accept: 'text/markdown' } }),
      fetchAsset,
    )
    assert.equal(asset.headers.get('Vary'), null)
  })
})
