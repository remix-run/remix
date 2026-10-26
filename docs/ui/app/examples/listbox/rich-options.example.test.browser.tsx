import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './rich-options.example.tsx'
import { element, key, mount } from '../test-helpers.ts'

describe('Rich listbox example', () => {
  it('uses aliases for typeahead and skips unavailable delivery methods', async (t) => {
    let result = await mount(t, <Example />)
    let list = element(result.container, '[role="listbox"]')
    let unavailable = element(result.container, '[role="option"][aria-disabled="true"]')
    let standard = element(result.container, '[role="option"]:first-child')
    let express = element(result.container, '[role="option"]:nth-child(2)')
    await result.act(() => unavailable.click())
    assert.equal(standard.getAttribute('aria-selected'), 'true')
    list.focus()
    await result.act(() => key(list, 'r'))
    assert.equal(list.getAttribute('aria-activedescendant'), standard.id)
    await result.act(() => key(list, 'End'))
    assert.equal(list.getAttribute('aria-activedescendant'), express.id)
    await result.act(() => key(list, 'Enter'))
    assert.equal(express.getAttribute('aria-selected'), 'true')
    await result.act(() => key(list, 'ArrowDown'))
    assert.notEqual(list.getAttribute('aria-activedescendant'), unavailable.id)
  })
})
