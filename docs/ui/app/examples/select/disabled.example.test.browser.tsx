import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './disabled.example.tsx'
import { button, element, input, mount } from '../test-helpers.ts'

describe('Disabled select example', () => {
  it('keeps the dispatched delivery method unchanged', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Delivery method')
    assert.equal(trigger.disabled, true)
    await result.act(() => trigger.click())
    assert.equal(element(result.container, '[popover]').matches(':popover-open'), false)
    assert.equal(input(result.container, 'input[type="hidden"]').value, 'standard')
  })
})
