import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './grouped.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Grouped menu example', () => {
  it('names groups and navigates past headings and separators to activate an item', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Edit')
    let list = element(result.container, '[role="menu"]')
    let groups = list.querySelectorAll('[role="group"]')
    let selected: string | undefined
    result.container.addEventListener('rmx:menu-select', (event) => {
      selected = event.item.name
    })

    assert.equal(groups.length, 2)
    assert.deepEqual(
      Array.from(groups, (group) =>
        element(
          result.container,
          `[id="${group.getAttribute('aria-labelledby')}"]`,
        ).textContent?.trim(),
      ),
      ['History', 'Clipboard'],
    )
    assert.equal(list.querySelectorAll('[role="separator"]').length, 1)

    await result.act(() => key(trigger, 'ArrowDown'))
    let items = list.querySelectorAll('[role="menuitem"]')
    await waitFor(() => assert.equal(document.activeElement, items[0]))
    await result.act(() => key(list, 'ArrowDown'))
    await result.act(() => key(list, 'ArrowDown'))
    await waitFor(() => assert.equal(document.activeElement, items[2]))
    assert.equal(document.activeElement?.textContent?.trim(), 'Cut')

    await result.act(() => key(list, 'p'))
    await waitFor(() => assert.equal(document.activeElement, items[4]))
    await result.act(() => key(list, 'Enter'))
    await waitFor(() => assert.equal(selected, 'paste'))
    await waitFor(() =>
      assert.equal(element(result.container, '[popover]').matches(':popover-open'), false),
    )
    await waitFor(() => assert.equal(document.activeElement, trigger))
  })
})
