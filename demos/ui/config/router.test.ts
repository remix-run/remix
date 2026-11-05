import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.tsx'

describe('ui demos', () => {
  it('lists component and ui demos on the index page', async () => {
    let response = await router.fetch(new Request('http://localhost/'))
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/html/)
    assert.match(html, /<title>Remix UI Demos<\/title>/)
    assert.match(html, /href="\/demo\/ui\/tabs\.demo\.tsx"/)
    assert.match(html, /href="\/demo\/component\/lib\/demos\/basic\.demo\.tsx"/)
    assert.match(html, /href="\/demo\/component\/cases\/drummer\/drummer\.demo\.tsx"/)
  })

  it('renders a ui primitive demo page', async () => {
    let response = await router.fetch(new Request('http://localhost/demo/ui/tabs.demo.tsx'))
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /<title>Tabs Primitives \| Remix Interface Demo<\/title>/)
    assert.match(html, /role="tablist"/)
    assert.match(html, /"moduleUrl":"\/assets\/demos\/ui\/tabs\.js\?v=/)
  })

  it('returns 404 for an unknown demo', async () => {
    let response = await router.fetch(new Request('http://localhost/demo/ui/missing.demo.tsx'))

    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Demo not found')
  })

  it('returns 404 for demo paths that escape the demo roots', async () => {
    let response = await router.fetch(
      new Request('http://localhost/demo/ui/..%2F..%2Fpackage.demo.tsx'),
    )

    assert.equal(response.status, 404)
  })
})
