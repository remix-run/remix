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

  describe('version redirects', () => {
    it('redirects package without version to latest', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@7.0.0')
    })

    it('redirects dist-tag "latest" to resolved version', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@latest'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@7.0.0')
    })

    it('redirects partial major version to highest match', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@1'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@1.1.2')
    })

    it('redirects partial major.minor version to highest match', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@2.0'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@2.0.2')
    })

    it('redirects caret semver range to highest compatible version', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@^1.0.0'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@1.1.2')
    })

    it('redirects tilde semver range to highest patch version', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@~1.1.0'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@1.1.2')
    })

    it('redirects URL-encoded caret range', async () => {
      // %5E is URL-encoded ^
      let response = await router.fetch(new Request('http://localhost/is-number@%5E2.0.0'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@2.1.0')
    })

    it('redirects URL-encoded tilde range', async () => {
      // %7E is URL-encoded ~
      let response = await router.fetch(new Request('http://localhost/is-number@%7E2.0.0'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@2.0.2')
    })

    it('redirects complex semver range', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@>=1.0.0 <2.0.0'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@1.1.2')
    })

    it('preserves file path in redirect', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@^7/package.json'))

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/is-number@7.0.0/package.json')
    })

    it('does not redirect fully resolved version', async () => {
      let response = await router.fetch(new Request('http://localhost/is-number@7.0.0'))

      // Should return 200 (directory listing), not a redirect
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('is-number'))
    })
  })
})
