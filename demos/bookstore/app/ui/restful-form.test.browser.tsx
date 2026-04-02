import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { RestfulForm } from './restful-form.tsx'

describe('RestfulForm', () => {
  it('renders a GET form when method is not specified', (t) => {
    let { $ } = t.render(<RestfulForm />)
    let form = $('form') as HTMLFormElement
    assert.equal(form.method, 'get')
    assert.equal($('input[type="hidden"]'), null)
  })

  it('renders a GET form when method is GET', (t) => {
    let { $ } = t.render(<RestfulForm method="GET" />)
    let form = $('form') as HTMLFormElement
    assert.equal(form.method, 'get')
    assert.equal($('input[type="hidden"]'), null)
  })

  it('renders a POST form when method is POST', (t) => {
    let { $ } = t.render(<RestfulForm method="POST" />)
    let form = $('form') as HTMLFormElement
    assert.equal(form.method, 'post')
    assert.equal($('input[type="hidden"]'), null)
  })

  it('renders a POST form with hidden _method input when method is PUT', (t) => {
    let { $ } = t.render(<RestfulForm method="PUT" />)
    let form = $('form') as HTMLFormElement
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(form.method, 'post')
    assert.notEqual(hidden, null)
    assert.equal(hidden.name, '_method')
    assert.equal(hidden.value, 'PUT')
  })

  it('renders a POST form with hidden _method input when method is DELETE', (t) => {
    let { $ } = t.render(<RestfulForm method="DELETE" />)
    let form = $('form') as HTMLFormElement
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(form.method, 'post')
    assert.notEqual(hidden, null)
    assert.equal(hidden.name, '_method')
    assert.equal(hidden.value, 'DELETE')
  })

  it('renders a POST form with hidden _method input when method is PATCH', (t) => {
    let { $ } = t.render(<RestfulForm method="PATCH" />)
    let form = $('form') as HTMLFormElement
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(form.method, 'post')
    assert.equal(hidden.name, '_method')
    assert.equal(hidden.value, 'PATCH')
  })

  it('uses a custom methodOverrideField name', (t) => {
    let { $ } = t.render(<RestfulForm method="PUT" methodOverrideField="__method" />)
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(hidden.name, '__method')
    assert.equal(hidden.value, 'PUT')
  })

  it('passes additional props to the form element', (t) => {
    let { $ } = t.render(<RestfulForm method="POST" action="/submit" id="my-form" />)
    let form = $('form') as HTMLFormElement
    assert.equal(form.action.endsWith('/submit'), true)
    assert.equal(form.id, 'my-form')
  })

  it('renders children inside the form', (t) => {
    let { $ } = t.render(
      <RestfulForm method="POST">
        <input type="text" name="title" data-testid="title-input" />
      </RestfulForm>,
    )
    assert.notEqual($('[data-testid="title-input"]'), null)
  })

  it('renders children alongside the hidden method input for non-POST methods', (t) => {
    let { $ } = t.render(
      <RestfulForm method="PUT">
        <input type="text" name="title" data-testid="title-input" />
      </RestfulForm>,
    )
    assert.notEqual($('input[type="hidden"]'), null)
    assert.notEqual($('[data-testid="title-input"]'), null)
  })
})
