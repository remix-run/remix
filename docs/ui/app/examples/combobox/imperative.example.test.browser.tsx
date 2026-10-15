import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './imperative.example.tsx'
import { button, element, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Imperative combobox example', () => {
  it('opens from Browse states and highlights the first option', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    await result.act(() => button(result.container, 'Browse states').click())
    await waitFor(() => assert.equal(search.getAttribute('aria-expanded'), 'true'))
    let first = element(result.container, '[role="option"]')
    assert.equal(first.textContent, 'Alabama')
    assert.equal(search.getAttribute('aria-activedescendant'), first.id)
    await result.act(() => key(search, 'Enter'))
    await waitFor(() => assert.equal(input(result.container, 'input[type="hidden"]').value, 'AL'))
    await waitFor(() => assert.equal(search.value, 'Alabama'))
  })
})
