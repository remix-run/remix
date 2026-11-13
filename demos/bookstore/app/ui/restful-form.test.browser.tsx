import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'
import { RestfulForm } from './restful-form.tsx'

describe('RestfulForm', () => {
  it('renders a GET form when method is not specified', (t) => {
    let { $, cleanup } = render(<RestfulForm />)
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    assert.equal(form.method, 'get')
    assert.equal($('input[type="hidden"]'), null)
  })

  it('renders a GET form when method is GET', (t) => {
    let { $, cleanup } = render(<RestfulForm method="GET" />)
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    assert.equal(form.method, 'get')
    assert.equal($('input[type="hidden"]'), null)
  })

  it('renders a POST form when method is POST', (t) => {
    let { $, cleanup } = render(<RestfulForm method="POST" />)
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    assert.equal(form.method, 'post')
    assert.equal($('input[type="hidden"]'), null)
  })

  it('renders a POST form with hidden _method input when method is PUT', (t) => {
    let { $, cleanup } = render(<RestfulForm method="PUT" />)
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(form.method, 'post')
    assert.notEqual(hidden, null)
    assert.equal(hidden.name, '_method')
    assert.equal(hidden.value, 'PUT')
  })

  it('renders a POST form with hidden _method input when method is DELETE', (t) => {
    let { $, cleanup } = render(<RestfulForm method="DELETE" />)
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(form.method, 'post')
    assert.notEqual(hidden, null)
    assert.equal(hidden.name, '_method')
    assert.equal(hidden.value, 'DELETE')
  })

  it('renders a POST form with hidden _method input when method is PATCH', (t) => {
    let { $, cleanup } = render(<RestfulForm method="PATCH" />)
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(form.method, 'post')
    assert.equal(hidden.name, '_method')
    assert.equal(hidden.value, 'PATCH')
  })

  it('uses a custom methodOverrideField name', (t) => {
    let { $, cleanup } = render(<RestfulForm method="PUT" methodOverrideField="__method" />)
    t.after(cleanup)
    let hidden = $('input[type="hidden"]') as HTMLInputElement
    assert.equal(hidden.name, '__method')
    assert.equal(hidden.value, 'PUT')
  })

  it('passes additional props to the form element', (t) => {
    let { $, cleanup } = render(<RestfulForm method="POST" action="/submit" id="my-form" />)
    t.after(cleanup)
    let form = $('form') as HTMLFormElement
    assert.equal(form.action.endsWith('/submit'), true)
    assert.equal(form.id, 'my-form')
  })

  it('renders children inside the form', (t) => {
    let { $, cleanup } = render(
      <RestfulForm method="POST">
        <input type="text" name="title" data-testid="title-input" />
      </RestfulForm>,
    )
    t.after(cleanup)
    assert.notEqual($('[data-testid="title-input"]'), null)
  })

  it('renders children alongside the hidden method input for non-POST methods', (t) => {
    let { $, cleanup } = render(
      <RestfulForm method="PUT">
        <input type="text" name="title" data-testid="title-input" />
      </RestfulForm>,
    )
    t.after(cleanup)
    assert.notEqual($('input[type="hidden"]'), null)
    assert.notEqual($('[data-testid="title-input"]'), null)
  })
})
