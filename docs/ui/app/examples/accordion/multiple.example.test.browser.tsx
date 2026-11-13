import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './multiple.example.tsx'
import { button, mount } from '../test-helpers.ts'

describe('Multiple accordion example', () => {
  it('keeps other panels open when an item is toggled', async (t) => {
    let result = await mount(t, <Example />)
    let shipping = button(result.container, 'Shipping')
    let billing = button(result.container, 'Billing')
    let returns = button(result.container, 'Returns')
    assert.equal(shipping.getAttribute('aria-expanded'), 'false')
    await result.act(() => shipping.click())
    await result.act(() => billing.click())
    await result.act(() => returns.click())
    assert.equal(shipping.getAttribute('aria-expanded'), 'true')
    assert.equal(billing.getAttribute('aria-expanded'), 'true')
    assert.equal(returns.getAttribute('aria-expanded'), 'true')
    await result.act(() => billing.click())
    assert.equal(billing.getAttribute('aria-expanded'), 'false')
    assert.equal(shipping.getAttribute('aria-expanded'), 'true')
  })
})
