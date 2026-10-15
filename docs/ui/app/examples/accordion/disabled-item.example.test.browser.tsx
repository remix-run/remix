import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './disabled-item.example.tsx'
import { button, element, key, mount } from '../test-helpers.ts'

describe('Disabled accordion item example', () => {
  it('disables gift wrapping while other sections remain usable', async (t) => {
    let result = await mount(t, <Example />)
    let gift = element(result.container, 'button:disabled')
    let billing = button(result.container, 'Billing')
    assert.equal(gift.hasAttribute('disabled'), true)
    await result.act(() => gift.click())
    assert.equal(gift.getAttribute('aria-expanded'), 'false')
    await result.act(() => billing.click())
    assert.equal(billing.getAttribute('aria-expanded'), 'true')
    billing.focus()
    await result.act(() => key(billing, 'ArrowDown'))
    assert.equal(document.activeElement, button(result.container, 'Shipping'))
  })
})
