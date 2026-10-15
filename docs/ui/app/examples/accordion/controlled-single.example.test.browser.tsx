import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './controlled-single.example.tsx'
import { button, input, mount } from '../test-helpers.ts'

describe('Controlled single accordion example', () => {
  it('synchronizes the radio toolbar and panels in both directions', async (t) => {
    let result = await mount(t, <Example />)
    let shipping = input(result.container, 'input[value="shipping"]')
    let billing = input(result.container, 'input[value="billing"]')
    assert.equal(shipping.checked, true)
    await result.act(() => billing.click())
    assert.equal(shipping.checked, false)
    assert.equal(button(result.container, 'Billing').getAttribute('aria-expanded'), 'true')
    await result.act(() => billing.click())
    assert.equal(billing.checked, false)
    assert.equal(button(result.container, 'Billing').getAttribute('aria-expanded'), 'false')
    await result.act(() => button(result.container, 'Shipping').click())
    assert.equal(shipping.checked, true)
    await result.act(() => button(result.container, 'Billing').click())
    assert.equal(shipping.checked, false)
    assert.equal(billing.checked, true)
  })
})
