import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './radio.example.tsx'
import { button, element, finishAnimations, mount, waitFor } from '../test-helpers.ts'

describe('Radio menu example', () => {
  it('keeps exactly one sort order selected across reopening', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Sort by')
    await result.act(() => trigger.click())
    let name = element(result.container, '[role="menuitemradio"]')
    let modified = element(result.container, '[role="menuitemradio"]:nth-child(2)')
    assert.equal(name.getAttribute('aria-checked'), 'true')
    await result.act(() => modified.click())
    await waitFor(() => assert.equal(modified.getAttribute('aria-checked'), 'true'))
    assert.equal(name.getAttribute('aria-checked'), 'false')
    assert.equal(result.$$('[role="menuitemradio"][aria-checked="true"]').length, 1)
    await waitFor(() =>
      assert.equal(element(result.container, '[popover]').matches(':popover-open'), false),
    )
    await waitFor(() => assert.equal(result.$$('[data-menu-flash]').length, 0))
    await finishAnimations(element(result.container, '[popover]'))
    await waitFor(() => assert.equal(document.activeElement, trigger))
    await result.act(() => trigger.click())
    await waitFor(() =>
      assert.equal(element(result.container, '[popover]').matches(':popover-open'), true),
    )
    assert.equal(modified.getAttribute('aria-checked'), 'true')
  })
})
