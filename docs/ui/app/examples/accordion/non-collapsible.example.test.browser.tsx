import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './non-collapsible.example.tsx'
import { button, mount } from '../test-helpers.ts'

describe('Non-collapsible accordion example', () => {
  it('keeps the selected panel open until another item is opened', async (t) => {
    let result = await mount(t, <Example />)
    let shipping = button(result.container, 'Shipping')
    let billing = button(result.container, 'Billing')
    assert.equal(shipping.getAttribute('aria-disabled'), 'true')
    await result.act(() => shipping.click())
    assert.equal(shipping.getAttribute('aria-expanded'), 'true')
    await result.act(() => billing.click())
    assert.equal(billing.getAttribute('aria-expanded'), 'true')
    assert.equal(billing.getAttribute('aria-disabled'), 'true')
    assert.equal(shipping.getAttribute('aria-expanded'), 'false')
    assert.notEqual(shipping.getAttribute('aria-disabled'), 'true')
  })
})
