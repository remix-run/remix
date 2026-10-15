import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './initial.example.tsx'
import { element, enterText, input, mount, waitFor } from '../test-helpers.ts'

describe('Initial combobox value example', () => {
  it('displays the initial value and accepts a new selection', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let value = input(result.container, 'input[type="hidden"]')
    assert.equal(search.value, 'CA')
    assert.equal(value.value, 'CA')
    await result.act(() => {
      search.focus()
      enterText(search, 'Texas')
    })
    assert.equal(value.value, '')
    await result.act(() => element(result.container, '[role="option"]:not([hidden])').click())
    await waitFor(() => assert.equal(value.value, 'TX'))
    await waitFor(() => assert.equal(search.value, 'Texas'))
  })
})
