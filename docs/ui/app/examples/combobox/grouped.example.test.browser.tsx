import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './grouped.example.tsx'
import { element, enterText, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Grouped combobox example', () => {
  it('labels groups and navigates across their boundaries without focusing headings', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let groups = [...result.container.querySelectorAll('[role="group"]')]
    assert.equal(groups.length, 3)
    assert.deepEqual(
      groups.map((group) => {
        let labelId = group.getAttribute('aria-labelledby')
        assert.ok(labelId)
        return element(result.container, `[id="${labelId}"]`).textContent
      }),
      ['Sans serif', 'Serif', 'Monospace'],
    )
    await result.act(() => {
      search.focus()
      key(search, 'ArrowDown')
    })
    await waitFor(() => assert.ok(element(result.container, '[popover]').checkVisibility()))
    assert.equal(element(result.container, '[data-highlighted="true"]').textContent, 'Arial')
    for (let step = 0; step < 4; step++) {
      await result.act(() => key(search, 'ArrowDown'))
    }
    let highlighted = element(result.container, '[data-highlighted="true"]')
    assert.equal(highlighted.textContent, 'Georgia')
    assert.equal(search.getAttribute('aria-activedescendant'), highlighted.id)
    assert.equal(document.activeElement, search)
    await result.act(() => key(search, 'Enter'))
    await waitFor(() =>
      assert.equal(input(result.container, 'input[type="hidden"]').value, 'georgia'),
    )
    await waitFor(() => assert.equal(search.value, 'Georgia'))
  })

  it('hides empty groups, emphasizes matching text and preserves plain selection labels', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    await result.act(() => {
      search.focus()
      enterText(search, 'co')
    })
    let groups = [...result.container.querySelectorAll('[role="group"]')]
    assert.deepEqual(
      groups.map((group) => group.checkVisibility()),
      [false, false, true],
    )
    let matches = [...result.container.querySelectorAll('[role="option"]:not([hidden])')]
    assert.deepEqual(
      matches.map((option) => option.textContent),
      ['Consolas', 'Courier New'],
    )
    assert.deepEqual(
      matches.map((option) => option.querySelector('mark')?.textContent),
      ['Co', 'Co'],
    )
    let visibleCourier = matches.find((option) => option.textContent === 'Courier New')
    assert.ok(visibleCourier instanceof HTMLElement)
    await result.act(() => visibleCourier.click())
    await waitFor(() => assert.equal(search.value, 'Courier New'))
    assert.equal(input(result.container, 'input[type="hidden"]').value, 'courier-new')
    await result.act(() => key(search, 'ArrowDown'))
    await waitFor(() => assert.equal(search.getAttribute('aria-expanded'), 'true'))
    assert.deepEqual(
      groups.map((group) => group.checkVisibility()),
      [true, true, true],
    )
    await waitFor(() => assert.equal(result.container.querySelector('mark'), null))
    await result.act(() => enterText(search, 'Men'))
    assert.equal(element(result.container, 'mark').textContent, 'Men')
    await result.act(() => key(search, 'Escape'))
    await result.act(() => key(search, 'ArrowDown'))
    await waitFor(() => assert.equal(search.getAttribute('aria-expanded'), 'true'))
    assert.deepEqual(
      groups.map((group) => group.checkVisibility()),
      [true, true, true],
    )
    await waitFor(() => assert.equal(result.container.querySelector('mark'), null))
  })
})
