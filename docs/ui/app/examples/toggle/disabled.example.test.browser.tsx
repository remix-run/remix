import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './disabled.example.tsx'
import { element, input, mount } from '../test-helpers.ts'

describe('Disabled toggle example', () => {
  it('preserves required security alerts when clicked', async (t) => {
    let result = await mount(t, <Example />)
    let checkbox = input(result.container)
    assert.equal(checkbox.disabled, true)
    assert.equal(checkbox.checked, true)
    await result.act(() => element(result.container, 'label').click())
    await result.act(() => checkbox.click())
    assert.equal(checkbox.checked, true)
  })
})
