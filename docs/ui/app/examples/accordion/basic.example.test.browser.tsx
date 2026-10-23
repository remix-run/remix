import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, finishAnimations, key, mount } from '../test-helpers.ts'

describe('Accordion example', () => {
  it('opens one panel at a time and supports keyboard navigation', async (t) => {
    let result = await mount(t, <Example />)
    let shipping = button(result.container, 'Shipping')
    let billing = button(result.container, 'Billing')
    assert.equal(shipping.getAttribute('aria-expanded'), 'true')
    await result.act(() => billing.click())
    assert.equal(billing.getAttribute('aria-expanded'), 'true')
    assert.equal(shipping.getAttribute('aria-expanded'), 'false')
    let shippingPanel = element(
      result.container,
      `[id="${shipping.getAttribute('aria-controls')}"]`,
    )
    assert.equal(shippingPanel.inert, true)
    let billingPanel = element(result.container, `[id="${billing.getAttribute('aria-controls')}"]`)
    await finishAnimations(result.container)
    assert.ok(shippingPanel.getBoundingClientRect().height < 1)
    assert.ok(billingPanel.getBoundingClientRect().height > 0)
    await result.act(() => billing.click())
    assert.equal(billing.getAttribute('aria-expanded'), 'false')
    await finishAnimations(result.container)
    assert.ok(billingPanel.getBoundingClientRect().height < 1)
    billing.focus()
    await result.act(() => key(billing, 'ArrowDown'))
    assert.equal(document.activeElement, button(result.container, 'Returns'))
  })
})
