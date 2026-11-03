import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './checkbox.example.tsx'
import { button, element, finishAnimations, mount, waitFor } from '../test-helpers.ts'

describe('Checkbox menu example', () => {
  it('toggles one setting while preserving the other selections', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(document.body, 'View')
    await result.act(() => trigger.click())
    let sidebar = element(document.body, '[role="menuitemcheckbox"]')
    let toolbar = element(document.body, '[role="menuitemcheckbox"]:nth-child(2)')
    assert.equal(sidebar.getAttribute('aria-checked'), 'true')
    assert.equal(toolbar.getAttribute('aria-checked'), 'true')
    await result.act(() => sidebar.click())
    await waitFor(() => assert.equal(sidebar.getAttribute('aria-checked'), 'false'))
    assert.equal(toolbar.getAttribute('aria-checked'), 'true')
    await waitFor(() =>
      assert.equal(element(document.body, '[data-popover]').matches('[data-open]'), false),
    )
    await waitFor(() => assert.equal(document.body.querySelectorAll('[data-menu-flash]').length, 0))
    await finishAnimations(element(document.body, '[data-popover]'))
    await waitFor(() => assert.equal(document.activeElement, trigger))
    await result.act(() => trigger.click())
    await waitFor(() =>
      assert.equal(element(document.body, '[data-popover]').matches('[data-open]'), true),
    )
    assert.equal(sidebar.getAttribute('aria-checked'), 'false')
    await result.act(() => sidebar.click())
    await waitFor(() => assert.equal(sidebar.getAttribute('aria-checked'), 'true'))
  })
})
