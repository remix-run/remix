import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './grouped.example.tsx'
import { element, key, mount, waitFor } from '../test-helpers.ts'

describe('Grouped listbox example', () => {
  it('names groups and navigates across their headings without moving focus', async (t) => {
    let result = await mount(t, <Example />)
    let list = element(result.container, '[role="listbox"]')
    let groups = list.querySelectorAll('[role="group"]')

    assert.equal(groups.length, 2)
    assert.equal(
      element(result.container, `[id="${list.getAttribute('aria-labelledby')}"]`).textContent,
      'Font',
    )
    assert.deepEqual(
      Array.from(
        groups,
        (group) =>
          element(result.container, `[id="${group.getAttribute('aria-labelledby')}"]`).textContent,
      ),
      ['Sans serif', 'Serif'],
    )

    await result.act(() => {
      list.focus()
      key(list, 'Home')
    })
    await result.act(() => key(list, 'ArrowDown'))
    await result.act(() => key(list, 'ArrowDown'))
    await result.act(() => key(list, 'ArrowDown'))

    let activeId = list.getAttribute('aria-activedescendant')
    let georgia = element(result.container, `[id="${activeId}"]`)
    assert.equal(georgia.textContent?.trim(), 'Georgia')
    assert.equal(georgia.getAttribute('aria-selected'), 'false')
    assert.equal(document.activeElement, list)

    await result.act(() => key(list, 'Enter'))
    await waitFor(() => assert.equal(georgia.getAttribute('aria-selected'), 'true'))
    await waitFor(() => assert.equal(georgia.hasAttribute('data-listbox-flash'), false))
    await result.act(() => key(list, 'h'))

    let helvetica = element(
      result.container,
      `[id="${list.getAttribute('aria-activedescendant')}"]`,
    )
    assert.equal(helvetica.textContent?.trim(), 'Helvetica')
    assert.equal(georgia.getAttribute('aria-selected'), 'true')
    assert.equal(document.activeElement, list)

    await result.act(() => helvetica.click())
    await waitFor(() => assert.equal(helvetica.getAttribute('aria-selected'), 'true'))
    assert.equal(georgia.getAttribute('aria-selected'), 'false')
  })
})
