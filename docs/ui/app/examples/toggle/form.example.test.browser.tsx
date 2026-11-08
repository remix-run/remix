import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './form.example.tsx'
import { button, element, input, mount } from '../test-helpers.ts'

describe('Toggle form example', () => {
  it('submits the current checked value and omits unchecked values', async (t) => {
    let result = await mount(t, <Example />)
    let checkbox = input(result.container)
    let form = result.container.querySelector('form')
    assert.ok(form)
    assert.equal(new FormData(form).get('newsletter'), 'yes')
    await result.act(() => button(result.container, 'Save preferences').click())
    assert.equal(
      element(result.container, '[role="status"]').textContent,
      'Newsletter subscription saved',
    )
    await result.act(() => checkbox.click())
    assert.equal(new FormData(form).has('newsletter'), false)
    await result.act(() => button(result.container, 'Save preferences').click())
    assert.equal(
      element(result.container, '[role="status"]').textContent,
      'Newsletter subscription removed',
    )
  })
})
