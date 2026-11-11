import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './grouped.example.tsx'
import { button, element, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Grouped select example', () => {
  it('names groups and commits a choice reached across a group boundary', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(document.body, 'Standard delivery')
    let list = element(document.body, '[role="listbox"]')
    let groups = list.querySelectorAll('[role="group"]')

    assert.equal(groups.length, 2)
    assert.deepEqual(
      Array.from(groups, (group) =>
        element(
          document.body,
          `[id="${group.getAttribute('aria-labelledby')}"]`,
        ).textContent?.trim(),
      ),
      ['Delivery', 'Collection'],
    )

    await result.act(() => trigger.click())
    await waitFor(() => assert.equal(document.activeElement, list))
    await result.act(() => key(list, 'Home'))
    await result.act(() => key(list, 'ArrowDown'))
    await result.act(() => key(list, 'ArrowDown'))

    let highlighted = element(document.body, `[id="${list.getAttribute('aria-activedescendant')}"]`)
    assert.equal(highlighted.textContent?.trim(), 'Collect in store')
    assert.equal(document.activeElement, list)
    assert.equal(input(document.body, 'input[type="hidden"]').value, 'standard')

    await result.act(() => key(list, 'Enter'))
    await waitFor(() => assert.equal(input(document.body, 'input[type="hidden"]').value, 'store'))
    await waitFor(() => assert.equal(trigger.textContent?.trim(), 'Collect in store'))
    await waitFor(() =>
      assert.equal(element(document.body, '[data-popover]').matches('[data-open]'), false),
    )
    await waitFor(() => assert.equal(document.activeElement, trigger))
    assert.equal(
      element(
        document.body,
        `[id="${trigger.getAttribute('aria-labelledby')}"]`,
      ).textContent?.trim(),
      'Delivery method',
    )
  })
})
