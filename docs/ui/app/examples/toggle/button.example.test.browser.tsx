import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './button.example.tsx'
import { element, mount } from '../test-helpers.ts'

describe('Button toggle example', () => {
  it('toggles from its label and reflects checked state', async (t) => {
    let result = await mount(t, <Example />)
    let toggle = element(result.container, 'button')
    assert.equal(toggle.getAttribute('aria-checked'), 'false')
    await result.act(() => element(result.container, 'strong').click())
    assert.equal(toggle.getAttribute('aria-checked'), 'true')
    await result.act(() => toggle.click())
    assert.equal(toggle.getAttribute('aria-checked'), 'false')
  })
})
