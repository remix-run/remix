import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createDataModelFormsRouter } from '../router.ts'

describe('render middleware', () => {
  it('renders a complete document by default', async () => {
    let router = createDataModelFormsRouter()
    router.get('/default-document', ({ render }) => render('Default content'))

    let response = await router.fetch('http://localhost/default-document')
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /<html lang="en">/)
    assert.match(html, /<title>Model-backed forms<\/title>/)
    assert.match(html, /<link rel="modulepreload" href="[^"]+" \/>/)
    assert.match(html, /<script async type="module" src="[^"]+"><\/script>/)
    assert.match(html, /<body[^>]*>Default content<\/body>/)
  })

  it('renders a custom document title', async () => {
    let router = createDataModelFormsRouter()
    router.get('/custom-title', ({ render }) =>
      render('Custom title content', { document: { title: 'Create an account' } }),
    )

    let response = await router.fetch('http://localhost/custom-title')
    let html = await response.text()

    assert.match(html, /<title>Create an account<\/title>/)
    assert.match(html, /<body[^>]*>Custom title content<\/body>/)
  })

  it('renders a partial response without the document shell', async () => {
    let router = createDataModelFormsRouter()
    router.get('/partial', ({ render }) => render('Partial content', { document: false }))

    let response = await router.fetch('http://localhost/partial')
    let html = await response.text()

    assert.match(html, /Partial content/)
    assert.doesNotMatch(html, /<html|<head|<body|<script/)
  })

  it('applies nested response init options', async () => {
    let router = createDataModelFormsRouter()
    router.get('/response-init', ({ render }) =>
      render('Accepted', {
        responseInit: {
          status: 202,
          headers: { 'X-Demo-Render': 'options' },
        },
      }),
    )

    let response = await router.fetch('http://localhost/response-init')

    assert.equal(response.status, 202)
    assert.equal(response.headers.get('X-Demo-Render'), 'options')
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
  })
})
