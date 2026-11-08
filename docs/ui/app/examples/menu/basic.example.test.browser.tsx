import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Menu example', () => {
  it('opens with keyboard focus and restores focus on dismissal', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Edit')
    trigger.focus()
    await result.act(() => key(trigger, 'ArrowDown'))
    await waitFor(() =>
      assert.equal(element(result.container, '[popover]').matches(':popover-open'), true),
    )
    let list = element(result.container, '[role="menu"]')
    let undo = element(result.container, '[role="menuitem"]')
    await waitFor(() => assert.equal(document.activeElement, undo))
    await result.act(() => key(list, 'ArrowDown'))
    await waitFor(() =>
      assert.equal(
        document.activeElement,
        element(result.container, '[role="menuitem"]:nth-child(2)'),
      ),
    )
    await result.act(() => key(list, 'Escape'))
    await waitFor(() =>
      assert.equal(element(result.container, '[popover]').matches(':popover-open'), false),
    )
    await waitFor(() => assert.equal(document.activeElement, trigger))
  })
})
