import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './disabled.example.tsx'
import { element, input, mount } from '../test-helpers.ts'

describe('Disabled combobox example', () => {
  it('prevents editing and opening the state picker', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    assert.equal(search.disabled, true)
    await result.act(() => search.click())
    assert.notEqual(search.getAttribute('aria-expanded'), 'true')
    assert.equal(element(result.container, '[popover]').matches(':popover-open'), false)
  })
})
