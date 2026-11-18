import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './form.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Select form example', () => {
  it('submits the newly selected delivery value', async (t) => {
    let result = await mount(t, <Example />)
    let form = document.body.querySelector('form')
    assert.ok(form)
    assert.equal(new FormData(form).get('delivery'), 'standard')
    await result.act(() => button(document.body, 'Delivery method').click())
    await result.act(() => element(document.body, '[role="option"]:nth-child(2)').click())
    await waitFor(() => assert.equal(new FormData(form).get('delivery'), 'express'))
    await result.act(() => button(document.body, 'Save delivery preference').click())
    assert.equal(
      element(document.body, '[role="status"]').textContent,
      'Express delivery confirmed',
    )
  })
})
