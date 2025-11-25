import * as assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import {
  installFetchMock,
  restoreFetchMock,
  addFetchHandler,
  createNpmRegistryMock,
} from '../test/mock-fetch.ts'
import { router } from './router.ts'

before(() => {
  installFetchMock()
  addFetchHandler(
    createNpmRegistryMock({
      'is-number': {
        metadata: 'is-number-metadata.json',
        tarballs: {
          '7.0.0': 'is-number-7.0.0.tgz',
        },
      },
    }),
  )
})

after(() => {
  restoreFetchMock()
})

describe('router', () => {
  describe('home page', () => {
    it('returns 200', async () => {
      let response = await router.fetch(new Request('http://localhost/'))

      assert.equal(response.status, 200)
    })

    it('returns HTML content', async () => {
      let response = await router.fetch(new Request('http://localhost/'))
      let text = await response.text()

      assert.ok(response.headers.get('Content-Type')?.startsWith('text/html'))
      assert.ok(text.includes('<html'))
      assert.ok(text.includes('UNPKG'))
    })

    it('includes example links', async () => {
      let response = await router.fetch(new Request('http://localhost/'))
      let text = await response.text()

      assert.ok(text.includes('@remix-run/cookie'))
      assert.ok(text.includes('/react'))
    })
  })

  describe('browse route', () => {
    it('returns 404 for invalid package path', async () => {
      // A path like "@@invalid" is not a valid npm package name
      let response = await router.fetch(new Request('http://localhost/@@invalid'))
      let text = await response.text()

      assert.equal(response.status, 404)
      assert.ok(text.includes('Invalid path'))
    })

    it('returns 404 for non-existent package', async () => {
      let response = await router.fetch(new Request('http://localhost/non-existent-package'))
      let text = await response.text()

      assert.equal(response.status, 404)
      assert.ok(text.includes('not found'))
    })

    it('returns package directory listing for valid package', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@7.0.0'))
      let text = await response.text()

      assert.equal(response.status, 200)
      assert.ok(text.includes('is-number'))
      assert.ok(text.includes('package.json'))
    })

    it('returns file content for valid file path', async () => {
      let response = await router.fetch(
        new Request('http://localhost/is-number@7.0.0/package.json'),
      )
      let text = await response.text()

      assert.equal(response.status, 200)
      // Content is HTML-escaped, so "name" becomes &quot;name&quot;
      assert.ok(text.includes('&quot;name&quot;'))
      assert.ok(text.includes('is-number'))
    })

    it('shows index.js in package root', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@7.0.0'))
      let text = await response.text()

      assert.equal(response.status, 200)
      assert.ok(text.includes('index.js'))
    })
  })

  describe('POST requests', () => {
    it('returns 404 for non-GET requests', async () => {
      let response = await router.fetch(new Request('http://localhost/', { method: 'POST' }))

      assert.equal(response.status, 404)
    })
  })
})
