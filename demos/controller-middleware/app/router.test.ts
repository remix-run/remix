import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { router } from './router.ts'

describe('controller middleware', () => {
  it('runs parent controller middleware for the parent action', async () => {
    let response = await router.fetch('http://localhost/parent')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')

    let body = await response.text()
    assert.match(body, /<a href="\/parent" aria-current="page">Parent<\/a>/)
    assert.match(body, /<a href="\/parent\/child">Child<\/a>/)
    assert.match(body, /<a href="\/parent\/child\/grandchild">Grandchild<\/a>/)
    assert.match(
      body,
      /router middleware[\s\S]*parent mount middleware[\s\S]*parent controller middleware[\s\S]*parent action/,
    )
  })

  it('runs child controller middleware for the child action', async () => {
    let response = await router.fetch('http://localhost/parent/child')

    assert.equal(response.status, 200)

    let body = await response.text()
    assert.match(body, /<a href="\/parent\/child" aria-current="page">Child<\/a>/)
    assert.match(
      body,
      /router middleware[\s\S]*parent mount middleware[\s\S]*child controller middleware[\s\S]*child action/,
    )
    assert.doesNotMatch(body, /<code>parent controller middleware<\/code>/)
  })

  it('runs grandchild controller middleware for the grandchild action', async () => {
    let response = await router.fetch('http://localhost/parent/child/grandchild')

    assert.equal(response.status, 200)

    let body = await response.text()
    assert.match(body, /<a href="\/parent\/child\/grandchild" aria-current="page">Grandchild<\/a>/)
    assert.match(
      body,
      /router middleware[\s\S]*parent mount middleware[\s\S]*grandchild controller middleware[\s\S]*grandchild action/,
    )
    assert.doesNotMatch(
      body,
      /<code>(?:parent controller middleware|child controller middleware)<\/code>/,
    )
  })
})
