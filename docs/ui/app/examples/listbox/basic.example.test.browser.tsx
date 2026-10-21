import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { element, key, mount, waitFor } from '../test-helpers.ts'

describe('Listbox example', () => {
  it('selects options and highlights keyboard typeahead matches', async (t) => {
    let result = await mount(t, <Example />)
    let list = element(result.container, '[role="listbox"]')
    let design = element(result.container, '[role="option"][aria-selected="true"]')
    assert.equal(design.textContent?.trim(), 'Design')
    list.focus()
    await result.act(() => key(list, 'e'))
    let activeId = list.getAttribute('aria-activedescendant')
    assert.ok(activeId)
    let engineering = element(result.container, `[id="${activeId}"]`)
    assert.equal(engineering.textContent?.trim(), 'Engineering')
    await result.act(() => key(list, 'Enter'))
    await waitFor(() => assert.equal(engineering.getAttribute('aria-selected'), 'true'))
    assert.equal(design.getAttribute('aria-selected'), 'false')
    await waitFor(() => assert.equal(engineering.hasAttribute('data-listbox-flash'), false))
    await result.act(() => element(result.container, '[role="option"]:last-child').click())
    await waitFor(() =>
      assert.equal(
        element(result.container, '[role="option"]:last-child').getAttribute('aria-selected'),
        'true',
      ),
    )
  })
})
