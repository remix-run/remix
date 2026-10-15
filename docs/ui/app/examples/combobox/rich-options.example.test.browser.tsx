import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './rich-options.example.tsx'
import { element, enterText, input, mount, waitFor } from '../test-helpers.ts'

describe('Rich combobox example', () => {
  it('searches aliases and prevents choosing an unavailable airport', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let value = input(result.container, 'input[type="hidden"]')
    await result.act(() => {
      search.focus()
      enterText(search, 'EWR')
    })
    let unavailable = element(result.container, '[role="option"]:not([hidden])')
    assert.equal(unavailable.getAttribute('aria-disabled'), 'true')
    await result.act(() => unavailable.click())
    assert.equal(value.value, '')
    await result.act(() => enterText(search, 'Massachusetts'))
    let boston = element(result.container, '[role="option"]:not([hidden])')
    assert.ok(boston.textContent?.includes('Boston (BOS)'))
    await result.act(() => boston.click())
    await waitFor(() => assert.equal(value.value, 'BOS'))
    await waitFor(() => assert.equal(search.value, 'Boston (BOS)'))
  })
})
