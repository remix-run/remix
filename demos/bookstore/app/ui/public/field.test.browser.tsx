import * as form from '@remix-run/ui/form'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'
import { describe, it } from 'remix/test'

import { RestfulForm } from '../restful-form.tsx'
import { Field } from './field.tsx'

const Settings = fd.object({ name: fd.text(s.string()) })

describe('bookstore Field', () => {
  it('connects a bound field inside a RESTful form', (t) => {
    let view = render(
      <form.Context schema={Settings}>
        {({ fields }) => (
          <RestfulForm method="PUT" action="/settings" mix={form.root()}>
            <Field field={fields.name} label="Name" input={{ defaultValue: 'Ada' }} />
          </RestfulForm>
        )}
      </form.Context>,
    )
    t.after(view.cleanup)

    let input = view.container.querySelector('input[name="name"]') as HTMLInputElement
    let label = view.container.querySelector('label') as HTMLLabelElement
    let method = view.container.querySelector('input[name="_method"]') as HTMLInputElement
    assert.equal(label.control, input)
    assert.equal(input.value, 'Ada')
    assert.equal(method.value, 'PUT')

    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('focusout', { bubbles: true }))
    view.root.flush()
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    assert.ok(view.container.querySelector('p[role="alert"]'))
  })
})
