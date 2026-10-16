import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { element, enterText, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Combobox example', () => {
  it('closes unmatched searches and reopens the full list with an arrow key', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    await result.act(() => {
      search.focus()
      enterText(search, 'Cali')
    })
    await waitFor(() => assert.ok(element(result.container, '[popover]').checkVisibility()))
    await result.act(() => enterText(search, 'lifornia'))
    assert.equal(search.value, 'lifornia')
    assert.equal(search.getAttribute('aria-expanded'), 'false')
    assert.equal(element(result.container, '[popover]').matches(':popover-open'), false)
    await result.act(() => key(search, 'ArrowDown'))
    await waitFor(() => assert.equal(search.getAttribute('aria-expanded'), 'true'))
    assert.equal(result.container.querySelectorAll('[role="option"]:not([hidden])').length, 50)
    assert.equal(search.value, 'lifornia')
    assert.equal(input(result.container, 'input[type="hidden"]').value, '')
    await result.act(() => enterText(search, ''))
    assert.equal(search.getAttribute('aria-expanded'), 'false')
  })

  it('filters states and separates search text from the selected value', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let value = input(result.container, 'input[type="hidden"]')
    await result.act(() => {
      search.focus()
      enterText(search, 'Cali')
    })
    let california = element(result.container, '[role="option"]:not([hidden])')
    assert.equal(california.textContent, 'California')
    assert.equal(element(california, 'mark').textContent, 'Cali')
    assert.equal(value.value, '')
    assert.equal(search.getAttribute('aria-expanded'), 'true')
    await waitFor(() => assert.ok(california.checkVisibility()))
    await result.act(() => california.click())
    await waitFor(() => assert.equal(value.value, 'CA'))
    await waitFor(() => assert.equal(search.value, 'California'))
    await result.act(() => enterText(search, 'New'))
    assert.equal(value.value, '')
    await result.act(() => key(search, 'Escape'))
    assert.equal(search.value, '')
    assert.equal(search.getAttribute('aria-expanded'), 'false')
  })
})
