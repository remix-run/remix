import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './rich-options.example.tsx'
import { button, element, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Rich select example', () => {
  it('supports alias typeahead while excluding unavailable choices', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(document.body, 'Delivery method')
    await result.act(() => trigger.click())
    let unavailable = element(document.body, '[role="option"][aria-disabled="true"]')
    await result.act(() => unavailable.click())
    assert.equal(input(document.body, 'input[type="hidden"]').value, 'standard')
    let list = element(document.body, '[role="listbox"]')
    await result.act(() => key(list, 'p'))
    let express = element(document.body, '[role="option"]:nth-child(2)')
    assert.equal(list.getAttribute('aria-activedescendant'), express.id)
    await result.act(() => key(list, 'Enter'))
    await waitFor(() => assert.equal(input(document.body, 'input[type="hidden"]').value, 'express'))
    await waitFor(() => assert.equal(trigger.textContent?.trim(), 'Express delivery'))
  })
})
