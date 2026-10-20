import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './form.example.tsx'
import { button, element, enterText, input, mount, waitFor } from '../test-helpers.ts'

describe('Combobox form example', () => {
  it('submits the accepted state value instead of its search text', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let form = result.container.querySelector('form')
    assert.ok(form)
    await result.act(() => {
      search.focus()
      enterText(search, 'California')
    })
    await result.act(() => element(result.container, '[role="option"]:not([hidden])').click())
    await waitFor(() => assert.equal(new FormData(form).get('state'), 'CA'))
    await result.act(() => button(result.container, 'Save').click())
    assert.equal(
      element(result.container, '[role="status"]').textContent,
      'State saved as California',
    )
    await result.act(() => {
      search.focus()
      enterText(search, 'Not a state')
      search.blur()
    })
    await waitFor(() => assert.equal(new FormData(form).get('state'), ''))
    await result.act(() => button(result.container, 'Save').click())
    assert.equal(element(result.container, '[role="status"]').textContent, 'Choose a state')
  })
})
