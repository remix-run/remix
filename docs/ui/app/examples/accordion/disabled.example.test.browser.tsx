import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './disabled.example.tsx'
import { button, mount } from '../test-helpers.ts'

describe('Disabled accordion example', () => {
  it('prevents all items from opening', async (t) => {
    let result = await mount(t, <Example />)
    let addresses = button(result.container, 'Saved addresses')
    let cards = button(result.container, 'Saved cards')
    assert.equal(addresses.disabled, true)
    assert.equal(cards.disabled, true)
    await result.act(() => addresses.click())
    await result.act(() => cards.click())
    assert.equal(addresses.getAttribute('aria-expanded'), 'false')
    assert.equal(cards.getAttribute('aria-expanded'), 'false')
  })
})
