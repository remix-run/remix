import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './controlled-multiple.example.tsx'
import { button, mount } from '../test-helpers.ts'

describe('Controlled multiple accordion example', () => {
  it('synchronizes independent toolbar toggles and panels', async (t) => {
    let result = await mount(t, <Example />)
    await result.act(() => button(result.container, 'Show Billing').click())
    assert.equal(button(result.container, 'Billing').getAttribute('aria-expanded'), 'true')
    assert.equal(button(result.container, 'Hide Shipping').getAttribute('aria-pressed'), 'true')
    assert.equal(button(result.container, 'Hide Billing').getAttribute('aria-pressed'), 'true')
    await result.act(() => button(result.container, 'Shipping').click())
    assert.equal(button(result.container, 'Show Shipping').getAttribute('aria-pressed'), 'false')
    assert.equal(button(result.container, 'Billing').getAttribute('aria-expanded'), 'true')
    await result.act(() => button(result.container, 'Hide Billing').click())
    assert.equal(button(result.container, 'Billing').getAttribute('aria-expanded'), 'false')
  })
})
