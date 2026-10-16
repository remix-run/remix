import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './form.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Select form example', () => {
  it('submits the newly selected delivery value', async (t) => {
    let result = await mount(t, <Example />)
    let form = result.container.querySelector('form')
    assert.ok(form)
    assert.equal(new FormData(form).get('delivery'), 'standard')
    await result.act(() => button(result.container, 'Delivery method').click())
    await result.act(() => element(result.container, '[role="option"]:nth-child(2)').click())
    await waitFor(() => assert.equal(new FormData(form).get('delivery'), 'express'))
    await result.act(() => button(result.container, 'Save delivery preference').click())
    assert.equal(
      element(result.container, '[role="status"]').textContent,
      'Express delivery confirmed',
    )
  })
})
