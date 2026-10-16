import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './disabled.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Disabled menu item example', () => {
  it('skips Undo while allowing enabled actions to be selected', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Edit')
    let list = element(result.container, '[role="menu"]')
    let items = list.querySelectorAll('[role="menuitem"]')
    let undo = element(list, '[role="menuitem"]')
    let selected: string | undefined
    result.container.addEventListener('rmx:menu-select', (event) => {
      selected = event.item.name
    })

    assert.equal(undo.textContent?.trim(), 'Undo')
    assert.equal(undo.getAttribute('aria-disabled'), 'true')
    await result.act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => assert.equal(document.activeElement, items[1]))
    await result.act(() => undo.click())
    assert.equal(selected, undefined)
    assert.equal(element(result.container, '[popover]').matches(':popover-open'), true)

    await result.act(() => key(list, 'u'))
    assert.equal(document.activeElement, items[1])
    await result.act(() => key(list, 'ArrowDown'))
    await waitFor(() => assert.equal(document.activeElement, items[2]))
    await result.act(() => key(list, 'Enter'))
    await waitFor(() => assert.equal(selected, 'cut'))
    await waitFor(() =>
      assert.equal(element(result.container, '[popover]').matches(':popover-open'), false),
    )
    await waitFor(() => assert.equal(document.activeElement, trigger))
  })
})
