import { assert } from 'remix/assert'
import { describe, it, render } from 'remix/testing'
import { RestfulForm } from './restful-form.tsx'

describe('RestfulForm', () => {
  it('renders as GET form by default', () => {
    let { $, cleanup } = render(<RestfulForm />)
    assert.equal($('form')?.getAttribute('method'), 'GET')
    assert.equal($('input[type="hidden"]'), null)
    cleanup()
  })

  it('renders as GET form when method="get" (case-insensitive)', () => {
    let { $, cleanup } = render(<RestfulForm method="get" />)
    assert.equal($('form')?.getAttribute('method'), 'GET')
    assert.equal($('input[type="hidden"]'), null)
    cleanup()
  })

  it('renders as POST form without hidden field when method="POST"', () => {
    let { $, cleanup } = render(<RestfulForm method="POST" />)
    assert.equal($('form')?.getAttribute('method'), 'POST')
    assert.equal($('input[type="hidden"]'), null)
    cleanup()
  })

  it('renders PUT as POST form with hidden _method field', () => {
    let { $, cleanup } = render(<RestfulForm method="PUT" />)
    assert.equal($('form')?.getAttribute('method'), 'POST')
    assert.equal($('input[type="hidden"]')?.getAttribute('name'), '_method')
    assert.equal($('input[type="hidden"]')?.getAttribute('value'), 'PUT')
    cleanup()
  })

  it('renders DELETE as POST form with hidden _method field', () => {
    let { $, cleanup } = render(<RestfulForm method="DELETE" />)
    assert.equal($('form')?.getAttribute('method'), 'POST')
    assert.equal($('input[type="hidden"]')?.getAttribute('name'), '_method')
    assert.equal($('input[type="hidden"]')?.getAttribute('value'), 'DELETE')
    cleanup()
  })

  it('uses a custom methodOverrideField name', () => {
    let { $, cleanup } = render(<RestfulForm method="PATCH" methodOverrideField="x-method" />)
    assert.equal($('input[type="hidden"]')?.getAttribute('name'), 'x-method')
    assert.equal($('input[type="hidden"]')?.getAttribute('value'), 'PATCH')
    cleanup()
  })

  it('renders children inside the form', () => {
    let { $, cleanup } = render(
      <RestfulForm method="DELETE">
        <button type="submit">Delete</button>
      </RestfulForm>,
    )
    assert.ok($('form button[type="submit"]'))
    assert.equal($('form button[type="submit"]')?.textContent, 'Delete')
    cleanup()
  })

  it('passes additional form props through', () => {
    let { $, cleanup } = render(<RestfulForm method="GET" action="/search" id="search-form" />)
    assert.equal($('form')?.getAttribute('action'), '/search')
    assert.equal($('form')?.getAttribute('id'), 'search-form')
    cleanup()
  })
})
