import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './controlled-single.example.tsx'
import { button, element, mount } from '../test-helpers.ts'

describe('Controlled single accordion example', () => {
  it('synchronizes the toggle toolbar and panels in both directions', async (t) => {
    let result = await mount(t, <Example />)
    let toolbar = element(result.container, '[role="group"]')
    let shipping = button(toolbar, 'Shipping')
    let billing = button(toolbar, 'Billing')
    let panels = element(result.container, ':scope > div > div:last-child')
    assert.equal(shipping.getAttribute('aria-pressed'), 'true')
    await result.act(() => billing.click())
    assert.equal(shipping.getAttribute('aria-pressed'), 'false')
    assert.equal(button(panels, 'Billing').getAttribute('aria-expanded'), 'true')
    await result.act(() => billing.click())
    assert.equal(billing.getAttribute('aria-pressed'), 'false')
    assert.equal(button(panels, 'Billing').getAttribute('aria-expanded'), 'false')
    await result.act(() => button(panels, 'Shipping').click())
    assert.equal(shipping.getAttribute('aria-pressed'), 'true')
    await result.act(() => button(panels, 'Billing').click())
    assert.equal(shipping.getAttribute('aria-pressed'), 'false')
    assert.equal(billing.getAttribute('aria-pressed'), 'true')
  })
})
